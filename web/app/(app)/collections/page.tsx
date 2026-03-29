import { createClient } from "@/lib/supabase/server";
import CollectionsList from "./collections-list";
import styles from "./page.module.css";

export default async function CollectionsPage() {
  const supabase = await createClient();
  const { data: collections } = await supabase
    .from("collections")
    .select("*")
    .order("sort_order", { ascending: true });

  return (
    <div>
      <div className={styles.header}>
        <h1 className={styles.title}>My Collections</h1>
        <p className={styles.subtitle}>Your private archive of inspiration.</p>
      </div>
      <CollectionsList initialCollections={collections ?? []} />
    </div>
  );
}
