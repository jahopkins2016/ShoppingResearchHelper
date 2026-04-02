import type { SimilarProduct } from "./types.ts";

const FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
};

/**
 * Build a search query from product metadata.
 * Combines brand + title, stripping common noise words.
 */
function buildSearchQuery(title: string, brand: string): string {
  // Remove common filler patterns from title
  let query = title
    .replace(/\s*[-|–]\s*.{0,30}$/, "") // strip trailing "- SiteName"
    .replace(/\(.*?\)/g, "")             // strip parentheticals
    .replace(/,\s*pack of \d+/gi, "")
    .trim();

  // Prepend brand if not already in the title
  if (brand && !query.toLowerCase().includes(brand.toLowerCase())) {
    query = `${brand} ${query}`;
  }

  // Limit to first ~8 words to get a good search
  const words = query.split(/\s+/).slice(0, 8);
  return words.join(" ");
}

/**
 * Scrape Google Shopping search results (lite HTML parse).
 * Returns up to `limit` products found.
 */
async function searchGoogleShopping(
  query: string,
  limit: number = 6,
): Promise<SimilarProduct[]> {
  const encoded = encodeURIComponent(query);
  const url = `https://www.google.com/search?q=${encoded}&tbm=shop&hl=en`;

  try {
    const resp = await fetch(url, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    return parseGoogleShoppingResults(html, limit);
  } catch {
    return [];
  }
}

/**
 * Parse product cards from Google Shopping HTML.
 * Google Shopping results have product info in structured patterns.
 */
function parseGoogleShoppingResults(html: string, limit: number): SimilarProduct[] {
  const results: SimilarProduct[] = [];

  // Google Shopping uses various patterns. We look for common link+title+price patterns.
  // Product cards often have data-dtld attributes or specific class patterns.

  // Pattern: <a> tags with product URLs containing /shopping/product/ or merchant URLs
  // Title is typically in an <h3> or <div> with specific classes
  // We use a heuristic regex approach since the HTML varies

  // Look for product link patterns with associated content
  const cardPattern =
    /<a[^>]+href=["'](\/url\?[^"']*|https?:\/\/[^"']*shopping[^"']*|https?:\/\/[^"']*product[^"']*)["'][^>]*>[\s\S]*?<\/a>/gi;

  let match;
  while ((match = cardPattern.exec(html)) !== null && results.length < limit) {
    const cardHtml = match[0];
    const href = match[1];

    // Extract title from the card
    const titleMatch = cardHtml.match(/<(?:h3|div|span)[^>]*>([^<]{5,100})<\/(?:h3|div|span)>/i);
    if (!titleMatch) continue;
    const title = decodeHtmlEntities(titleMatch[1].trim());

    // Extract price
    const priceMatch = cardHtml.match(/(\$[\d,.]+|£[\d,.]+|€[\d,.]+|[\d,.]+\s*(?:USD|GBP|EUR))/i);
    const price = priceMatch ? priceMatch[1].replace(/[^0-9.,]/g, "") : "";
    const currency = priceMatch
      ? priceMatch[1].match(/\$/) ? "USD"
        : priceMatch[1].match(/£/) ? "GBP"
        : priceMatch[1].match(/€/) ? "EUR"
        : ""
      : "";

    // Extract image
    const imgMatch = cardHtml.match(/<img[^>]+src=["']([^"']+)["']/i);
    const image_url = imgMatch ? imgMatch[1] : "";

    // Resolve URL
    let resolvedUrl = href;
    if (href.startsWith("/url?")) {
      const urlParam = href.match(/[?&](?:q|url)=([^&]+)/);
      if (urlParam) resolvedUrl = decodeURIComponent(urlParam[1]);
    }

    // Skip self-referential or invalid results
    if (!title || title.length < 5) continue;

    let siteName = "";
    try { siteName = new URL(resolvedUrl).hostname; } catch { /* skip */ }

    results.push({
      title,
      url: resolvedUrl,
      image_url,
      price,
      currency,
      site_name: siteName,
      similarity_source: "search",
    });
  }

  return results;
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)));
}

/**
 * Find similar products by searching same site with brand + category.
 * Scrapes the site's own search if it has one.
 */
