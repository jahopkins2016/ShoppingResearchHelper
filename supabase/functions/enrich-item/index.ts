import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Regex-based metadata extraction (ported from extension popup.ts) ──

function getMetaContent(html: string, attr: string, value: string): string {
  // Match both single and double quotes, handle whitespace variations
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']*)["']` +
    `|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${value}["']`,
    "i"
  );
  const match = html.match(pattern);
  return match ? (match[1] ?? match[2] ?? "") : "";
}

function extractTitle(html: string): string {
  return (
    getMetaContent(html, "property", "og:title") ||
    getMetaContent(html, "name", "title") ||
    (() => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? m[1].trim() : "";
    })()
  );
}

function extractDescription(html: string): string {
  return (
    getMetaContent(html, "property", "og:description") ||
    getMetaContent(html, "name", "description")
  );
}

function extractImageUrl(html: string): string {
  return getMetaContent(html, "property", "og:image");
}

function extractSiteName(html: string, url: string): string {
  const og = getMetaContent(html, "property", "og:site_name");
  if (og) return og;
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}

function extractFaviconUrl(html: string, url: string): string {
  // Match <link rel="icon" href="..."> or <link rel="shortcut icon" href="...">
  const pattern =
    /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']*)["']/i;
  const altPattern =
    /<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut\s+)?icon["']/i;
  const match = html.match(pattern) || html.match(altPattern);

  if (match && match[1]) {
    const href = match[1];
    // Resolve relative URLs
    if (href.startsWith("http")) return href;
    try {
      return new URL(href, url).toString();
    } catch {
      return href;
    }
  }

  try {
    const origin = new URL(url).origin;
    return `${origin}/favicon.ico`;
  } catch {
    return "";
  }
}

interface PriceInfo {
  price: string;
  currency: string;
}

function extractPriceFromJsonLd(html: string): PriceInfo {
  const scriptPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;

  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      const nodes = Array.isArray(raw) ? raw : [raw];

      const result = findProduct(nodes);
      if (result) return result;
    } catch {
      // skip invalid JSON-LD
    }
  }

  return { price: "", currency: "" };
}

function findProduct(items: any[]): PriceInfo | null {
  for (const item of items) {
    if (item["@type"] === "Product" && item.offers) {
      const offers = Array.isArray(item.offers)
        ? item.offers
        : [item.offers];
      for (const offer of offers) {
        if (offer.price || offer.lowPrice) {
          return {
            price: String(offer.price ?? offer.lowPrice ?? ""),
            currency: offer.priceCurrency || "",
          };
        }
      }
    }
    if (item["@graph"] && Array.isArray(item["@graph"])) {
      const result = findProduct(item["@graph"]);
      if (result) return result;
    }
  }
  return null;
}

function extractPrice(html: string): PriceInfo {
  // 1. Try JSON-LD
  const jsonLd = extractPriceFromJsonLd(html);
  if (jsonLd.price) return jsonLd;

  // 2. Fallback to meta tags
  const price =
    getMetaContent(html, "property", "product:price:amount") ||
    getMetaContent(html, "property", "og:price:amount");

  const currency =
    jsonLd.currency ||
    getMetaContent(html, "property", "product:price:currency") ||
    getMetaContent(html, "property", "og:price:currency");

  return { price, currency };
}

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate service role key
  const authHeader = req.headers.get("Authorization");
  if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let itemId: string;
  try {
    const body = await req.json();
    itemId = body.item_id;
    if (!itemId) throw new Error("missing item_id");
  } catch {
    return new Response(
      JSON.stringify({ error: "Invalid request body — expected { item_id: string }" }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Fetch item from DB
    const { data: item, error: fetchError } = await supabase
      .from("items")
      .select("id, url, lowest_price")
      .eq("id", itemId)
      .single();

    if (fetchError || !item) {
      return new Response(
        JSON.stringify({ success: false, error: "Item not found" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch the URL with a browser-like User-Agent
    let html: string;
    try {
      const resp = await fetch(item.url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "en-US,en;q=0.5",
        },
        redirect: "follow",
      });
      html = await resp.text();
    } catch (e: any) {
      // Fetch failed — mark enrichment as failed
      await supabase
        .from("items")
        .update({ enrichment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", itemId);

      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch URL: ${e.message}` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Extract metadata
    const title = extractTitle(html);
    const description = extractDescription(html);
    const image_url = extractImageUrl(html);
    const site_name = extractSiteName(html, item.url);
    const site_favicon_url = extractFaviconUrl(html, item.url);
    const { price, currency } = extractPrice(html);

    // Build update payload
    const update: Record<string, any> = {
      title,
      description,
      image_url,
      site_name,
      site_favicon_url,
      price,
      currency,
      enrichment_status: "completed",
      updated_at: new Date().toISOString(),
    };

    // Check if we should update lowest_price
    if (price) {
      if (!item.lowest_price || price < item.lowest_price) {
        update.lowest_price = price;
        update.price_drop_seen = false;
      }
    }

    // Update the item
    const { error: updateError } = await supabase
      .from("items")
      .update(update)
      .eq("id", itemId);

    if (updateError) {
      throw new Error(`Failed to update item: ${updateError.message}`);
    }

    // Insert price_history row
    const { error: historyError } = await supabase
      .from("price_history")
      .insert({ item_id: itemId, price, currency });

    if (historyError) {
      console.error("Failed to insert price_history:", historyError.message);
      // Non-fatal — enrichment still succeeded
    }

    return new Response(
      JSON.stringify({ success: true, item_id: itemId }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    // Catch-all: mark as failed
    await supabase
      .from("items")
      .update({ enrichment_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", itemId);

    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  }
});
