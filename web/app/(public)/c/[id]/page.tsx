import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default async function PublicCollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch collection — RLS only returns if is_public = true (for anon users)
  const { data: collection } = await supabase
    .from("collections")
    .select("*, profiles(display_name)")
    .eq("id", id)
    .eq("is_public", true)
    .is("archived_at", null)
    .single();

  if (!collection) {
    notFound();
  }

  // Fetch items in this collection
  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("collection_id", id)
    .order("sort_order", { ascending: true });

  return (
    <>
      <div className={styles.header}>
        <p className={styles.collectionLabel}>Public Collection</p>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{collection.name}</h1>
          {(items ?? []).length > 0 && (
            <span className={styles.itemCount}>
              {(items ?? []).length} Items
            </span>
          )}
        </div>
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
        {(collection as any).profiles?.display_name && (
          <p className={styles.owner}>
            Curated by {(collection as any).profiles.display_name}
          </p>
        )}
      </div>

      {(items ?? []).length === 0 ? (
        <div className={styles.empty}>
          <p>This collection is empty.</p>
        </div>
      ) : (
        <div className={styles.grid}>
          {(items ?? []).map((item: any) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.itemCard}
            >
              {item.image_url ? (
                <div className={styles.itemImage}>
                  <img src={item.image_url} alt={item.title || "Product"} />
                </div>
              ) : (
                <div className={styles.itemImagePlaceholder}>
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <polyline points="21 15 16 10 5 21" />
                  </svg>
                </div>
              )}
              <div className={styles.itemBody}>
                <h3 className={styles.itemTitle}>
                  {item.title || "Untitled Item"}
                </h3>
                {item.price && (
                  <span className={styles.itemPrice}>
                    {item.currency === "USD" ? "$" : item.currency ? item.currency + " " : ""}
                    {item.price}
                  </span>
                )}
                <span className={styles.itemDomain}>
                  {(() => {
                    try {
                      return new URL(item.url).hostname.replace("www.", "");
                    } catch {
                      return "";
                    }
                  })()}
                </span>
              </div>
            </a>
          ))}
        </div>
      )}

      <div className={styles.cta}>
        <p className={styles.ctaText}>
          Want to create your own collections?
        </p>
        <Link href="/login" className={styles.ctaBtn}>
          Sign up for SaveIt — it&apos;s free
        </Link>
      </div>
    </>
  );
}