async function searchSameSite(
  sourceUrl: string,
  title: string,
  brand: string,
  limit: number = 4,
): Promise<SimilarProduct[]> {
  try {
    const origin = new URL(sourceUrl).origin;
    const query = buildSearchQuery(title, brand);
    const searchUrl = `${origin}/s?k=${encodeURIComponent(query)}`;

    const resp = await fetch(searchUrl, {
      headers: FETCH_HEADERS,
      redirect: "follow",
    });
    if (!resp.ok) return [];
    const html = await resp.text();

    // Look for product links on the search results page
    const results: SimilarProduct[] = [];
    const linkPattern = /<a[^>]+href=["']([^"']*\/(?:dp|product|item|p)\/[^"']*)["'][^>]*>/gi;
    const seen = new Set<string>();

    let match;
    while ((match = linkPattern.exec(html)) !== null && results.length < limit) {
      let href = match[1];
      if (!href.startsWith("http")) {
        try { href = new URL(href, origin).toString(); } catch { continue; }
      }

      // Dedupe and skip the source URL
      if (seen.has(href) || href === sourceUrl) continue;
      seen.add(href);

      // Try to find a title near this link
      const surroundingHtml = html.substring(
        Math.max(0, match.index - 200),
        Math.min(html.length, match.index + match[0].length + 500),
      );
      const titleMatch = surroundingHtml.match(/<(?:h2|h3|span|div)[^>]*class=["'][^"']*title[^"']*["'][^>]*>([^<]{5,120})<\//i);
      const priceMatch = surroundingHtml.match(/(\$[\d,.]+|£[\d,.]+|€[\d,.]+)/);
      const imgMatch = surroundingHtml.match(/<img[^>]+src=["']([^"']+)["']/i);

      results.push({
        title: titleMatch ? decodeHtmlEntities(titleMatch[1].trim()) : "",
        url: href,
        image_url: imgMatch?.[1] || "",
        price: priceMatch ? priceMatch[1].replace(/[^0-9.,]/g, "") : "",
        currency: priceMatch
          ? priceMatch[1].startsWith("$") ? "USD"
            : priceMatch[1].startsWith("£") ? "GBP"
            : priceMatch[1].startsWith("€") ? "EUR"
            : ""
          : "",
        site_name: new URL(origin).hostname,
        similarity_source: "same_site",
      });
    }

    return results.filter((r) => r.title);
  } catch {
    return [];
  }
}

// ── Public API ───────────────────────────────────────────────

export interface FindSimilarOptions {
  title: string;
  brand: string;
  gtin: string;
  sourceUrl: string;
  /** Products already found from JSON-LD on the source page */
  jsonLdSimilar: SimilarProduct[];
  /** Max total results to return */
  limit?: number;
}

/**
 * Find similar products using multiple strategies:
 * 1. JSON-LD related products (already extracted, passed in)
 * 2. Same-site search
 * 3. Google Shopping search
 *
 * Results are deduped by URL.
 */
export async function findSimilarProducts(
  options: FindSimilarOptions,
): Promise<SimilarProduct[]> {
  const { title, brand, gtin, sourceUrl, jsonLdSimilar, limit = 10 } = options;

  if (!title) return jsonLdSimilar.slice(0, limit);

  const all: SimilarProduct[] = [...jsonLdSimilar];
  const seen = new Set(jsonLdSimilar.map((p) => p.url));

  // Run same-site search + Google Shopping in parallel
  const searchQuery = gtin || buildSearchQuery(title, brand);

  const [sameSiteResults, shoppingResults] = await Promise.allSettled([
    searchSameSite(sourceUrl, title, brand, 4),
    searchGoogleShopping(searchQuery, 6),
  ]);

  if (sameSiteResults.status === "fulfilled") {
    for (const p of sameSiteResults.value) {
      if (!seen.has(p.url)) {
        seen.add(p.url);
        all.push(p);
      }
    }
  }

  if (shoppingResults.status === "fulfilled") {
    for (const p of shoppingResults.value) {
      if (!seen.has(p.url)) {
        seen.add(p.url);
        all.push(p);
      }
    }
  }

  return all.slice(0, limit);
}

export { buildSearchQuery };
