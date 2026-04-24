// Vision-based enrichment: look at one or more photos of an in-store item and
// extract structured product metadata. The Flutter capture sheet uploads photos
// to the `item-images` bucket, then calls this function with the public URLs.
// We ask Claude to classify each photo (product / price tag / spec label /
// barcode / receipt / other) and return a single merged record of the product.
//
// Input:  { photo_urls: string[], item_id?: string }
//   - If item_id is provided, extracted fields are written back to the row.
//   - If omitted, extracted JSON is returned so the client can pre-fill a form.
// Output: { success: true, extracted: {...}, photo_classifications: [...] }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");

// Service-role client for writing back to items (bypasses RLS).
const supabase = createClient(supabaseUrl, serviceRoleKey);

// Daily per-user cap on vision enrichments. Sized so a single user
// can't burn through the Anthropic monthly spend cap on their own.
const DAILY_QUOTA = 50;

const EXTRACT_TOOL = {
  name: "record_item",
  description:
    "Record the structured product information extracted from the photos. " +
    "Merge information across photos — the product photo gives you title/brand/colour, " +
    "the price tag gives you price/currency/sale, a spec label gives size/SKU/GTIN, etc. " +
    "Leave a field null if no photo shows that information.",
  input_schema: {
    type: "object",
    properties: {
      title: { type: ["string", "null"], description: "Product name" },
      brand: { type: ["string", "null"] },
      category: { type: ["string", "null"] },
      description: { type: ["string", "null"] },
      price: {
        type: ["number", "null"],
        description: "Current (sale if on sale) price as a number. No currency symbol.",
      },
      original_price: {
        type: ["number", "null"],
        description: "Original price if an item is on sale; otherwise null.",
      },
      currency: {
        type: ["string", "null"],
        description: "ISO currency code e.g. USD, GBP, EUR, AUD.",
      },
      size: { type: ["string", "null"] },
      color: { type: ["string", "null"] },
      sku: { type: ["string", "null"] },
      gtin: {
        type: ["string", "null"],
        description: "Barcode (UPC/EAN/ISBN) if visible.",
      },
      condition: { type: ["string", "null"], description: "new, used, refurbished, etc." },
      seller: {
        type: ["string", "null"],
        description: "Store or seller name if visible on signage/receipt.",
      },
      notes: {
        type: ["string", "null"],
        description:
          "Anything else a shopper would want to remember: warranty text, promo details, store-exclusive flags, bundle info.",
      },
      photo_classifications: {
        type: "array",
        description: "One entry per input photo, in the same order as photo_urls.",
        items: {
          type: "object",
          properties: {
            kind: {
              type: "string",
              enum: ["product", "price_tag", "spec_label", "barcode", "receipt", "other"],
            },
            note: {
              type: ["string", "null"],
              description: "Short human-readable description of what the photo shows.",
            },
          },
          required: ["kind"],
        },
      },
    },
    required: ["photo_classifications"],
  },
} as const;

