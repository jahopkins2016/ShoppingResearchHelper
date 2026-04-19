"use client";

import { useState, useMemo, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Ownership = "mine" | "shared_with_me";

type Collection = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
  archived_at: string | null;
  _ownership: Ownership;
  _sharedCount: number;
  _shareRole?: string;
  _ownerName?: string;
};

type PendingInvitation = {
  id: string;
  role: string;
  shared_by: string;
  created_at: string;
  collection: {
    id: string;
    name: string;
    description: string | null;
    archived_at: string | null;
  };
  sharer: {
    display_name: string | null;
    email: string | null;
  } | null;
};

type FilterKey =
  | "all"
  | "mine"
  | "shared_with_me"
  | "shared_by_me"
  | "public"
  | "pinned"
  | "archived";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mine", label: "Mine" },
  { key: "shared_with_me", label: "Shared with me" },
  { key: "shared_by_me", label: "Shared by me" },
  { key: "public", label: "Public" },
  { key: "pinned", label: "Pinned" },
  { key: "archived", label: "Archived" },
];

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
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return coverColors[Math.abs(hash) % coverColors.length];
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  return `${Math.floor(days / 30)} months ago`;
}

export default function CollectionsList({
  initialCollections,
  coverMap,
  pinnedIds: initialPinnedIds,
  itemCountMap,
  pendingInvitations: initialPending,
  userId,
}: {
  initialCollections: Collection[];
  coverMap: Record<string, string>;
  pinnedIds: string[];
  itemCountMap: Record<string, number>;
  pendingInvitations: PendingInvitation[];
  userId: string;
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [pending, setPending] = useState(initialPending);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(
    () => new Set(initialPinnedIds)
  );
  const [filter, setFilter] = useState<FilterKey>("all");
  const [respondingId, setRespondingId] = useState<string | null>(null);
  const router = useRouter();
  const supabase = createClient();

  const filteredCollections = useMemo(() => {
    const nonArchived = collections.filter((c) => !c.archived_at);
    if (filter === "archived") {
      return collections.filter((c) => c.archived_at);
    }
    switch (filter) {
      case "mine":
        return nonArchived.filter((c) => c._ownership === "mine");
      case "shared_with_me":
        return nonArchived.filter((c) => c._ownership === "shared_with_me");
      case "shared_by_me":
        return nonArchived.filter(
          (c) => c._ownership === "mine" && c._sharedCount > 0
        );
      case "public":
        return nonArchived.filter((c) => c.is_public);
      case "pinned":
        return nonArchived.filter((c) => pinnedSet.has(c.id));
      case "all":
      default:
        return nonArchived;
    }
  }, [collections, filter, pinnedSet]);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setCreating(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("collections")
      .insert({ name: name.trim(), user_id: user?.id, is_public: true })
      .select()
      .single();

    if (!error && data) {
      setCollections((prev) => [
        ...prev,
        {
          ...data,
          _ownership: "mine",
          _sharedCount: 0,
        } as Collection,
      ]);
      setName("");
      setShowForm(false);
    }
    setCreating(false);
    router.refresh();
  }

  async function handleTogglePublic(e: React.MouseEvent, c: Collection) {
    e.preventDefault();
    e.stopPropagation();
    const newPublic = !c.is_public;
    setCollections((prev) =>
      prev.map((col) => (col.id === c.id ? { ...col, is_public: newPublic } : col))
    );
    await supabase
      .from("collections")
      .update({ is_public: newPublic })
      .eq("id", c.id);
    router.refresh();
  }

  async function handleShare(e: React.MouseEvent, c: Collection) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = c.is_public
      ? `${window.location.origin}/c/${c.id}`
      : `${window.location.origin}/collections/${c.id}`;
    await navigator.clipboard.writeText(shareUrl);
    setCopiedId(c.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  async function handleTogglePin(e: React.MouseEvent, c: Collection) {
    e.preventDefault();
    e.stopPropagation();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isPinned = pinnedSet.has(c.id);

    if (isPinned) {
      setPinnedSet((prev) => {
        const next = new Set(prev);
        next.delete(c.id);
        return next;
      });
      await supabase
        .from("pinned_collections")
        .delete()
        .eq("user_id", user.id)
        .eq("collection_id", c.id);
    } else {
      setPinnedSet((prev) => new Set(prev).add(c.id));
      const nextOrder = pinnedSet.size;
      await supabase.from("pinned_collections").insert({
        user_id: user.id,
        collection_id: c.id,
        sort_order: nextOrder,
      });
    }
    router.refresh();
  }

  async function handleRespondInvite(shareId: string, accept: boolean) {
    setRespondingId(shareId);
    try {
      const { error } = await supabase
        .from("collection_shares")
        .update({
          status: accept ? "accepted" : "declined",
          shared_with_user_id: userId,
        })
        .eq("id", shareId);
      if (error) return;
      setPending((prev) => prev.filter((inv) => inv.id !== shareId));
      router.refresh();
    } finally {
      setRespondingId(null);
    }
  }

  return (
    <>
      {pending.length > 0 && (
        <div className={styles.pendingSection}>
          <h2 className={styles.pendingTitle}>
            Pending Invitations
            <span className={styles.pendingCount}>{pending.length}</span>
          </h2>
          <div className={styles.pendingList}>
            {pending.map((inv) => (
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
                      {inv.sharer?.display_name ||
                        inv.sharer?.email ||
                        "Someone"}
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
                    onClick={() => handleRespondInvite(inv.id, true)}
                    disabled={respondingId === inv.id}
                  >
                    {respondingId === inv.id ? "…" : "Accept"}
                  </button>
                  <button
                    className={styles.declineBtn}
                    onClick={() => handleRespondInvite(inv.id, false)}
                    disabled={respondingId === inv.id}
                  >
                    Decline
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>Collections</h1>
          <span className={styles.count}>
            {filteredCollections.length} collection
            {filteredCollections.length === 1 ? "" : "s"}
          </span>
        </div>
        <div className={styles.headerRight}>
          <button
            className={styles.createBtn}
            onClick={() => setShowForm(true)}
          >
            + Create Collection
          </button>
        </div>
      </div>

      <div className={styles.filterBar}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`${styles.filterChip} ${
              filter === f.key ? styles.filterChipActive : ""
            }`}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showForm && (
        <form className={styles.form} onSubmit={handleCreate}>
          <input
            className={styles.formInput}
            type="text"
            placeholder="Collection name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.cancelButton}
              onClick={() => {
                setShowForm(false);
                setName("");
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className={styles.createButton}
              disabled={creating || !name.trim()}
            >
              {creating ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      )}

      {filteredCollections.length === 0 && !showForm ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>
            {filter === "archived"
              ? "No archived collections."
              : "No collections yet."}
          </p>
          <p className={styles.emptySubtext}>
            {filter === "archived"
              ? "Archived collections will appear here."
              : "Create your first collection to start saving items."}
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {filteredCollections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className={`${styles.card} ${
                c.archived_at ? styles.cardArchived : ""
              }`}
              draggable={false}
            >
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
                <div className={styles.cardCoverBadges}>
                  {c._ownership === "shared_with_me" && (
                    <span className={styles.coverBadge}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {c._shareRole === "editor" ? "Editor" : "Viewer"}
                    </span>
                  )}
                  {c._ownership === "mine" && c._sharedCount > 0 && (
                    <span className={styles.coverBadge}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                      {c._sharedCount} shared
                    </span>
                  )}
                  {c.archived_at && (
                    <span className={styles.coverBadge}>Archived</span>
                  )}
                </div>
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardBodyRow}>
                  <div>
                    <h2 className={styles.cardTitle}>{c.name}</h2>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardItemCount}>
                        {itemCountMap[c.id] ?? 0}{" "}
                        {(itemCountMap[c.id] ?? 0) === 1 ? "item" : "items"}
                      </span>
                      <span className={styles.cardMetaDot}>·</span>
                      <span className={styles.cardUpdated}>
                        {c._ownership === "shared_with_me" && c._ownerName
                          ? `by ${c._ownerName}`
                          : `Updated ${timeAgo(c.created_at)}`}
                      </span>
                    </div>
                  </div>
                  {c._ownership === "mine" && (
                    <div className={styles.cardActions}>
                      <button
                        className={`${styles.visibilityBtn} ${
                          c.is_public ? styles.visibilityBtnPublic : ""
                        }`}
                        onClick={(e) => handleTogglePublic(e, c)}
                        aria-label={c.is_public ? "Make private" : "Make public"}
                        title={
                          c.is_public
                            ? "Public — click to make private"
                            : "Private — click to make public"
                        }
                      >
                        {c.is_public ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                        )}
                      </button>
                      <button
                        className={`${styles.pinBtn} ${
                          pinnedSet.has(c.id) ? styles.pinBtnActive : ""
                        }`}
                        onClick={(e) => handleTogglePin(e, c)}
                        aria-label={
                          pinnedSet.has(c.id)
                            ? `Unpin ${c.name}`
                            : `Pin ${c.name}`
                        }
                        title={
                          pinnedSet.has(c.id)
                            ? "Unpin from sidebar"
                            : "Pin to sidebar"
                        }
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill={pinnedSet.has(c.id) ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
                      </button>
                      <button
                        className={styles.shareBtn}
                        onClick={(e) => handleShare(e, c)}
                        aria-label={
                          copiedId === c.id ? "Link copied" : "Share collection"
                        }
                        title={copiedId === c.id ? "Link copied!" : "Share"}
                      >
                        {copiedId === c.id ? (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                        ) : (
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                        )}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </Link>
          ))}

          {filter !== "archived" && (
            <button
              className={styles.cardNew}
              onClick={() => setShowForm(true)}
            >
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Create New Collection</span>
            </button>
          )}
        </div>
      )}

      <button
        className={styles.fab}
        onClick={() => setShowForm(true)}
        aria-label="New collection"
      >
        +
      </button>
    </>
  );
}
