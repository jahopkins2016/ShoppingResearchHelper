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
}: {
  initialCollections: Collection[];
  coverMap: Record<string, string>;
}) {
  const [collections, setCollections] = useState(initialCollections);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [creating, setCreating] = useState(false);
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
      .insert({ name: name.trim(), user_id: user?.id })
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
                <h2 className={styles.cardTitle}>{c.name}</h2>
                <div className={styles.cardMeta}>
                  <span className={styles.cardUpdated}>
                    Updated {timeAgo(c.created_at)}
                  </span>
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
