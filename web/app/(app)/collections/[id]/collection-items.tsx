"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import styles from "./page.module.css";

interface PriceHistoryRow {
  id: string;
  price: string | null;
  currency: string | null;
  checked_at: string;
}

interface Item {
  id: string;
  url: string;
  title: string | null;
  description: string | null;
  image_url: string | null;
  cached_image_path: string | null;
  price: string | null;
  currency: string | null;
  site_name: string | null;
  notes: string | null;
  price_drop_seen: boolean | null;
  enrichment_status: string;
  lowest_price: string | null;
  last_viewed_at: string | null;
  brand: string | null;
  category: string | null;
  availability: string | null;
  condition: string | null;
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  seller: string | null;
  sale_price: string | null;
  original_price: string | null;
  color: string | null;
  size: string | null;
  shipping: string | null;
  return_policy: string | null;
  price_history: PriceHistoryRow[];
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
  const [expandedHistory, setExpandedHistory] = useState<Set<string>>(
    new Set()
  );
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

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function renderStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.25 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
  }

  function formatCurrency(currency: string | null): string {
    if (!currency) return "$";
    const symbols: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", CAD: "CA$", AUD: "A$" };
    return symbols[currency] || currency + " ";
  }

  function availabilityLabel(avail: string): { text: string; inStock: boolean } {
    const lower = avail.toLowerCase();
    if (lower.includes("instock") || lower.includes("in_stock") || lower.includes("in stock")) {
      return { text: "In Stock", inStock: true };
    }
    if (lower.includes("outofstock") || lower.includes("out_of_stock") || lower.includes("out of stock")) {
      return { text: "Out of Stock", inStock: false };
    }
    if (lower.includes("preorder") || lower.includes("pre_order")) {
      return { text: "Pre-Order", inStock: true };
    }
    return { text: avail, inStock: true };
  }

  function handleCardClick(item: Item) {
    const now = new Date().toISOString();
    setItems((prev) =>
      prev.map((i) =>
        i.id === item.id ? { ...i, last_viewed_at: now } : i
      )
    );
    supabase
      .from("items")
      .update({ last_viewed_at: now })
      .eq("id", item.id)
      .then(() => {});
    supabase.functions.invoke("enrich-item", { body: { item_id: item.id } });
  }

  function toggleHistory(e: React.MouseEvent, itemId: string) {
    e.preventDefault();
    e.stopPropagation();
    setExpandedHistory((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
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
        {items.map((item) => {
          const history = [...(item.price_history ?? [])].sort(
            (a, b) =>
              new Date(b.checked_at).getTime() -
              new Date(a.checked_at).getTime()
          );
          const isExpanded = expandedHistory.has(item.id);
          const visibleHistory = isExpanded ? history : history.slice(0, 2);
          const sym = formatCurrency(item.currency);
          const hasSale = item.sale_price && item.original_price;
          const displayPrice = hasSale ? item.sale_price : item.price;
          const avail = item.availability ? availabilityLabel(item.availability) : null;

          return (
            <a
              key={item.id}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.card}
              onClick={() => handleCardClick(item)}
            >
              {(item.cached_image_path || item.image_url) ? (
                <div className={styles.imageWrap}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={(item.cached_image_path || item.image_url)!}
                    alt={item.title ?? ""}
                    className={styles.image}
                  />
                  {avail && (
                    <span className={`${styles.availabilityBadge} ${avail.inStock ? styles.inStock : styles.outOfStock}`}>
                      {avail.text}
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
                      ↓ Drop
                    </button>
                  )}
                </div>
              ) : (
                <div className={styles.imagePlaceholder}>
                  <span className={styles.placeholderIcon}>🖼</span>
                </div>
              )}
              <div className={styles.cardBody}>
                <h2 className={styles.cardTitle}>{item.title ?? item.url}</h2>

                {(item.brand || item.site_name) && (
                  <div className={styles.cardMeta}>
                    {item.brand && <span className={styles.brand}>{item.brand}</span>}
                    {item.brand && item.site_name && <span className={styles.metaDot}>·</span>}
                    {item.site_name && <span className={styles.siteName}>{item.site_name}</span>}
                  </div>
                )}

                {displayPrice && (
                  <div className={styles.priceRow}>
                    <span className={`${styles.currentPrice} ${hasSale ? styles.salePrice : ""}`}>
                      {sym}{displayPrice}
                    </span>
                    {hasSale && (
                      <span className={styles.originalPrice}>
                        {sym}{item.original_price}
                      </span>
                    )}
                    {item.lowest_price && item.lowest_price !== displayPrice && (
                      <span className={styles.lowestBadge}>Low: {sym}{item.lowest_price}</span>
                    )}
                  </div>
                )}

                {item.rating != null && (
                  <div className={styles.ratingRow}>
                    <span className={styles.stars}>{renderStars(item.rating)}</span>
                    <span className={styles.ratingText}>{item.rating}</span>
                    {(item.rating_count || item.review_count) && (
                      <span className={styles.ratingCount}>
                        ({item.review_count ?? item.rating_count})
                      </span>
                    )}
                  </div>
                )}

                {(item.condition || item.color || item.size || item.shipping) && (
                  <div className={styles.tagsRow}>
                    {item.condition && item.condition !== "NewCondition" && (
                      <span className={styles.tag}>{item.condition.replace("Condition", "")}</span>
                    )}
                    {item.color && <span className={styles.tag}>{item.color}</span>}
                    {item.size && <span className={styles.tag}>{item.size}</span>}
                    {item.shipping && <span className={styles.tag}>{item.shipping}</span>}
                  </div>
                )}

                {visibleHistory.length > 0 && (
                  <div className={styles.priceHistory}>
                    <span className={styles.priceHistoryLabel}>
                      Price History
                    </span>
                    {visibleHistory.map((row) => (
                      <div key={row.id} className={styles.priceHistoryRow}>
                        <span className={styles.priceHistoryPrice}>
                          {row.currency ?? "$"}
                          {row.price ?? "\u2014"}
                        </span>
                        <span className={styles.priceHistoryDate}>
                          {formatDate(row.checked_at)}
                        </span>
                      </div>
                    ))}
                    {history.length > 2 && (
                      <button
                        className={styles.priceHistoryToggle}
                        onClick={(e) => toggleHistory(e, item.id)}
                      >
                        {isExpanded
                          ? "\u25B2 Less"
                          : `\u25BC +${history.length - 2}`}
                      </button>
                    )}
                  </div>
                )}

                {item.notes && <p className={styles.notes}>{item.notes}</p>}
              </div>
            </a>
          );
        })}
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
