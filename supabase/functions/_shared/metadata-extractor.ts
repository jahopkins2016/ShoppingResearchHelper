import type { ProductMetadata, SimilarProduct } from "./types.ts";

// ── Low-level HTML helpers ───────────────────────────────────

function getMetaContent(html: string, attr: string, value: string): string {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']*)["']` +
      `|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${value}["']`,
    "i",
  );
  const match = html.match(pattern);
  return match ? (match[1] ?? match[2] ?? "") : "";
}

function getAllMetaContent(html: string, attr: string, value: string): string[] {
  const pattern = new RegExp(
    `<meta[^>]+${attr}=["']${value}["'][^>]+content=["']([^"']*)["']` +
      `|<meta[^>]+content=["']([^"']*)["'][^>]+${attr}=["']${value}["']`,
    "gi",
  );
  const results: string[] = [];
  let match;
  while ((match = pattern.exec(html)) !== null) {
    const val = match[1] ?? match[2] ?? "";
    if (val) results.push(val);
  }
  return results;
}

// ── JSON-LD parsing ──────────────────────────────────────────

interface JsonLdProduct {
  name?: string;
  description?: string;
  image?: string | string[] | { url?: string }[];
  brand?: { name?: string } | string;
  category?: string;
  sku?: string;
  gtin?: string;
  gtin12?: string;
  gtin13?: string;
  gtin14?: string;
  gtin8?: string;
  isbn?: string;
  mpn?: string;
  color?: string;
  size?: string;
  itemCondition?: string;
  offers?: any;
  aggregateRating?: {
    ratingValue?: string | number;
    ratingCount?: string | number;
    reviewCount?: string | number;
    bestRating?: string | number;
  };
  review?: any[];
  isRelatedTo?: any[];
  isSimilarTo?: any[];
}

function parseAllJsonLd(html: string): any[] {
  const scriptPattern =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  const blocks: any[] = [];
  let match;
  while ((match = scriptPattern.exec(html)) !== null) {
    try {
      const raw = JSON.parse(match[1]);
      blocks.push(raw);
    } catch {
      // skip invalid JSON-LD
    }
  }
  return blocks;
}

function findJsonLdByType(blocks: any[], type: string): any | null {
  for (const block of blocks) {
    const items = Array.isArray(block) ? block : [block];
    const result = searchNodes(items, type);
    if (result) return result;
  }
  return null;
}

function findAllJsonLdByType(blocks: any[], type: string): any[] {
  const results: any[] = [];
  for (const block of blocks) {
    const items = Array.isArray(block) ? block : [block];
    collectNodes(items, type, results);
  }
  return results;
}

function searchNodes(items: any[], type: string): any | null {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const itemType = item["@type"];
    if (itemType === type || (Array.isArray(itemType) && itemType.includes(type))) {
      return item;
    }
    if (item["@graph"] && Array.isArray(item["@graph"])) {
      const result = searchNodes(item["@graph"], type);
      if (result) return result;
    }
  }
  return null;
}

function collectNodes(items: any[], type: string, results: any[]): void {
  for (const item of items) {
    if (!item || typeof item !== "object") continue;
    const itemType = item["@type"];
    if (itemType === type || (Array.isArray(itemType) && itemType.includes(type))) {
      results.push(item);
    }
    if (item["@graph"] && Array.isArray(item["@graph"])) {
      collectNodes(item["@graph"], type, results);
    }
  }
}

// ── Individual field extractors ──────────────────────────────

function extractTitle(html: string, product: JsonLdProduct | null): string {
  return (
    product?.name ||
    getMetaContent(html, "property", "og:title") ||
    getMetaContent(html, "name", "title") ||
    (() => {
      const m = html.match(/<title[^>]*>([^<]*)<\/title>/i);
      return m ? m[1].trim() : "";
    })()
  );
}

function extractDescription(html: string, product: JsonLdProduct | null): string {
  return (
    product?.description ||
    getMetaContent(html, "property", "og:description") ||
    getMetaContent(html, "name", "description")
  );
}

function extractImages(html: string, url: string, product: JsonLdProduct | null): { primary: string; additional: string[] } {
  const all: string[] = [];

  // JSON-LD images
  if (product?.image) {
    if (typeof product.image === "string") {
      all.push(product.image);
    } else if (Array.isArray(product.image)) {
      for (const img of product.image) {
        if (typeof img === "string") all.push(img);
        else if (img?.url) all.push(img.url);
      }
    }
  }

  // OG images
  const ogImages = getAllMetaContent(html, "property", "og:image");
  for (const img of ogImages) {
    if (img && !all.includes(img)) all.push(img);
  }

  // Resolve relative URLs
  const resolved = all.map((src) => {
    if (src.startsWith("http")) return src;
    try { return new URL(src, url).toString(); } catch { return src; }
  });

  return {
    primary: resolved[0] || "",
    additional: resolved.slice(1),
  };
}

