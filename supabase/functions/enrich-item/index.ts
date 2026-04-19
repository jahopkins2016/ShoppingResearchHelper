import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractMetadata } from "../_shared/metadata-extractor.ts";
import { findSimilarProducts } from "../_shared/similar-products.ts";
import { unwrapGoogleUrl, titleFromUrl } from "../_shared/url-utils.ts";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ── Main handler ──

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Validate caller: accept service role key OR a valid user JWT
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const token = authHeader.replace("Bearer ", "");
  const isServiceRole = token === serviceRoleKey;

  if (!isServiceRole) {
    // Verify the user JWT is valid
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
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

    // If the saved URL is a Google wrapper (search/Lens/imgres), swap in
    // the real destination before enrichment. Persist so the UI's "open"
    // action also lands on the product page, not Google.
    const unwrappedUrl = unwrapGoogleUrl(item.url);
    if (unwrappedUrl !== item.url) {
      await supabase.from("items").update({ url: unwrappedUrl }).eq("id", itemId);
      item.url = unwrappedUrl;
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

      // If the URL was a redirect shortener (share.google, g.co, bit.ly,
      // amzn.to, etc.), fetch landed on the real product page. Persist that
      // URL so every downstream consumer — and the next enrichment run —
      // sees the resolved destination.
      if (resp.url && resp.url !== item.url) {
        const landed = unwrapGoogleUrl(resp.url);
        if (landed !== item.url) {
          await supabase.from("items").update({ url: landed }).eq("id", itemId);
          item.url = landed;
        }
      }
    } catch (e: any) {
      await supabase
        .from("items")
        .update({ enrichment_status: "failed", updated_at: new Date().toISOString() })
        .eq("id", itemId);

      return new Response(
        JSON.stringify({ success: false, error: `Failed to fetch URL: ${e.message}` }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // ── Extract rich metadata ──
    const { metadata, similar_products: jsonLdSimilar } = extractMetadata(html, item.url);

    // ── Find similar products (parallel: same-site + Google Shopping) ──
    const similarProducts = await findSimilarProducts({
      title: metadata.title,
      brand: metadata.brand,
      gtin: metadata.gtin,
      sourceUrl: item.url,
      jsonLdSimilar,
      limit: 10,
    });

    // If extraction gave us nothing usable (e.g. Google search page, blocked
    // by anti-bot, or a non-product page), fall back to a readable title
    // derived from the URL instead of leaving the field null — the UI
    // otherwise shows the raw URL with %20 etc.
    const resolvedTitle =
      (metadata.title && metadata.title.trim()) || titleFromUrl(item.url);

    // Build update payload with all extracted fields
    const update: Record<string, any> = {
      title: resolvedTitle,
      description: metadata.description,
      image_url: metadata.image_url,
      site_name: metadata.site_name,
      site_favicon_url: metadata.site_favicon_url,
      price: metadata.price,
      currency: metadata.currency,
      brand: metadata.brand || null,
      category: metadata.category || null,
      availability: metadata.availability || null,
      condition: metadata.condition || null,
      rating: metadata.rating,
      rating_count: metadata.rating_count,
      review_count: metadata.review_count,
      seller: metadata.seller || null,
      sku: metadata.sku || null,
      gtin: metadata.gtin || null,
      sale_price: metadata.sale_price || null,
      original_price: metadata.original_price || null,
      additional_images: metadata.additional_images.length > 0 ? metadata.additional_images : null,
      color: metadata.color || null,
      size: metadata.size || null,
      shipping: metadata.shipping || null,
      return_policy: metadata.return_policy || null,
      product_metadata: Object.keys(metadata.product_metadata).length > 0
        ? metadata.product_metadata
        : null,
      enrichment_status: "completed",
      updated_at: new Date().toISOString(),
    };

    // Cache image to Supabase Storage
    if (metadata.image_url) {
      try {
        const imgResp = await fetch(metadata.image_url, {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Accept: "image/*",
          },
          redirect: "follow",
        });

        if (imgResp.ok) {
          const contentType = imgResp.headers.get("content-type") || "image/jpeg";
          const extMap: Record<string, string> = {
            "image/png": "png",
            "image/jpeg": "jpg",
            "image/webp": "webp",
            "image/gif": "gif",
          };
          const ext = extMap[contentType.split(";")[0].trim()] || "jpg";
          const storagePath = `${itemId}.${ext}`;

          const imgBytes = new Uint8Array(await imgResp.arrayBuffer());

          const { error: uploadError } = await supabase.storage
            .from("item-images")
            .upload(storagePath, imgBytes, {
              contentType: contentType.split(";")[0].trim(),
              upsert: true,
            });

          if (!uploadError) {
            const { data: publicUrlData } = supabase.storage
              .from("item-images")
              .getPublicUrl(storagePath);

            if (publicUrlData?.publicUrl) {
              update.cached_image_path = publicUrlData.publicUrl;
            }
          } else {
            console.error("Image upload failed:", uploadError.message);
          }
        }
      } catch (imgErr: any) {
        console.error("Image caching failed:", imgErr.message);
      }
    }

    // Check if we should update lowest_price
    const price = metadata.sale_price || metadata.price;
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
      .insert({ item_id: itemId, price, currency: metadata.currency });

    if (historyError) {
      console.error("Failed to insert price_history:", historyError.message);
    }

    // Insert similar products (replace any existing ones for this item)
    if (similarProducts.length > 0) {
      // Delete old similar products for this item
      await supabase
        .from("similar_products")
        .delete()
        .eq("item_id", itemId);

      const rows = similarProducts.map((sp) => ({
        item_id: itemId,
        title: sp.title,
        url: sp.url,
        image_url: sp.image_url || null,
        price: sp.price || null,
        currency: sp.currency || null,
        site_name: sp.site_name || null,
        similarity_source: sp.similarity_source,
      }));

      const { error: simError } = await supabase
        .from("similar_products")
        .insert(rows);

      if (simError) {
        console.error("Failed to insert similar products:", simError.message);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        item_id: itemId,
        fields_extracted: Object.keys(update).filter((k) => update[k] != null && k !== "enrichment_status" && k !== "updated_at").length,
        similar_products_found: similarProducts.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (e: any) {
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
