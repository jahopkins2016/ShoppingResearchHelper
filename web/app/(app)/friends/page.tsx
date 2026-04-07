"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Friend = {
  id: string;
  friend_id: string;
  source: string;
  created_at: string;
  profile: {
    display_name: string | null;
    email: string | null;
    avatar_url: string | null;
  } | null;
};

export default function FriendsPage() {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  const loadFriends = useCallback(
    async (uid: string) => {
      const { data } = await supabase
        .from("friends")
        .select("id, friend_id, source, created_at, profile:profiles!friends_friend_id_fkey(display_name, email, avatar_url)")
        .eq("user_id", uid)
        .order("created_at", { ascending: false });

      setFriends((data as Friend[] | null) ?? []);
      setLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    async function init() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);
      await loadFriends(user.id);
    }
    init();
  }, [loadFriends]);

  async function handleSync() {
    if (!userId) return;
    setSyncing(true);

    // Find all users the current user has shared with
    const { data: sharedBy } = await supabase
      .from("collection_shares")
      .select("shared_with_user_id")
      .eq("shared_by", userId)
      .not("shared_with_user_id", "is", null);

    // Find all users who have shared with the current user
    const { data: sharedWith } = await supabase
      .from("collection_shares")
      .select("shared_by")
      .eq("shared_with_user_id", userId);

    // Collect unique friend user IDs
    const friendIds = new Set<string>();
    sharedBy?.forEach((r) => {
      if (r.shared_with_user_id && r.shared_with_user_id !== userId) {
        friendIds.add(r.shared_with_user_id);
      }
    });
    sharedWith?.forEach((r) => {
      if (r.shared_by && r.shared_by !== userId) {
        friendIds.add(r.shared_by);
      }
    });

    // Get existing friend IDs to avoid duplicates
    const { data: existing } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", userId);

    const existingIds = new Set((existing ?? []).map((e) => e.friend_id));

    // Also check reverse entries to avoid inserting duplicates for the friend's side
    const newFriendIds = [...friendIds].filter((fid) => !existingIds.has(fid));

    if (newFriendIds.length > 0) {
      // Only insert forward entries (current user -> friend).
      // Reverse entries (friend -> current user) can't be inserted from
      // the client because RLS restricts inserts to user_id = auth.uid().
      // The friend will get their entry when they sync from their side.
      const rows = newFriendIds.map((fid) => ({
        user_id: userId,
        friend_id: fid,
        source: "share",
      }));

      const { error } = await supabase.from("friends").insert(rows);
      if (error) {
        console.error("Failed to sync friends:", error);
        setSyncing(false);
        showToast("Failed to sync friends. Please try again.");
        return;
      }
    }

    await loadFriends(userId);
    setSyncing(false);
    showToast(
      newFriendIds.length > 0
        ? `Synced ${newFriendIds.length} new friend${newFriendIds.length > 1 ? "s" : ""}!`
        : "All friends are already synced."
    );
  }

  async function handleRemove(friendRow: Friend) {
    if (!userId) return;
    setRemovingId(friendRow.id);

    // Remove forward entry
    await supabase.from("friends").delete().eq("id", friendRow.id);

    // Remove reverse entry if it exists
    await supabase
      .from("friends")
      .delete()
      .eq("user_id", friendRow.friend_id)
      .eq("friend_id", userId);

    setFriends((prev) => prev.filter((f) => f.id !== friendRow.id));
    setRemovingId(null);
  }

  function handleMessage(friendId: string) {
    router.push(`/messages?to=${friendId}`);
  }

  function getInitial(profile: Friend["profile"]): string {
    if (profile?.display_name) return profile.display_name.charAt(0).toUpperCase();
    if (profile?.email) return profile.email.charAt(0).toUpperCase();
    return "?";
  }

  function getDisplayName(profile: Friend["profile"]): string {
    if (profile?.display_name) return profile.display_name;
    if (profile?.email) return profile.email.split("@")[0];
    return "Unknown";
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString(undefined, {
      month: "short",
      year: "numeric",
    });
  }

  if (loading) {
    return <div className={styles.loading}>Loading friends…</div>;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Friends</h1>
          {friends.length > 0 && (
            <span className={styles.count}>{friends.length}</span>
          )}
        </div>
        <button
          className={styles.syncBtn}
          onClick={handleSync}
          disabled={syncing}
        >
          <span
            className={`${styles.syncIcon} ${syncing ? styles.syncIconSpinning : ""}`}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21.5 2v6h-6" />
              <path d="M2.5 22v-6h6" />
              <path d="M2 11.5a10 10 0 0 1 18.8-4.3" />
              <path d="M22 12.5a10 10 0 0 1-18.8 4.3" />
            </svg>
          </span>
          {syncing ? "Syncing…" : "Sync Friends"}
        </button>
      </div>

      {friends.length === 0 ? (
        <div className={styles.empty}>
          <div className={styles.emptyIcon}>👥</div>
          <div className={styles.emptyTitle}>No friends yet</div>
          <p className={styles.emptyText}>
            Friends are discovered when you share collections with others, or
            when someone shares a collection with you. Click &quot;Sync
            Friends&quot; to scan your shared collections and add contacts.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {friends.map((friend) => (
            <div key={friend.id} className={styles.card}>
              <div className={styles.avatar}>
                {friend.profile?.avatar_url ? (
                  <img
                    src={friend.profile.avatar_url}
                    alt=""
                    className={styles.avatarImg}
                  />
                ) : (
                  getInitial(friend.profile)
                )}
              </div>
              <div className={styles.info}>
                <div className={styles.name}>
                  {getDisplayName(friend.profile)}
                </div>
                {friend.profile?.email && (
                  <div className={styles.email}>{friend.profile.email}</div>
                )}
                <div className={styles.meta}>
                  <span className={styles.since}>
                    Friends since {formatDate(friend.created_at)}
                  </span>
                  <span className={styles.sourceBadge}>{friend.source}</span>
                </div>
              </div>
              <div className={styles.actions}>
                <button
                  className={styles.messageBtn}
                  onClick={() => handleMessage(friend.friend_id)}
                >
                  Message
                </button>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemove(friend)}
                  disabled={removingId === friend.id}
                >
                  {removingId === friend.id ? "…" : "Remove"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && <div className={styles.toast}>{toast}</div>}
    </div>
  );
}
