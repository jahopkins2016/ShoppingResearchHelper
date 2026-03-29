import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import CollectionsList from "./collections-list";
import styles from "./page.module.css";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .order("sort_order", { ascending: true });

  // Fetch cover image for each collection (first item with an image)
  const coverMap: Record<string, string> = {};
  if (collections && collections.length > 0) {
    const { data: coverItems } = await supabase
      .from("items")
      .select("collection_id, image_url")
      .in("collection_id", collections.map((c: any) => c.id))
      .not("image_url", "is", null)
      .order("sort_order", { ascending: true });

    if (coverItems) {
      for (const item of coverItems) {
        // Keep only the first image per collection
        if (!coverMap[item.collection_id] && item.image_url) {
          coverMap[item.collection_id] = item.image_url;
        }
      }
    }
  }

  // Fetch shared collections for the dashboard
  const { data: shares } = await supabase
    .from("collection_shares")
    .select("*, collections(*)")
    .eq("shared_with_user_id", user!.id)
    .eq("status", "accepted");

  const sharedItems =
    shares
      ?.map((s: any) => ({
        collection: s.collections,
        role: s.role,
        id: s.id,
      }))
      .filter((s: any) => s.collection) ?? [];

  return (
    <div>
      <CollectionsList initialCollections={collections ?? []} coverMap={coverMap} />

      {/* Shared with me section */}
      <section className={styles.sharedSection}>
        <div className={styles.sharedHeader}>
          <h2 className={styles.sharedTitle}>Shared with me</h2>
          <Link href="/shared" className={styles.viewAllLink}>
            View All →
          </Link>
        </div>
        {sharedItems.length === 0 ? (
          <p className={styles.sharedEmpty}>
            Collections shared with you will appear here.
          </p>
        ) : (
          <div className={styles.sharedList}>
            {sharedItems.slice(0, 4).map((item: any) => (
              <Link
                key={item.id}
                href={`/collections/${item.collection.id}`}
                className={styles.sharedRow}
              >
                <div className={styles.sharedRowThumb}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
                </div>
                <div className={styles.sharedRowInfo}>
                  <span className={styles.sharedRowName}>
                    {item.collection.name}
                  </span>
                  <span
                    className={`${styles.sharedRowRole} ${
                      item.role === "editor"
                        ? styles.roleEditor
                        : styles.roleViewer
                    }`}
                  >
                    {item.role === "editor" ? "Editor" : "Viewer"}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
