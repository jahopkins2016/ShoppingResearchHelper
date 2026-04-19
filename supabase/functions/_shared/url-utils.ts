// Google's share UI often hands us a wrapper URL pointing back at Google
// (search results, image viewer, Lens, AMP) with the real destination in a
// query param. When we can pull out the real destination, enrichment works.
// Otherwise we return the original URL untouched.
export function unwrapGoogleUrl(raw: string): string {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return raw;
  }
  if (!u.hostname.toLowerCase().includes("google.")) return raw;

  const preferredKeys = ["imgrefurl", "url", "q", "u"];
  for (const key of preferredKeys) {
    const v = u.searchParams.get(key);
    if (!v) continue;
    try {
      const inner = new URL(v);
      if (
        (inner.protocol === "http:" || inner.protocol === "https:") &&
        !inner.hostname.toLowerCase().includes("google.")
      ) {
        return inner.toString();
      }
    } catch {
      continue;
    }
  }
  return raw;
}

// Derive a readable title from a URL when page extraction returns nothing.
// "https://example.com/chairs/velvet-dining-chair-set-of-2" becomes
// "Velvet Dining Chair Set Of 2 — example.com".
export function titleFromUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./i, "");
    const segments = u.pathname.split("/").filter(Boolean);
    const last = segments[segments.length - 1] || "";
    const slug = decodeURIComponent(last)
      .replace(/\.[a-z0-9]{1,5}$/i, "")
      .replace(/[-_+]+/g, " ")
      .trim();
    if (!slug) return host;
    const cased = slug
      .split(" ")
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" ");
    return `${cased} — ${host}`;
  } catch {
    return raw;
  }
}
