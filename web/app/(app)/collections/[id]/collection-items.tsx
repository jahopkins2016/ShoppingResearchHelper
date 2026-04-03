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
  updated_at: string | null;
  price_history: PriceHistoryRow[];
  [key: string]: unknown;
}

interface SimilarProduct {
  id: string;
  title: string;
  url: string;
  image_url: string | null;
  price: string | null;
  currency: string | null;
  site_name: string | null;
  similarity_source: string | null;
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
  const [inspectItem, setInspectItem] = useState<Item | null>(null);
  const [similarItem, setSimilarItem] = useState<Item | null>(null);
  const [similarProducts, setSimilarProducts] = useState<SimilarProduct[]>([]);
  const [loadingSimilar, setLoadingSimilar] = useState(false);
  const [nearbyItem, setNearbyItem] = useState<Item | null>(null);

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

  async function handleShowSimilar(e: React.MouseEvent, item: Item) {
    e.preventDefault();
    e.stopPropagation();
    setSimilarItem(item);
    setLoadingSimilar(true);
    setSimilarProducts([]);
    const { data } = await supabase
      .from("similar_products")
      .select("*")
      .eq("item_id", item.id)
      .order("created_at", { ascending: false });
    setSimilarProducts((data as SimilarProduct[]) ?? []);
    setLoadingSimilar(false);
  }

