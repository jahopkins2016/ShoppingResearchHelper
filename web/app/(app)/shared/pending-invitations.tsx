"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface PendingShare {
  id: string;
  role: string;
  shared_by: string;
  created_at: string;
  collection: {
    id: string;
    name: string;
    description: string | null;
  };
  sharer: {
    display_name: string | null;
    email: string | null;
  };
}

export default function PendingInvitations({
  initialInvitations,
  userId,
}: {
  initialInvitations: PendingShare[];
  userId: string;
}) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  async function handleRespond(shareId: string, accept: boolean) {
    setLoadingId(shareId);
    try {
      const { error } = await supabase
        .from("collection_shares")
        .update({
          status: accept ? "accepted" : "declined",
          shared_with_user_id: userId,
        })
        .eq("id", shareId);

      if (error) {
        console.error("Failed to respond to invitation:", error.message);
        return;
      }

      setInvitations((prev) => prev.filter((inv) => inv.id !== shareId));
      router.refresh();
    } finally {
      setLoadingId(null);
    }
  }

  if (invitations.length === 0) return null;

  return (
    <div className={styles.pendingSection}>
      <h2 className={styles.pendingTitle}>
        Pending Invitations
        <span className={styles.pendingCount}>{invitations.length}</span>
      </h2>
      <div className={styles.pendingList}>
        {invitations.map((inv) => (
          <div key={inv.id} className={styles.pendingCard}>
            <div className={styles.pendingCardContent}>
              <div className={styles.pendingCardHeader}>
                <h3 className={styles.pendingCardTitle}>
                  {inv.collection.name}
                </h3>
                <span
                  className={`${styles.badge} ${
                    inv.role === "editor"
                      ? styles.badgeEditor
                      : styles.badgeViewer
                  }`}
                >
                  {inv.role === "editor" ? "EDITOR" : "VIEWER"}
                </span>
              </div>
              <p className={styles.pendingCardFrom}>
                From{" "}
                <strong>
                  {inv.sharer.display_name || inv.sharer.email || "Someone"}
                </strong>
              </p>
              {inv.collection.description && (
                <p className={styles.pendingCardDesc}>
                  {inv.collection.description}
                </p>
              )}
            </div>
            <div className={styles.pendingCardActions}>
              <button
                className={styles.acceptBtn}
                onClick={() => handleRespond(inv.id, true)}
                disabled={loadingId === inv.id}
              >
                {loadingId === inv.id ? "…" : "Accept"}
              </button>
              <button
                className={styles.declineBtn}
                onClick={() => handleRespond(inv.id, false)}
                disabled={loadingId === inv.id}
              >
                Decline
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
