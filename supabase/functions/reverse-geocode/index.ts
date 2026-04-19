// Reverse-geocode a lat/lng to the nearest store using Google Places.
// Input:  { latitude: number, longitude: number }
// Output: { store_name: string | null, address: string | null }
//
// Uses Nearby Search ranked by distance so we pick the closest place — usually
// the store the user is physically in. The Flutter capture sheet calls this in
// parallel with the vision enrichment and merges the result into the form.

const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  if (!req.headers.get("Authorization")) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!googleKey) {
    return json({ error: "GOOGLE_PLACES_API_KEY not configured" }, 500);
  }

  let latitude: number;
  let longitude: number;
  try {
    const body = await req.json();
    latitude = Number(body.latitude);
    longitude = Number(body.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      throw new Error("bad coords");
    }
  } catch {
    return json(
      { error: "Invalid request body — expected { latitude, longitude }" },
      400,
    );
  }

  try {
    // Rank-by-distance requires no radius and at least one of keyword/type.
    // `store` catches most retail; fall back to broader search if empty.
    const nearby =
      `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
      `?location=${latitude},${longitude}` +
      `&rankby=distance&type=store` +
      `&key=${googleKey}`;
    const resp = await fetch(nearby);
    const data = await resp.json();

    const first = (data.results ?? [])[0];
    if (!first) {
      return json({ store_name: null, address: null });
    }

    return json({
      store_name: first.name ?? null,
      address: first.vicinity ?? first.formatted_address ?? null,
    });
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