  function handleShowNearby(e: React.MouseEvent, item: Item) {
    e.preventDefault();
    e.stopPropagation();
    setNearbyItem(item);
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
                  <button
                    className={styles.inspectBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInspectItem(item);
                    }}
                    title="Inspect metadata"
                  >
                    🔍
                  </button>
                  <button
                    className={styles.similarBtn}
                    onClick={(e) => handleShowSimilar(e, item)}
                    title="Similar options"
                  >
                    🔄
                  </button>
                  <button
                    className={styles.nearbyBtn}
                    onClick={(e) => handleShowNearby(e, item)}
                    title="Find nearby stores"
                  >
                    📍
                  </button>
                </div>
              ) : (
                <div className={styles.imagePlaceholder}>
                  <span className={styles.placeholderIcon}>🖼</span>
                  <button
                    className={styles.inspectBtn}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setInspectItem(item);
                    }}
                    title="Inspect metadata"
                  >
                    🔍
                  </button>
                  <button
                    className={styles.similarBtn}
                    onClick={(e) => handleShowSimilar(e, item)}
                    title="Similar options"
                  >
                    🔄
                  </button>
                  <button
                    className={styles.nearbyBtn}
                    onClick={(e) => handleShowNearby(e, item)}
                    title="Find nearby stores"
                  >
                    📍
                  </button>
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
      {inspectItem && (
        <InspectModal
          item={inspectItem}
          onClose={() => setInspectItem(null)}
          formatDate={formatDate}
        />
      )}
      {similarItem && (
        <SimilarModal
          item={similarItem}
          products={similarProducts}
          loading={loadingSimilar}
          onClose={() => { setSimilarItem(null); setSimilarProducts([]); }}
        />
      )}
      {nearbyItem && (
        <NearbyModal
          item={nearbyItem}
          onClose={() => setNearbyItem(null)}
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

function InspectModal({
  item,
  onClose,
  formatDate,
}: {
  item: Item;
  onClose: () => void;
  formatDate: (iso: string) => string;
}) {
  const fields: [string, unknown][] = [
    ["ID", item.id],
    ["URL", item.url],
    ["Title", item.title],
    ["Description", item.description],
    ["Image URL", item.image_url],
    ["Cached Image", item.cached_image_path],
    ["Price", item.price],
    ["Currency", item.currency],
    ["Sale Price", item.sale_price],
    ["Original Price", item.original_price],
    ["Lowest Price", item.lowest_price],
    ["Brand", item.brand],
    ["Category", item.category as string],
    ["Availability", item.availability],
    ["Condition", item.condition],
    ["Rating", item.rating],
    ["Rating Count", item.rating_count],
    ["Review Count", item.review_count],
    ["Seller", item.seller],
    ["Color", item.color],
    ["Size", item.size],
    ["Shipping", item.shipping],
    ["Return Policy", item.return_policy],
    ["Site Name", item.site_name],
    ["Enrichment", item.enrichment_status],
    ["Last Enriched", item.updated_at ? new Date(item.updated_at).toLocaleString() : null],
    ["SKU", item.sku as string],
    ["GTIN", item.gtin as string],
    ["Additional Images", item.additional_images as string[]],
    ["Notes", item.notes],
    ["Product Metadata", item.product_metadata as Record<string, unknown>],
  ];

  const history = [...(item.price_history ?? [])].sort(
    (a, b) =>
      new Date(b.checked_at).getTime() - new Date(a.checked_at).getTime()
  );

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.inspectContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inspectHeader}>
          <h3 className={styles.modalTitle}>Metadata Inspector</h3>
          <button className={styles.inspectClose} onClick={onClose}>
            ✕
          </button>
        </div>

        {(item.cached_image_path || item.image_url) && (
          <div className={styles.inspectImageWrap}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={(item.cached_image_path || item.image_url)!}
              alt={item.title ?? ""}
              className={styles.inspectImage}
            />
          </div>
        )}

        <table className={styles.inspectTable}>
          <tbody>
            {fields.map(([label, value]) => {
              if (value == null || value === "") return null;
              let display: React.ReactNode;
              if (Array.isArray(value)) {
                display =
                  value.length > 0 ? (
                    <div className={styles.inspectList}>
                      {value.map((v, i) => (
                        <span key={i} className={styles.inspectListItem}>
                          {typeof v === "string" && v.startsWith("http") ? (
                            <a
                              href={v}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {v}
                            </a>
                          ) : (
                            String(v)
                          )}
                        </span>
                      ))}
                    </div>
                  ) : null;
              } else if (typeof value === "object") {
                display = (
                  <pre className={styles.inspectJson}>
                    {JSON.stringify(value, null, 2)}
                  </pre>
                );
              } else if (
                typeof value === "string" &&
                value.startsWith("http")
              ) {
                display = (
                  <a
                    href={value}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.inspectLink}
                  >
                    {value}
                  </a>
                );
              } else {
                display = String(value);
              }
              if (!display) return null;
              return (
                <tr key={label as string}>
                  <td className={styles.inspectLabel}>{label as string}</td>
                  <td className={styles.inspectValue}>{display}</td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {history.length > 0 && (
          <div className={styles.inspectSection}>
            <h4 className={styles.inspectSectionTitle}>
              Price History ({history.length})
            </h4>
            <table className={styles.inspectTable}>
              <thead>
                <tr>
                  <th className={styles.inspectLabel}>Date</th>
                  <th className={styles.inspectLabel}>Price</th>
                </tr>
              </thead>
              <tbody>
                {history.map((row) => (
                  <tr key={row.id}>
                    <td className={styles.inspectValue}>
                      {formatDate(row.checked_at)}
                    </td>
                    <td className={styles.inspectValue}>
                      {row.currency ?? "$"}
                      {row.price ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function SimilarModal({
  item,
  products,
  loading,
  onClose,
}: {
  item: Item;
  products: SimilarProduct[];
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.inspectContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inspectHeader}>
          <h3 className={styles.modalTitle}>Similar Options</h3>
          <button className={styles.inspectClose} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className={styles.similarSubtext}>
          Other options for &ldquo;{item.title ?? "this item"}&rdquo;
        </p>

        {loading && <p className={styles.loadingText}>Loading similar products…</p>}

        {!loading && products.length === 0 && (
          <div className={styles.emptyModal}>
            <p>No similar products found yet.</p>
            <p className={styles.emptyModalSub}>
              Similar products are discovered during enrichment. Try re-opening the item to trigger a refresh.
            </p>
          </div>
        )}

        {!loading && products.length > 0 && (
          <div className={styles.similarGrid}>
            {products.map((p) => (
              <a
                key={p.id}
                href={p.url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.similarCard}
              >
                {p.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.image_url} alt={p.title} className={styles.similarImage} />
                ) : (
                  <div className={styles.similarPlaceholder}>🖼</div>
                )}
                <div className={styles.similarBody}>
                  <span className={styles.similarTitle}>{p.title}</span>
                  {p.price && (
                    <span className={styles.similarPrice}>
                      {p.currency ?? "$"}{p.price}
                    </span>
                  )}
                  {p.site_name && (
                    <span className={styles.similarSite}>{p.site_name}</span>
                  )}
                  {p.similarity_source && (
                    <span className={styles.similarSource}>{p.similarity_source}</span>
                  )}
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NearbyModal({
  item,
  onClose,
}: {
  item: Item;
  onClose: () => void;
}) {
  const searchQuery = encodeURIComponent(
    [item.title, item.brand, "buy near me"].filter(Boolean).join(" ")
  );
  const mapsUrl = `https://www.google.com/maps/search/${searchQuery}`;
  const shoppingUrl = `https://www.google.com/search?q=${searchQuery}&tbm=shop&tbs=mr:1,sales:1,local_avail:1`;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div
        className={styles.inspectContent}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.inspectHeader}>
          <h3 className={styles.modalTitle}>Find Nearby</h3>
          <button className={styles.inspectClose} onClick={onClose}>
            ✕
          </button>
        </div>
        <p className={styles.similarSubtext}>
          Find &ldquo;{item.title ?? "this item"}&rdquo; at stores near you
        </p>

        <div className={styles.nearbyActions}>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.nearbyLink}
          >
            <span className={styles.nearbyIcon}>🗺️</span>
            <div>
              <span className={styles.nearbyLinkTitle}>Google Maps</span>
              <span className={styles.nearbyLinkSub}>Find stores selling this nearby</span>
            </div>
          </a>
          <a
            href={shoppingUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.nearbyLink}
          >
            <span className={styles.nearbyIcon}>🛒</span>
            <div>
              <span className={styles.nearbyLinkTitle}>Google Shopping (Local)</span>
              <span className={styles.nearbyLinkSub}>Compare local prices and availability</span>
            </div>
          </a>
          {String(item.gtin ?? "") !== "" && (
            <a
              href={`https://www.google.com/search?q=${encodeURIComponent(String(item.gtin))}+where+to+buy`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.nearbyLink}
            >
              <span className={styles.nearbyIcon}>🔎</span>
              <div>
                <span className={styles.nearbyLinkTitle}>Search by UPC/EAN</span>
                <span className={styles.nearbyLinkSub}>Find using product barcode: {String(item.gtin)}</span>
              </div>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