const SYSTEM = `You are a product-research assistant. The user is shopping in a physical store and has taken photos of an item and any tags/labels visible nearby. Your job is to read every photo and produce one structured record describing the product.

Rules:
- Only extract what is actually visible. Do not guess a price, brand, or size that isn't on one of the photos.
- If photos show conflicting info (e.g. two price tags), prefer the one most clearly attached to the same product as the main item photo.
- Prices should be numeric (no currency symbol). Put the currency code separately.
- The "notes" field is for anything else worth remembering: warranty length, promo end dates, "only at [store]" flags, bundle contents.
- Always fill in photo_classifications with one entry per input photo in the order given.`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Unauthorized" }, 401);
  if (!anthropicKey) {
    return json(
      {
        error: "ANTHROPIC_API_KEY not configured",
        code: "service_unavailable",
        user_message:
          "Photo reading is temporarily unavailable. Please type the details in manually.",
      },
      503,
    );
  }

  let photoUrls: string[];
  let itemId: string | undefined;
  try {
    const body = await req.json();
    photoUrls = body.photo_urls;
    itemId = body.item_id;
    if (!Array.isArray(photoUrls) || photoUrls.length === 0) {
      throw new Error("missing photo_urls");
    }
  } catch {
    return json(
      { error: "Invalid request body — expected { photo_urls: string[], item_id?: string }" },
      400,
    );
  }

  // User-scoped client so the quota RPC sees auth.uid() = the caller.
  // verify_jwt = true (config.toml) ensures the JWT is already validated.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: quota, error: quotaError } = await userClient.rpc(
    "check_and_increment_quota",
    { p_kind: "enrich_photos", p_limit: DAILY_QUOTA },
  );
  if (quotaError) {
    return json({ error: `Quota check failed: ${quotaError.message}` }, 500);
  }
  const row = Array.isArray(quota) ? quota[0] : quota;
  if (!row?.allowed) {
    return json(
      {
        error: "Daily quota exceeded",
        code: "quota_exceeded",
        user_message:
          `You've reached today's limit of ${DAILY_QUOTA} photo reads. Please try again tomorrow or fill in the details manually.`,
        current_count: row?.current_count,
        daily_limit: row?.daily_limit,
      },
      429,
    );
  }

  try {
    const imageBlocks = photoUrls.map((url) => ({
      type: "image",
      source: { type: "url", url },
    }));

    const textBlock = {
      type: "text",
      text:
        `Here are ${photoUrls.length} photo(s) of a product in a store. ` +
        `Identify the product and extract everything visible by calling the record_item tool.`,
    };

    const resp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1500,
        system: SYSTEM,
        tools: [EXTRACT_TOOL],
        tool_choice: { type: "tool", name: "record_item" },
        messages: [
          {
            role: "user",
            content: [...imageBlocks, textBlock],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      // 429 from Anthropic = either rate limit or monthly spend cap hit.
      // Both mean "stop calling for now" — surface a friendly message.
      if (resp.status === 429) {
        return json(
          {
            error: `Anthropic rate/spend limit: ${errText}`,
            code: "service_unavailable",
            user_message:
              "Photo reading is temporarily unavailable due to high demand. Please try again later or fill in the details manually.",
          },
          503,
        );
      }
      // 401/403 = our key is bad or revoked — same user-facing story.
      if (resp.status === 401 || resp.status === 403) {
        return json(
          {
            error: `Anthropic auth error: ${errText}`,
            code: "service_unavailable",
            user_message:
              "Photo reading is temporarily unavailable. Please fill in the details manually.",
          },
          503,
        );
      }
      return json({ error: `Anthropic API error: ${resp.status} ${errText}` }, 502);
    }

    const data = await resp.json();
    const toolUse = (data.content ?? []).find(
      (b: { type: string }) => b.type === "tool_use",
    );
    if (!toolUse) {
      return json({ error: "Model did not return a tool call", raw: data }, 502);
    }
    const extracted = toolUse.input as Record<string, unknown>;

    // If an item_id was passed, persist to the row. Skip null fields so we
    // don't clobber values the user typed before enrichment returned.
    if (itemId) {
      const update: Record<string, unknown> = {
        enrichment_status: "completed",
        updated_at: new Date().toISOString(),
      };
      const passthrough = [
        "title",
        "brand",
        "category",
        "description",
        "currency",
        "size",
        "color",
        "sku",
        "gtin",
        "condition",
        "seller",
        "notes",
      ];
      for (const key of passthrough) {
        if (extracted[key] != null) update[key] = extracted[key];
      }
      if (extracted.photo_classifications != null) {
        update.photo_classifications = extracted.photo_classifications;
      }
      // Prices are numeric in the tool schema but stored as text in items.
      if (extracted.price != null) update.price = String(extracted.price);
      if (extracted.original_price != null) {
        update.original_price = String(extracted.original_price);
      }

      const { error: updateError } = await supabase
        .from("items")
        .update(update)
        .eq("id", itemId);
      if (updateError) {
        return json({ error: `Failed to update item: ${updateError.message}` }, 500);
      }
    }

    return json({ success: true, extracted });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
