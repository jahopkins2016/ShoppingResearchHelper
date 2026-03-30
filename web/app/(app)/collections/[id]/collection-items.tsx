"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface Item {
  id: string;
  url: string;
  title: string | null;
  image_url: string | null;
  cached_image_path: string | null;
  price: string | null;
  currency: string | null;
  site_name: string | null;
  notes: string | null;
  price_drop_seen: boolean | null;
  enrichment_status: string;
  [key: string]: unknown;
}

export default function CollectionItems({
  initialItems,
  collectionId,
}: {
  initialItems: Item[];
  collectionId: string;
}) {
  const [items, setItems] = useState<Item[]>(initialItems);
  const [showModal, setShowModal] = useState(false);
  const [url, setUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState("");
  const [shareRole, setShareRole] = useState<"viewer" | "editor">("viewer");
  const [sharing, setSharing] = useState(false);
  const [shareMsg, setShareMsg] = useState<string | null>(null);

  const supabase = createClient();

  async function handleSave() {
    const trimmed = url.trim();
    if (!trimmed) return;

    setSaving(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("items")
        .insert({
          url: trimmed,
          collection_id: collectionId,
          user_id: user.id,
          enrichment_status: "pending",
        })
        .select()
        .single();

      if (error || !data) return;

      // Optimistically add item to the list
      setItems((prev) => [...prev, data as Item]);

      // Fire and forget enrichment
      supabase.functions.invoke("enrich-item", {
        body: { item_id: data.id },
      });

      setUrl("");
      setShowModal(false);
    } finally {
      setSaving(false);
    }
  }

  async function handleShare() {
    const email = shareEmail.trim();
    if (!email) return;

    setSharing(true);
    setShareMsg(null);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("collection_shares")
        .insert({
          collection_id: collectionId,
          shared_by: user.id,
          shared_with_email: email,
          role: shareRole,
          status: "pending",
        })
        .select()
        .single();

      if (error) {
        setShareMsg("Failed to share: " + error.message);
        return;
      }

      // Fire and forget invite email
      supabase.functions.invoke("send-invite-email", {
        body: { share_id: data.id },
      });

      setShareMsg("Invitation sent!");
      setShareEmail("");
      setTimeout(() => {
        setShowShareModal(false);
        setShareMsg(null);
      }, 1500);
    } finally {
      setSharing(false);
    }
  }

  async function dismissPriceDrop(itemId: string) {
    await supabase
      .from("items")
      .update({ price_drop_seen: true })
      .eq("id", itemId);

    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId ? { ...item, price_drop_seen: true } : item
      )
    );
  }

  if (!items || items.length === 0) {
    return (
      <>
        <div className={styles.addButtonWrap}>
          <button
            className={styles.shareButton}
            onClick={() => setShowShareModal(true)}
          >
            Share
          </button>
          <button
            className={styles.addButton}
            onClick={() => setShowModal(true)}
          >
            + Add Item
          </button>
        </div>
        <div className={styles.empty}>
          <p className={styles.emptyText}>No items yet.</p>
          <p className={styles.emptySubtext}>
            Use the browser extension or share sheet to save items here.
          </p>
        </div>
        {showModal && (
          <Modal
            url={url}
            setUrl={setUrl}
            saving={saving}
            onSave={handleSave}
            onCancel={() => {
              setShowModal(false);
              setUrl("");
            }}
          />
        )}
        {showShareModal && (
          <ShareModal
            email={shareEmail}
            setEmail={setShareEmail}
            role={shareRole}
            setRole={setShareRole}
            sharing={sharing}
            message={shareMsg}
            onShare={handleShare}
            onCancel={() => {
              setShowShareModal(false);
              setShareEmail("");
              setShareMsg(null);
            }}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className={styles.addButtonWrap}>
        <button
          className={styles.shareButton}
          onClick={() => setShowShareModal(true)}
        >
          Share
        </button>
        <button
          className={styles.addButton}
          onClick={() => setShowModal(true)}
        >
          + Add Item
        </button>
      </div>
      <div className={styles.grid}>
        {items.map((item) => (
          <a
            key={item.id}
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.card}
          >
            {(item.cached_image_path || item.image_url) && (
              <div className={styles.imageWrap}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={(item.cached_image_path || item.image_url)!}
                  alt={item.title ?? ""}
                  className={styles.image}
                />
                {item.price && (
                  <span className={styles.price}>
                    {item.currency ?? "$"}
                    {item.price}
                  </span>
                )}
                {item.price_drop_seen === false && (
                  <button
                    className={styles.priceDrop}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      dismissPriceDrop(item.id);
                    }}
                  >
                    ↓ Price Drop
                  </button>
                )}
              </div>
            )}
            <div className={styles.cardBody}>
              <h2 className={styles.cardTitle}>{item.title ?? item.url}</h2>
              {item.site_name && (
                <p className={styles.siteName}>{item.site_name}</p>
              )}
              {item.notes && <p className={styles.notes}>{item.notes}</p>}
            </div>
          </a>
        ))}
      </div>
      {showModal && (
        <Modal
          url={url}
          setUrl={setUrl}
          saving={saving}
          onSave={handleSave}
          onCancel={() => {
            setShowModal(false);
            setUrl("");
          }}
        />
      )}
      {showShareModal && (
        <ShareModal
          email={shareEmail}
          setEmail={setShareEmail}
          role={shareRole}
          setRole={setShareRole}
          sharing={sharing}
          message={shareMsg}
          onShare={handleShare}
          onCancel={() => {
            setShowShareModal(false);
            setShareEmail("");
            setShareMsg(null);
          }}
        />
      )}
    </>
  );
}

