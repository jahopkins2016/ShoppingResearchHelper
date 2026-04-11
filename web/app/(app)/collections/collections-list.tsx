"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

type Collection = {
  id: string;
  name: string;
  description: string | null;
  is_public: boolean;
  created_at: string;
};

// Placeholder cover colors for collections without images
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
}: {
  initialCollections: Collection[];
  coverMap: Record<string, string>;
  pinnedIds: string[];
  itemCountMap: Record<string, number>;
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pinnedSet, setPinnedSet] = useState<Set<string>>(() => new Set(initialPinnedIds));
  const router = useRouter();
  const supabase = createClient();

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
      setCollections((prev) => [...prev, data]);
      setName("");
      setShowForm(false);
    }
    setCreating(false);
    router.refresh();
  }

  async function handleTogglePublic(e: React.MouseEvent, collection: Collection) {
    e.preventDefault();
    e.stopPropagation();
    const newPublic = !collection.is_public;
    setCollections((prev) =>
      prev.map((c) => (c.id === collection.id ? { ...c, is_public: newPublic } : c))
    );
    await supabase
      .from("collections")
      .update({ is_public: newPublic })
      .eq("id", collection.id);
    router.refresh();
  }

  async function handleShare(e: React.MouseEvent, collection: Collection) {
    e.preventDefault();
    e.stopPropagation();
    const shareUrl = collection.is_public
      ? `${window.location.origin}/c/${collection.id}`
      : `${window.location.origin}/collections/${collection.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: collection.name,
          text: `Check out my collection "${collection.name}" on SaveIt`,
          url: shareUrl,
        });
      } catch {
        // User cancelled
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setCopiedId(collection.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  async function handleTogglePin(e: React.MouseEvent, collection: Collection) {
    e.preventDefault();
    e.stopPropagation();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const isPinned = pinnedSet.has(collection.id);

    if (isPinned) {
      setPinnedSet((prev) => {
        const next = new Set(prev);
        next.delete(collection.id);
        return next;
      });
      await supabase
        .from("pinned_collections")
        .delete()
        .eq("user_id", user.id)
        .eq("collection_id", collection.id);
    } else {
      setPinnedSet((prev) => new Set(prev).add(collection.id));
      const nextOrder = pinnedSet.size;
      await supabase.from("pinned_collections").insert({
        user_id: user.id,
        collection_id: collection.id,
        sort_order: nextOrder,
      });
    }
    router.refresh();
  }

  return (
    <>
      {/* Page header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h1 className={styles.title}>My Collections</h1>
          <span className={styles.count}>{collections.length} collections</span>
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

      {/* Create form modal */}
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

      {collections.length === 0 && !showForm ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No collections yet.</p>
          <p className={styles.emptySubtext}>
            Create your first collection to start saving items.
          </p>
        </div>
      ) : (
        <div className={styles.grid}>
          {collections.map((c) => (
            <Link
              key={c.id}
              href={`/collections/${c.id}`}
              className={styles.card}
              draggable={false}
            >
              <div
                className={styles.cardCover}
                style={
                  coverMap[c.id]
                    ? { backgroundImage: `url(${coverMap[c.id]})`, backgroundSize: "cover", backgroundPosition: "center" }
                    : { background: getCoverGradient(c.id) }
                }
              >
                <div className={styles.cardOverlay} />
              </div>
              <div className={styles.cardBody}>
                <div className={styles.cardBodyRow}>
                  <div>
                    <h2 className={styles.cardTitle}>{c.name}</h2>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardItemCount}>
                        {itemCountMap[c.id] ?? 0} {(itemCountMap[c.id] ?? 0) === 1 ? 'item' : 'items'}
                      </span>
                      <span className={styles.cardMetaDot}>·</span>
                      <span className={styles.cardUpdated}>
                        Updated {timeAgo(c.created_at)}
                      </span>
                    </div>
                  </div>
                  <div className={styles.cardActions}>
                  <button
                    className={`${styles.visibilityBtn} ${c.is_public ? styles.visibilityBtnPublic : ''}`}
                    onClick={(e) => handleTogglePublic(e, c)}
                    aria-label={c.is_public ? 'Make private' : 'Make public'}
                    title={c.is_public ? 'Public — click to make private' : 'Private — click to make public'}
                  >
                    {c.is_public ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                    )}
                  </button>
                  <button
                    className={`${styles.pinBtn} ${pinnedSet.has(c.id) ? styles.pinBtnActive : ''}`}
                    onClick={(e) => handleTogglePin(e, c)}
                    aria-label={pinnedSet.has(c.id) ? `Unpin ${c.name}` : `Pin ${c.name}`}
                    title={pinnedSet.has(c.id) ? 'Unpin from sidebar' : 'Pin to sidebar'}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill={pinnedSet.has(c.id) ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
                  </button>
                  <button
                    className={styles.shareBtn}
                    onClick={(e) => handleShare(e, c)}
                    aria-label={copiedId === c.id ? "Link copied" : "Share collection"}
                    title={copiedId === c.id ? "Link copied!" : "Share"}
                  >
                    {copiedId === c.id ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                    ) : (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                    )}
                  </button>
                  </div>
                </div>
              </div>
            </Link>
          ))}

          {/* Create new placeholder card */}
          <button
            className={styles.cardNew}
            onClick={() => setShowForm(true)}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            <span>Create New Collection</span>
          </button>
        </div>
      )}

      {/* Mobile FAB */}
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
