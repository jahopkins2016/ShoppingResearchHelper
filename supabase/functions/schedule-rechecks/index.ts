import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(supabaseUrl, serviceRoleKey);

const BATCH_SIZE = 10;
const STALE_HOURS = 24;

Deno.serve(async (req) => {
  // ── Auth check ──
  const authHeader = req.headers.get("Authorization");
  if (authHeader !== `Bearer ${serviceRoleKey}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // ── 1. Fetch all non-archived items ──
    const { data: items, error: itemsError } = await supabase
      .from("items")
      .select("id")
      .eq("is_archived", false);

    if (itemsError) throw itemsError;
    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ total_items: 0, rechecked: 0, errors: 0 }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 2. Get latest check time per item from price_history ──
    const itemIds = items.map((i) => i.id);

    // Fetch the most recent price_history row per item
    // We query all history for these items ordered by checked_at desc,
    // then deduplicate to latest per item in code.
    const { data: history, error: historyError } = await supabase
      .from("price_history")
      .select("item_id, checked_at")
      .in("item_id", itemIds)
      .order("checked_at", { ascending: false });

    if (historyError) throw historyError;

    // Build a map: item_id -> latest checked_at
    const latestCheckMap = new Map<string, string>();
    for (const row of history ?? []) {
      if (!latestCheckMap.has(row.item_id)) {
        latestCheckMap.set(row.item_id, row.checked_at);
      }
    }

    // ── 3. Filter to stale items ──
    const cutoff = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);
    const staleItemIds = itemIds.filter((id) => {
      const lastCheck = latestCheckMap.get(id);
      if (!lastCheck) return true; // never checked
      return new Date(lastCheck) < cutoff;
    });

    if (staleItemIds.length === 0) {
      return new Response(
        JSON.stringify({
          total_items: items.length,
          rechecked: 0,
          errors: 0,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ── 4. Invoke enrich-item in batches ──
    let rechecked = 0;
    let errors = 0;
    const enrichUrl = `${supabaseUrl}/functions/v1/enrich-item`;

    for (let i = 0; i < staleItemIds.length; i += BATCH_SIZE) {
      const batch = staleItemIds.slice(i, i + BATCH_SIZE);
      const results = await Promise.all(
        batch.map(async (itemId) => {
          try {
            const res = await fetch(enrichUrl, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceRoleKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ item_id: itemId }),
            });
            if (!res.ok) {
              console.error(
                `enrich-item failed for ${itemId}: ${res.status} ${await res.text()}`
              );
              return false;
            }
            return true;
          } catch (err) {
            console.error(`enrich-item error for ${itemId}:`, err);
            return false;
          }
        })
      );

      for (const ok of results) {
        if (ok) rechecked++;
        else errors++;
      }
    }

    return new Response(
      JSON.stringify({
        total_items: items.length,
        rechecked,
        errors,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("schedule-rechecks error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
