"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "./layout.module.css";

type PinnedCollection = {
  id: string;
  name: string;
  sort_order: number;
  item_count: number;
};

export default function SidebarNav({
  pendingCount,
  unreadMessageCount,
  pinnedCollections: initialPinned,
}: {
  pendingCount: number;
  unreadMessageCount: number;
  pinnedCollections: PinnedCollection[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [pinned, setPinned] = useState(initialPinned);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  useEffect(() => {
    setPinned(initialPinned);
  }, [initialPinned]);

  const supabase = createClient();

  const handleUnpin = useCallback(
    async (collectionId: string) => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setPinned((prev) => prev.filter((p) => p.id !== collectionId));

      await supabase
        .from("pinned_collections")
        .delete()
        .eq("user_id", user.id)
        .eq("collection_id", collectionId);

      router.refresh();
    },
    [supabase, router]
  );

  const handleDragStart = (e: React.DragEvent, index: number) => {
    dragItem.current = index;
    setDraggingIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragEnter = (index: number) => {
    dragOverItem.current = index;
    setDragOverIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggingIndex(null);
    setDragOverIndex(null);

    if (dragItem.current === null || dragOverItem.current === null) return;
    if (dragItem.current === dragOverItem.current) {
      dragItem.current = null;
      dragOverItem.current = null;
      return;
    }

    const reordered = [...pinned];
    const [removed] = reordered.splice(dragItem.current, 1);
    reordered.splice(dragOverItem.current, 0, removed);

    const updated = reordered.map((item, i) => ({ ...item, sort_order: i }));
    setPinned(updated);

    dragItem.current = null;
    dragOverItem.current = null;

    // Persist new order
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await Promise.all(
      updated.map((item) =>
        supabase
          .from("pinned_collections")
          .update({ sort_order: item.sort_order })
          .eq("user_id", user.id)
          .eq("collection_id", item.id)
      )
    );
  };

  return (
    <nav className={styles.sidebarNav}>
      <Link
        href="/collections"
        className={`${styles.sidebarLink} ${
          pathname === "/collections" ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
        Collections
        {pendingCount > 0 && (
          <span className={styles.navBadge}>{pendingCount}</span>
        )}
      </Link>
      <Link
        href="/compare"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/compare") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
        Compare
      </Link>
      <Link
        href="/friends"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/friends") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
        Friends
      </Link>
      <Link
        href="/messages"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/messages") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        Messages
        {unreadMessageCount > 0 && (
          <span className={styles.navBadge}>{unreadMessageCount}</span>
        )}
      </Link>
      <Link
        href="/feedback"
        className={`${styles.sidebarLink} ${
          pathname.startsWith("/feedback") ? styles.sidebarLinkActive : ""
        }`}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
        Feedback
      </Link>

      {pinned.length > 0 && (
        <div className={styles.pinnedSection}>
          <div className={styles.pinnedHeader}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/></svg>
            Pinned
          </div>
          {pinned.map((collection, index) => (
            <div
              key={collection.id}
              className={`${styles.pinnedItem} ${draggingIndex === index ? styles.pinnedItemDragging : ""} ${dragOverIndex === index && draggingIndex !== index ? styles.pinnedItemDragOver : ""}`}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragEnter={() => handleDragEnter(index)}
              onDragEnd={handleDragEnd}
              onDragOver={(e) => e.preventDefault()}
              onDragLeave={() => { if (dragOverIndex === index) setDragOverIndex(null); }}
            >
              <span className={styles.dragHandle} aria-hidden="true">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg>
              </span>
              <Link
                href={`/collections/${collection.id}`}
                draggable={false}
                className={`${styles.sidebarLink} ${styles.pinnedLink} ${
                  pathname === `/collections/${collection.id}`
                    ? styles.sidebarLinkActive
                    : ""
                }`}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span className={styles.pinnedName}>{collection.name}</span>
                <span className={styles.pinnedCount}>{collection.item_count}</span>
              </Link>
              <button
                className={styles.unpinBtn}
                onClick={() => handleUnpin(collection.id)}
                aria-label={`Unpin ${collection.name}`}
                title="Unpin"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </nav>
  );
}
