"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface Comparison {
  id: string;
  name: string;
  created_at: string;
  item_count: number;
}

export default function ComparePage() {
  const [comparisons, setComparisons] = useState<Comparison[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: rows } = await supabase
        .from("item_comparisons")
        .select("id, name, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!rows) {
        setLoading(false);
        return;
      }

      // Fetch item counts per comparison
      const ids = rows.map((r) => r.id);
      let countMap: Record<string, number> = {};
      if (ids.length > 0) {
        const { data: ciRows } = await supabase
          .from("comparison_items")
          .select("comparison_id")
          .in("comparison_id", ids);

        if (ciRows) {
          for (const ci of ciRows) {
            countMap[ci.comparison_id] =
              (countMap[ci.comparison_id] ?? 0) + 1;
          }
        }
      }

      setComparisons(
        rows.map((r) => ({
          ...r,
          item_count: countMap[r.id] ?? 0,
        }))
      );
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCreate() {
    setCreating(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("item_comparisons")
        .insert({ user_id: user.id, name: "Untitled Comparison" })
        .select()
        .single();

      if (error || !data) return;

      router.push(`/compare/${data.id}`);
    } finally {
      setCreating(false);
    }
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  if (loading) {
    return null;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Compare</h1>
          {comparisons.length > 0 && (
            <span className={styles.count}>{comparisons.length}</span>
          )}
        </div>
        <button
          className={styles.createBtn}
          onClick={handleCreate}
          disabled={creating}
        >
          {creating ? "Creating…" : "+ New Comparison"}
        </button>
      </div>

      {comparisons.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No comparisons yet.</p>
          <p className={styles.emptySubtext}>
            Create a comparison to view items side by side.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {comparisons.map((c) => (
            <a
              key={c.id}
              href={`/compare/${c.id}`}
              className={styles.card}
              onClick={(e) => {
                e.preventDefault();
                router.push(`/compare/${c.id}`);
              }}
            >
              <span className={styles.cardName}>{c.name}</span>
              <span className={styles.cardMeta}>
                <span>
                  {c.item_count} {c.item_count === 1 ? "item" : "items"}
                </span>
                <span className={styles.cardDot}>·</span>
                <span>{formatDate(c.created_at)}</span>
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
