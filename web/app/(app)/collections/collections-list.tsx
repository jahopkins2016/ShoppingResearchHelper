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

export default function CollectionsList({
  initialCollections,
}: {
  initialCollections: Collection[];
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
              <h2 className={styles.cardTitle}>{c.name}</h2>
              {c.description && (
                <p className={styles.cardDescription}>{c.description}</p>
              )}
            </Link>
          ))}
        </div>
      )}

      {showForm ? (
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
      ) : (
        <button
          className={styles.fab}
          onClick={() => setShowForm(true)}
          aria-label="New collection"
        >
          +
        </button>
      )}
    </>
  );
}
