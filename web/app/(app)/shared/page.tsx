import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import styles from "./page.module.css";
import PendingInvitations from "./pending-invitations";

export default async function SharedPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Get user's email for matching pending invitations
  const { data: profile } = await supabase
    .from("profiles")
    .select("email")
    .eq("id", user!.id)
    .single();

  const userEmail = profile?.email ?? user!.email;

  // Fetch pending invitations (matched by email)
  const { data: pendingShares } = await supabase
    .from("collection_shares")
    .select("id, role, shared_by, created_at, collections(id, name, description), profiles!collection_shares_shared_by_fkey(display_name, email)")
    .eq("shared_with_email", userEmail!)
    .eq("status", "pending");

  const pendingInvitations = pendingShares?.map((s: any) => ({
    id: s.id,
    role: s.role,
    shared_by: s.shared_by,
    created_at: s.created_at,
    collection: s.collections,
    sharer: s.profiles,
  })).filter((s: any) => s.collection) ?? [];

  // Fetch accepted shares
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

      <PendingInvitations initialInvitations={pendingInvitations} userId={user!.id} />

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {pendingInvitations.length > 0
              ? "No accepted collections yet."
              : "Nothing shared yet."}
          </p>
          <p className={styles.emptySubtext}>
            {pendingInvitations.length > 0
              ? "Accept an invitation above to see its collection here."
              : "Collections others have shared with you will appear here."}
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
