import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default async function SharedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: shares } = await supabase
    .from("collection_shares")
    .select("*, collections(*)")
    .eq("shared_with_user_id", user!.id)
    .eq("status", "accepted");

  const items = shares?.map((s: any) => ({
    collection: s.collections,
    role: s.role,
    id: s.id,
  })).filter((s: any) => s.collection) ?? [];

  return (
    <div>
      <h1 className={styles.title}>Shared With Me</h1>
      <p className={styles.subtitle}>Collections curated by others, curated for you.</p>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Nothing shared yet.</p>
          <p className={styles.emptySubtext}>
            Collections others have shared with you will appear here.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item: any) => (
            <Link
              key={item.id}
              href={`/collections/${item.collection.id}`}
              className={styles.card}
            >
              <div className={styles.cardContent}>
                <h2 className={styles.cardTitle}>{item.collection.name}</h2>
                <div className={styles.badgeRow}>
                  <span className={`${styles.badge} ${item.role === 'editor' ? styles.badgeEditor : styles.badgeViewer}`}>
                    {item.role === 'editor' ? 'EDITOR' : 'VIEWER'}
                  </span>
                </div>
                {item.collection.description && (
                  <p className={styles.cardDescription}>{item.collection.description}</p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
