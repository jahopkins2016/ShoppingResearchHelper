import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";

export default async function CollectionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: collection } = await supabase
    .from("collections")
    .select("*")
    .eq("id", id)
    .single();

  if (!collection) {
    notFound();
  }

  const { data: items } = await supabase
    .from("items")
    .select("*")
    .eq("collection_id", id)
    .order("sort_order", { ascending: true });

  return (
    <div>
      <div className={styles.header}>
        <Link href="/collections" className={styles.back}>
          ← Collections
        </Link>
        <p className={styles.collectionLabel}>Curated Collection</p>
        <div className={styles.headerRow}>
          <h1 className={styles.title}>{collection.name}</h1>
          {items && items.length > 0 && (
            <span className={styles.itemCount}>{items.length} Items</span>
          )}
        </div>
        {collection.description && (
          <p className={styles.description}>{collection.description}</p>
        )}
      </div>

      {!items || items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No items yet.</p>
          <p className={styles.emptySubtext}>
            Use the browser extension or share sheet to save items here.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {items.map((item) => (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.card}
            >
              {item.image_url && (
                <div className={styles.imageWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={item.image_url}
                    alt={item.title ?? ""}
                    className={styles.image}
                  />
                  {item.price && (
                    <span className={styles.price}>
                      {item.currency ?? "$"}{item.price}
                    </span>
                  )}
                </div>
              )}
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>
                  {item.title ?? item.url}
                </h2>
                {item.site_name && (
                  <p className={styles.siteName}>{item.site_name}</p>
                )}
                {item.notes && (
                  <p className={styles.notes}>{item.notes}</p>
                )}
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
