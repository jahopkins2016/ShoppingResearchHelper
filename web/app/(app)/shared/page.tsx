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

  const collections = shares?.map((s: any) => s.collections).filter(Boolean) ?? [];

  return (
    <div>
      <h1 className={styles.title}>Shared With Me</h1>

      {collections.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>Nothing shared yet.</p>
          <p className={styles.emptySubtext}>
            Collections others have shared with you will appear here.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {collections.map((c: any) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className={styles.card}
            >
              <h2 className={styles.cardTitle}>{c.name}</h2>
              {c.description && (
                <p className={styles.cardDescription}>{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