function Modal({
  url,
  setUrl,
  saving,
  onSave,
  onCancel,
}: {
  url: string;
  setUrl: (v: string) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>Add Item</h3>
        <input
          type="url"
          className={styles.modalInput}
          placeholder="https://example.com/product"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          autoFocus
        />
        <div className={styles.modalActions}>
          <button
            className={styles.modalCancel}
            onClick={onCancel}
            disabled={saving}
          >
            Cancel
          </button>
          <button
            className={styles.modalSave}
            onClick={onSave}
            disabled={saving || !url.trim()}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ShareModal({
  email,
  setEmail,
  role,
  setRole,
  sharing,
  message,
  onShare,
  onCancel,
}: {
  email: string;
  setEmail: (v: string) => void;
  role: "viewer" | "editor";
  setRole: (v: "viewer" | "editor") => void;
  sharing: boolean;
  message: string | null;
  onShare: () => void;
  onCancel: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div
        className={styles.modalContent}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className={styles.modalTitle}>Share Collection</h3>
        {message && (
          <p
            className={
              message.startsWith("Failed")
                ? styles.shareError
                : styles.shareSuccess
            }
          >
            {message}
          </p>
        )}
        <input
          type="email"
          className={styles.modalInput}
          placeholder="colleague@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoFocus
        />
        <div className={styles.roleSelect}>
          <label className={styles.roleLabel}>
            <input
              type="radio"
              name="role"
              value="viewer"
              checked={role === "viewer"}
              onChange={() => setRole("viewer")}
            />
            Viewer
          </label>
          <label className={styles.roleLabel}>
            <input
              type="radio"
              name="role"
              value="editor"
              checked={role === "editor"}
              onChange={() => setRole("editor")}
            />
            Editor
          </label>
        </div>
        <div className={styles.modalActions}>
          <button
            className={styles.modalCancel}
            onClick={onCancel}
            disabled={sharing}
          >
            Cancel
          </button>
          <button
            className={styles.modalSave}
            onClick={onShare}
            disabled={sharing || !email.trim()}
          >
            {sharing ? "Sending…" : "Send Invite"}
          </button>
        </div>
      </div>
    </div>
  );
}
