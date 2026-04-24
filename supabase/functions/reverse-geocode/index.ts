// Reverse-geocode a lat/lng to the nearest store using Google Places.
// Input:  { latitude: number, longitude: number }
// Output: { store_name: string | null, address: string | null }
//
// Uses Nearby Search ranked by distance so we pick the closest place — usually
// the store the user is physically in. The Flutter capture sheet calls this in
// parallel with the vision enrichment and merges the result into the form.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
const googleKey = Deno.env.get("GOOGLE_PLACES_API_KEY");

// Daily per-user cap. Reverse-geocode is called once per in-store capture,
// so 200/day is generous for legitimate use and tight enough to bound cost.
const DAILY_QUOTA = 200;

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return json({ error: "Unauthorized" }, 401);
  }
  if (!googleKey) {
    return json(
      {
        error: "GOOGLE_PLACES_API_KEY not configured",
        code: "service_unavailable",
        user_message: "Store lookup is temporarily unavailable.",
      },
      503,
    );
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

  // User-scoped client so the quota RPC sees auth.uid() = the caller.
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: quota, error: quotaError } = await userClient.rpc(
    "check_and_increment_quota",
    { p_kind: "reverse_geocode", p_limit: DAILY_QUOTA },
  );
  if (quotaError) {
    return json({ error: `Quota check failed: ${quotaError.message}` }, 500);
  }
  const row = Array.isArray(quota) ? quota[0] : quota;
  if (!row?.allowed) {
    // Geocode is best-effort on the client — return a clear code so the
    // app can stay quiet about it rather than show a scary error.
    return json(
      {
        error: "Daily quota exceeded",
        code: "quota_exceeded",
        user_message: "Store lookup limit reached for today.",
      },
      429,
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

    // Google signals quota/billing problems via the `status` field, not HTTP.
    // OVER_QUERY_LIMIT / OVER_DAILY_LIMIT = our GCP cap was hit.
    // REQUEST_DENIED = key invalid or billing disabled.
    if (data.status === "OVER_QUERY_LIMIT" || data.status === "OVER_DAILY_LIMIT") {
      return json(
        {
          error: `Google Places quota: ${data.status}`,
          code: "service_unavailable",
          user_message: "Store lookup is temporarily unavailable.",
        },
        503,
      );
    }
    if (data.status === "REQUEST_DENIED") {
      return json(
        {
          error: `Google Places denied: ${data.error_message ?? "no detail"}`,
          code: "service_unavailable",
          user_message: "Store lookup is temporarily unavailable.",
        },
        503,
      );
    }

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
