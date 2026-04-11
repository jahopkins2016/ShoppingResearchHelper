import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

// Gradient fallbacks for collections without cover images
const coverColors = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #f093fb 0%, #f5576c 100%)",
  "linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)",
  "linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
];

function getCoverGradient(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++)
    hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return coverColors[Math.abs(hash) % coverColors.length];
}

export default async function BrowsePublicCollectionsPage() {
  const supabase = await createClient();

  // Fetch all public collections with owner profile
  const { data: collections } = await supabase
    .from("collections")
    .select("id, name, description, created_at, user_id, profiles(display_name)")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  // Fetch item counts for all public collections
  const collectionIds = (collections ?? []).map((c: any) => c.id);
  let itemCountMap: Record<string, number> = {};
  let coverMap: Record<string, string> = {};

  if (collectionIds.length > 0) {
    const { data: itemRows } = await supabase
      .from("items")
      .select("collection_id, image_url")
      .in("collection_id", collectionIds);

    if (itemRows) {
      for (const row of itemRows) {
        itemCountMap[row.collection_id] =
          (itemCountMap[row.collection_id] ?? 0) + 1;
        // Use first item image as cover
        if (!coverMap[row.collection_id] && row.image_url) {
          coverMap[row.collection_id] = row.image_url;
        }
      }
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>Browse Public Collections</h1>
        <p className={styles.subtitle}>
          Discover curated collections from the SaveIt community
        </p>
      </div>

      {(collections ?? []).length === 0 ? (
        <div className={styles.empty}>
          <p>No public collections yet. Be the first to share!</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {(collections ?? []).map((c: any) => (
            <Link key={c.id} href={`/c/${c.id}`} className={styles.card}>
              <div
                className={styles.cardCover}
                style={
                  coverMap[c.id]
                    ? {
                        backgroundImage: `url(${coverMap[c.id]})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }
                    : { background: getCoverGradient(c.id) }
                }
              >
                <div className={styles.cardOverlay} />
              </div>
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{c.name}</h2>
                {c.description && (
                  <p className={styles.cardDescription}>{c.description}</p>
                )}
                <div className={styles.cardMeta}>
                  <span className={styles.cardItemCount}>
                    {itemCountMap[c.id] ?? 0}{" "}
                    {(itemCountMap[c.id] ?? 0) === 1 ? "item" : "items"}
                  </span>
                  {c.profiles?.display_name && (
                    <>
                      <span className={styles.cardMetaDot}>·</span>
                      <span className={styles.cardOwner}>
                        by {c.profiles.display_name}
                      </span>
                    </>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
