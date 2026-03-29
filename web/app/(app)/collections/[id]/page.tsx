import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import CollectionItems from "./collection-items";
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

      <CollectionItems initialItems={items ?? []} collectionId={id} />
    </div>
  );
}