function extractSiteName(html: string, url: string): string {
  const og = getMetaContent(html, "property", "og:site_name");
  if (og) return og;
  try { return new URL(url).hostname; } catch { return ""; }
}

function extractFaviconUrl(html: string, url: string): string {
  const pattern = /<link[^>]+rel=["'](?:shortcut\s+)?icon["'][^>]+href=["']([^"']*)["']/i;
  const altPattern = /<link[^>]+href=["']([^"']*)["'][^>]+rel=["'](?:shortcut\s+)?icon["']/i;
  const match = html.match(pattern) || html.match(altPattern);
  if (match?.[1]) {
    const href = match[1];
    if (href.startsWith("http")) return href;
    try { return new URL(href, url).toString(); } catch { return href; }
  }
  try { return `${new URL(url).origin}/favicon.ico`; } catch { return ""; }
}

function extractBrand(html: string, product: JsonLdProduct | null): string {
  if (product?.brand) {
    if (typeof product.brand === "string") return product.brand;
    if (product.brand.name) return product.brand.name;
  }
  return (
    getMetaContent(html, "property", "product:brand") ||
    getMetaContent(html, "name", "brand") ||
    getMetaContent(html, "property", "og:brand") ||
    ""
  );
}

function extractCategory(html: string, product: JsonLdProduct | null): string {
  if (product?.category) {
    return typeof product.category === "string"
      ? product.category
      : String(product.category);
  }
  // Try breadcrumb JSON-LD
  return getMetaContent(html, "property", "product:category") || "";
}

function extractBreadcrumbCategory(jsonLdBlocks: any[]): string {
  const breadcrumb = findJsonLdByType(jsonLdBlocks, "BreadcrumbList");
  if (!breadcrumb?.itemListElement) return "";
  const items = Array.isArray(breadcrumb.itemListElement)
    ? breadcrumb.itemListElement
    : [breadcrumb.itemListElement];
  // Sort by position and take all but first (usually "Home")
  const sorted = items
    .filter((i: any) => i.name)
    .sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  if (sorted.length > 1) {
    return sorted.slice(1).map((i: any) => i.name).join(" > ");
  }
  return sorted[0]?.name || "";
}

interface PriceInfo {
  price: string;
  currency: string;
  sale_price: string;
  original_price: string;
  availability: string;
  seller: string;
  condition: string;
  shipping: string;
  return_policy: string;
}

function extractOffersData(html: string, product: JsonLdProduct | null): PriceInfo {
  const result: PriceInfo = {
    price: "", currency: "", sale_price: "", original_price: "",
    availability: "", seller: "", condition: "", shipping: "", return_policy: "",
  };

  if (product?.offers) {
    const offers = Array.isArray(product.offers) ? product.offers : [product.offers];

    // Handle AggregateOffer
    const first = offers[0];
    if (first) {
      result.price = String(first.price ?? first.lowPrice ?? "");
      result.currency = first.priceCurrency || "";

      // Sale price detection: if highPrice differs, price is sale, highPrice is original
      if (first.lowPrice && first.highPrice && first.lowPrice !== first.highPrice) {
        result.sale_price = String(first.lowPrice);
        result.original_price = String(first.highPrice);
        result.price = result.sale_price;
      }

      // Availability
      if (first.availability) {
        result.availability = first.availability
          .replace("https://schema.org/", "")
          .replace("http://schema.org/", "");
      }

      // Seller
      if (first.seller) {
        result.seller = typeof first.seller === "string"
          ? first.seller
          : first.seller.name || "";
      }

      // Condition
      if (first.itemCondition || product.itemCondition) {
        const cond = (first.itemCondition || product.itemCondition || "")
          .replace("https://schema.org/", "")
          .replace("http://schema.org/", "");
        result.condition = cond;
      }

      // Shipping
      if (first.shippingDetails) {
        const sd = first.shippingDetails;
        if (sd.shippingRate) {
          const rate = sd.shippingRate;
          if (rate.value === "0" || rate.value === 0) {
            result.shipping = "Free shipping";
          } else if (rate.value) {
            result.shipping = `${rate.currency || "$"}${rate.value} shipping`;
          }
        }
        if (sd.deliveryTime?.handlingTime) {
          const ht = sd.deliveryTime.handlingTime;
          if (ht.maxValue) {
            result.shipping += result.shipping
              ? `, ships in ${ht.maxValue} ${ht.unitCode || "days"}`
              : `Ships in ${ht.maxValue} ${ht.unitCode || "days"}`;
          }
        }
      }

      // Return policy
      if (first.hasMerchantReturnPolicy) {
        const rp = first.hasMerchantReturnPolicy;
        if (rp.merchantReturnDays) {
          result.return_policy = `${rp.merchantReturnDays}-day returns`;
        }
        if (rp.returnPolicyCategory) {
          const cat = rp.returnPolicyCategory
            .replace("https://schema.org/", "")
            .replace("http://schema.org/", "");
          if (cat === "MerchantReturnFiniteReturnWindow") {
            // already handled by merchantReturnDays
          } else if (cat === "MerchantReturnNotPermitted") {
            result.return_policy = "No returns";
          } else if (cat === "MerchantReturnUnlimitedWindow") {
            result.return_policy = "Unlimited returns";
          }
        }
      }
    }
  }

  // Fallback to meta tags for price
  if (!result.price) {
    result.price =
      getMetaContent(html, "property", "product:price:amount") ||
      getMetaContent(html, "property", "og:price:amount") ||
      "";
  }
  if (!result.currency) {
    result.currency =
      getMetaContent(html, "property", "product:price:currency") ||
      getMetaContent(html, "property", "og:price:currency") ||
      "";
  }

  // Fallback availability from meta
  if (!result.availability) {
    result.availability =
      getMetaContent(html, "property", "product:availability") ||
      getMetaContent(html, "property", "og:availability") ||
      "";
  }

  // Fallback condition from meta
  if (!result.condition) {
    result.condition =
      getMetaContent(html, "property", "product:condition") || "";
  }

  return result;
}

function extractRating(product: JsonLdProduct | null): {
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
} {
  if (!product?.aggregateRating) {
    return { rating: null, rating_count: null, review_count: null };
  }
  const ar = product.aggregateRating;
  let rating: number | null = null;
  if (ar.ratingValue != null) {
    const parsed = parseFloat(String(ar.ratingValue));
    if (!isNaN(parsed)) {
      // Normalize to 5-star scale if bestRating is specified
      const best = ar.bestRating ? parseFloat(String(ar.bestRating)) : 5;
      rating = best !== 5 && best > 0 ? Math.round((parsed / best) * 5 * 100) / 100 : Math.round(parsed * 100) / 100;
    }
  }
  const ratingCount = ar.ratingCount != null ? parseInt(String(ar.ratingCount), 10) || null : null;
  let reviewCount = ar.reviewCount != null ? parseInt(String(ar.reviewCount), 10) || null : null;
  // Some sites put review count in ratingCount; if reviews array exists, use its length
  if (!reviewCount && product.review && Array.isArray(product.review)) {
    reviewCount = product.review.length || null;
  }
  return { rating, rating_count: ratingCount, review_count: reviewCount };
}

function extractIdentifiers(product: JsonLdProduct | null): { sku: string; gtin: string } {
  if (!product) return { sku: "", gtin: "" };
  const sku = product.sku || "";
  const gtin =
    product.gtin || product.gtin13 || product.gtin12 || product.gtin14 ||
    product.gtin8 || product.isbn || "";
  return { sku, gtin };
}

function extractVariantInfo(html: string, product: JsonLdProduct | null): { color: string; size: string } {
  let color = product?.color || "";
  let size = product?.size || "";
  if (!color) color = getMetaContent(html, "property", "product:color") || "";
  if (!size) size = getMetaContent(html, "property", "product:size") || "";
  return { color, size };
}

// ── Similar products from page data ──────────────────────────

function extractSimilarFromJsonLd(
  jsonLdBlocks: any[],
  product: JsonLdProduct | null,
): SimilarProduct[] {
  const results: SimilarProduct[] = [];

  // Check isRelatedTo / isSimilarTo on the product itself
  const relatedSources = [
    ...(product?.isRelatedTo ? (Array.isArray(product.isRelatedTo) ? product.isRelatedTo : [product.isRelatedTo]) : []),
    ...(product?.isSimilarTo ? (Array.isArray(product.isSimilarTo) ? product.isSimilarTo : [product.isSimilarTo]) : []),
  ];

  for (const rel of relatedSources) {
    if (rel?.name && rel?.url) {
      const offer = Array.isArray(rel.offers) ? rel.offers[0] : rel.offers;
      results.push({
        title: rel.name,
        url: rel.url,
        image_url: typeof rel.image === "string" ? rel.image : rel.image?.[0] || "",
        price: String(offer?.price ?? offer?.lowPrice ?? ""),
        currency: offer?.priceCurrency || "",
        site_name: "",
        similarity_source: "json_ld",
      });
    }
  }

  // Also look for ItemList / ProductCollection in JSON-LD (common on Amazon, etc.)
  const itemLists = findAllJsonLdByType(jsonLdBlocks, "ItemList");
  for (const list of itemLists) {
    if (!list.itemListElement) continue;
    const elements = Array.isArray(list.itemListElement) ? list.itemListElement : [list.itemListElement];
    for (const el of elements.slice(0, 10)) {
      const item = el.item || el;
      if (item?.name && item?.url) {
        const offer = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        results.push({
          title: item.name,
          url: item.url,
          image_url: typeof item.image === "string" ? item.image : item.image?.[0] || "",
          price: String(offer?.price ?? offer?.lowPrice ?? ""),
          currency: offer?.priceCurrency || "",
          site_name: "",
          similarity_source: "json_ld",
        });
      }
    }
  }

  return results;
}

// ── Build overflow metadata (extras that don't have dedicated columns) ──

function buildOverflowMetadata(product: JsonLdProduct | null, html: string): Record<string, unknown> {
  const extras: Record<string, unknown> = {};

  // MPN
  if (product && "mpn" in product && product.mpn) {
    extras.mpn = product.mpn;
  }

  // Material
  const material = (product as any)?.material;
  if (material) extras.material = material;

  // Weight
  const weight = (product as any)?.weight;
  if (weight) {
    extras.weight = typeof weight === "string" ? weight : `${weight.value || ""} ${weight.unitCode || ""}`.trim();
  }

  // Country of origin
  const origin = (product as any)?.countryOfOrigin;
  if (origin) extras.country_of_origin = typeof origin === "string" ? origin : origin.name || "";

  // Warranty
  const warranty = (product as any)?.hasWarranty || (product as any)?.warranty;
  if (warranty) extras.warranty = typeof warranty === "string" ? warranty : warranty.description || warranty.name || "";

  // Product group / model
  const model = (product as any)?.model;
  if (model) extras.model = typeof model === "string" ? model : model.name || "";

  // Additional text-based heuristics from meta tags
  const keywords = getMetaContent(html, "name", "keywords");
  if (keywords) extras.keywords = keywords;

  return extras;
}

// ── Public API ───────────────────────────────────────────────

/**
 * Extract comprehensive product metadata from raw HTML.
 * This is the main entry point — pass in the HTML string and the source URL.
 */
export function extractMetadata(html: string, url: string): {
  metadata: ProductMetadata;
  similar_products: SimilarProduct[];
} {
  const jsonLdBlocks = parseAllJsonLd(html);
  const product = findJsonLdByType(jsonLdBlocks, "Product") as JsonLdProduct | null;

  const title = extractTitle(html, product);
  const description = extractDescription(html, product);
  const images = extractImages(html, url, product);
  const site_name = extractSiteName(html, url);
  const site_favicon_url = extractFaviconUrl(html, url);
  const brand = extractBrand(html, product);
  const category = extractCategory(html, product) || extractBreadcrumbCategory(jsonLdBlocks);
  const offers = extractOffersData(html, product);
  const ratings = extractRating(product);
  const ids = extractIdentifiers(product);
  const variants = extractVariantInfo(html, product);
  const overflow = buildOverflowMetadata(product, html);
  const similar = extractSimilarFromJsonLd(jsonLdBlocks, product);

  const metadata: ProductMetadata = {
    title,
    description,
    image_url: images.primary,
    site_name,
    site_favicon_url,
    price: offers.price,
    currency: offers.currency,
    brand,
    category,
    availability: offers.availability,
    condition: offers.condition,
    rating: ratings.rating,
    rating_count: ratings.rating_count,
    review_count: ratings.review_count,
    seller: offers.seller,
    sku: ids.sku,
    gtin: ids.gtin,
    sale_price: offers.sale_price,
    original_price: offers.original_price,
    additional_images: images.additional,
    color: variants.color,
    size: variants.size,
    shipping: offers.shipping,
    return_policy: offers.return_policy,
    product_metadata: overflow,
  };

  return { metadata, similar_products: similar };
}

/**
 * Re-export for convenience: parse all JSON-LD blocks from HTML.
 * Useful for callers that need raw structured data.
 */
export { parseAllJsonLd, findJsonLdByType, getMetaContent };
