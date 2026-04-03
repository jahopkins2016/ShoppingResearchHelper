"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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
  brand: string | null;
  availability: string | null;
  condition: string | null;
  rating: number | null;
  rating_count: number | null;
  review_count: number | null;
  sale_price: string | null;
  original_price: string | null;
  lowest_price: string | null;
  color: string | null;
  size: string | null;
  shipping: string | null;
  return_policy: string | null;
  collection_id: string;
  price_history: PriceHistoryRow[];
}

interface Comparison {
  id: string;
  user_id: string;
  name: string;
  created_at: string;
}

interface ComparisonItem {
  id: string;
  comparison_id: string;
  item_id: string;
  sort_order: number;
}

export default function CompareDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const [comparison, setComparison] = useState<Comparison | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [comparisonItems, setComparisonItems] = useState<ComparisonItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [allItems, setAllItems] = useState<Item[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingItems, setLoadingItems] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // Unwrap params
  useEffect(() => {
    params.then((p) => setComparisonId(p.id));
  }, [params]);

  // Fetch comparison + items
  useEffect(() => {
    if (!comparisonId) return;

    async function load() {
      const { data: comp } = await supabase
        .from("item_comparisons")
        .select("*")
        .eq("id", comparisonId!)
        .single();

      if (!comp) {
        router.push("/compare");
        return;
      }

      setComparison(comp);
      setNameValue(comp.name);

      const { data: ciRows } = await supabase
        .from("comparison_items")
        .select("*")
        .eq("comparison_id", comparisonId!)
        .order("sort_order", { ascending: true });

      setComparisonItems(ciRows ?? []);

      if (ciRows && ciRows.length > 0) {
        const itemIds = ciRows.map((ci: ComparisonItem) => ci.item_id);
        const { data: itemRows } = await supabase
          .from("items")
          .select("*, price_history(id, price, currency, checked_at)")
          .in("id", itemIds);

        // Sort items by comparison sort_order
        const orderMap: Record<string, number> = {};
        ciRows.forEach((ci: ComparisonItem) => {
          orderMap[ci.item_id] = ci.sort_order;
        });
        const sorted = (itemRows ?? []).sort(
          (a: Item, b: Item) => (orderMap[a.id] ?? 0) - (orderMap[b.id] ?? 0)
        );
        setItems(sorted);
      } else {
        setItems([]);
      }

      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comparisonId]);

  async function handleRename() {
    const trimmed = nameValue.trim();
    if (!trimmed || !comparison) return;

    await supabase
      .from("item_comparisons")
      .update({ name: trimmed, updated_at: new Date().toISOString() })
      .eq("id", comparison.id);

    setComparison({ ...comparison, name: trimmed });
    setEditingName(false);
  }

  async function handleDelete() {
    if (!comparison) return;
    if (!window.confirm("Delete this comparison?")) return;

    await supabase.from("item_comparisons").delete().eq("id", comparison.id);
    router.push("/compare");
  }

  async function openAddModal() {
    setShowAddModal(true);
    setSearchQuery("");
    setLoadingItems(true);

    const { data } = await supabase
      .from("items")
      .select("*, price_history(id, price, currency, checked_at)")
      .order("created_at", { ascending: false });

    setAllItems(data ?? []);
    setLoadingItems(false);
  }

  async function handleAddItem(itemId: string) {
    if (!comparison) return;

    const nextOrder =
      comparisonItems.length > 0
        ? Math.max(...comparisonItems.map((ci) => ci.sort_order)) + 1
        : 0;

    const { data, error } = await supabase
      .from("comparison_items")
      .insert({
        comparison_id: comparison.id,
        item_id: itemId,
        sort_order: nextOrder,
      })
      .select()
      .single();

    if (error || !data) return;

    setComparisonItems((prev) => [...prev, data]);

    // Add the item to the display list
    const existingItem = allItems.find((i) => i.id === itemId);
    if (existingItem) {
      setItems((prev) => [...prev, existingItem]);
    }

    setShowAddModal(false);
  }

  async function handleRemoveItem(itemId: string) {
    if (!comparison) return;

    await supabase
      .from("comparison_items")
      .delete()
      .eq("comparison_id", comparison.id)
      .eq("item_id", itemId);

    setComparisonItems((prev) => prev.filter((ci) => ci.item_id !== itemId));
    setItems((prev) => prev.filter((i) => i.id !== itemId));
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatCurrency(currency: string | null): string {
    if (!currency) return "$";
    const symbols: Record<string, string> = {
      USD: "$",
      GBP: "£",
      EUR: "€",
      CAD: "CA$",
      AUD: "A$",
    };
    return symbols[currency] || currency + " ";
  }

  function renderStars(rating: number): string {
    const full = Math.floor(rating);
    const half = rating - full >= 0.25 ? 1 : 0;
    const empty = 5 - full - half;
    return "★".repeat(full) + (half ? "½" : "") + "☆".repeat(empty);
  }

  function availabilityLabel(
    avail: string
  ): { text: string; inStock: boolean } {
    const lower = avail.toLowerCase();
    if (
      lower.includes("instock") ||
      lower.includes("in_stock") ||
      lower.includes("in stock")
    ) {
      return { text: "In Stock", inStock: true };
    }
    if (
      lower.includes("outofstock") ||
      lower.includes("out_of_stock") ||
      lower.includes("out of stock")
    ) {
      return { text: "Out of Stock", inStock: false };
    }
    if (lower.includes("preorder") || lower.includes("pre_order")) {
      return { text: "Pre-Order", inStock: true };
    }
    return { text: avail, inStock: true };
  }

  // Items already in comparison (for disabling in modal)
  const comparedItemIds = useMemo(
    () => new Set(comparisonItems.map((ci) => ci.item_id)),
    [comparisonItems]
  );

  const filteredModalItems = useMemo(() => {
    if (!searchQuery.trim()) return allItems;
    const q = searchQuery.toLowerCase();
    return allItems.filter(
      (i) =>
        (i.title && i.title.toLowerCase().includes(q)) ||
        (i.brand && i.brand.toLowerCase().includes(q)) ||
        (i.site_name && i.site_name.toLowerCase().includes(q)) ||
        i.url.toLowerCase().includes(q)
    );
  }, [allItems, searchQuery]);

  if (loading) return null;
  if (!comparison) return null;

  const fields: { label: string; key: string }[] = [
    { label: "Image", key: "image" },
    { label: "Price", key: "price" },
    { label: "Lowest Price", key: "lowest_price" },
    { label: "Brand", key: "brand" },
    { label: "Site", key: "site_name" },
    { label: "Rating", key: "rating" },
    { label: "Availability", key: "availability" },
    { label: "Condition", key: "condition" },
    { label: "Color", key: "color" },
    { label: "Size", key: "size" },
    { label: "Shipping", key: "shipping" },
    { label: "Return Policy", key: "return_policy" },
    { label: "Price History", key: "price_history" },
  ];

  function renderValue(item: Item, key: string) {
    const sym = formatCurrency(item.currency);
    const na = <span className={styles.na}>—</span>;

    switch (key) {
      case "image":
        return (item.cached_image_path || item.image_url) ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={(item.cached_image_path || item.image_url)!}
            alt={item.title ?? ""}
            className={styles.itemImage}
          />
        ) : (
          <div className={styles.imagePlaceholder}>🖼</div>
        );

      case "price": {
        const hasSale = item.sale_price && item.original_price;
        const display = hasSale ? item.sale_price : item.price;
        if (!display) return na;
        return (
          <span>
            <span className={hasSale ? styles.salePrice : undefined}>
              {sym}
              {display}
            </span>
            {hasSale && (
              <span className={styles.originalPrice}>
                {sym}
                {item.original_price}
              </span>
            )}
          </span>
        );
      }

      case "lowest_price":
        return item.lowest_price ? (
          <span>
            {sym}
            {item.lowest_price}
            <span className={styles.lowestBadge}>Lowest</span>
          </span>
        ) : (
          na
        );

      case "brand":
        return item.brand ? <span>{item.brand}</span> : na;

      case "site_name":
        return item.site_name ? <span>{item.site_name}</span> : na;

      case "rating":
        return item.rating != null ? (
          <span>
            <span className={styles.stars}>{renderStars(item.rating)}</span>
            {item.rating}
            {(item.rating_count || item.review_count) && (
              <span className={styles.ratingCount}>
                ({item.review_count ?? item.rating_count})
              </span>
            )}
          </span>
        ) : (
          na
        );

      case "availability": {
        if (!item.availability) return na;
        const a = availabilityLabel(item.availability);
        return (
          <span className={a.inStock ? styles.inStock : styles.outOfStock}>
            {a.text}
          </span>
        );
      }

      case "condition":
        return item.condition ? (
          <span>{item.condition.replace("Condition", "")}</span>
        ) : (
          na
        );

      case "color":
        return item.color ? <span>{item.color}</span> : na;

      case "size":
        return item.size ? <span>{item.size}</span> : na;

      case "shipping":
        return item.shipping ? <span>{item.shipping}</span> : na;

      case "return_policy":
        return item.return_policy ? <span>{item.return_policy}</span> : na;

      case "price_history": {
        const history = [...(item.price_history ?? [])]
          .sort(
            (a, b) =>
              new Date(b.checked_at).getTime() -
              new Date(a.checked_at).getTime()
          )
          .slice(0, 5);
        if (history.length === 0) return na;
        return (
          <div className={styles.priceHistoryList}>
            {history.map((row) => (
              <div key={row.id} className={styles.priceHistoryRow}>
                <span>
                  {row.currency ?? "$"}
                  {row.price ?? "—"}
                </span>
                <span className={styles.priceHistoryDate}>
                  {formatDate(row.checked_at)}
                </span>
              </div>
            ))}
          </div>
        );
      }

      default:
        return na;
    }
  }

  return (
    <div>
      <div className={styles.header}>
        <Link href="/compare" className={styles.back}>
          ← Comparisons
        </Link>
        <div className={styles.headerRow}>
          <div className={styles.titleWrap}>
            {editingName ? (
              <input
                className={styles.titleInput}
                value={nameValue}
                onChange={(e) => setNameValue(e.target.value)}
                onBlur={handleRename}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleRename();
                  if (e.key === "Escape") {
                    setNameValue(comparison.name);
                    setEditingName(false);
                  }
                }}
                autoFocus
              />
            ) : (
              <>
                <h1 className={styles.title}>{comparison.name}</h1>
                <button
                  className={styles.editBtn}
                  onClick={() => setEditingName(true)}
                  title="Rename"
                >
                  ✏️
                </button>
              </>
            )}
          </div>
          <div className={styles.headerActions}>
            <button className={styles.addButton} onClick={openAddModal}>
              + Add Item
            </button>
            <button className={styles.deleteButton} onClick={handleDelete}>
              Delete
            </button>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>No items to compare.</p>
          <p className={styles.emptySubtext}>
            Add items from your collections to start comparing.
          </p>
        </div>
      ) : (
        <div className={styles.tableWrap}>
          <div
            className={styles.table}
            style={
              { "--col-count": items.length } as React.CSSProperties
            }
          >
            {/* Header row: corner + item titles */}
            <div className={styles.cornerCell}>Items</div>
            {items.map((item) => (
              <div key={item.id} className={styles.itemHeaderCell}>
                <span className={styles.itemHeaderTitle}>
                  {item.title ?? item.url}
                </span>
                <button
                  className={styles.removeBtn}
                  onClick={() => handleRemoveItem(item.id)}
                >
                  Remove
                </button>
              </div>
            ))}

            {/* Data rows */}
            {fields.map((field) => (
              <>
                <div key={`label-${field.key}`} className={styles.labelCell}>
                  {field.label}
                </div>
                {items.map((item) => (
                  <div
                    key={`${field.key}-${item.id}`}
                    className={styles.valueCell}
                  >
                    {renderValue(item, field.key)}
                  </div>
                ))}
              </>
            ))}
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowAddModal(false)}
        >
          <div
            className={styles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>Add Item to Compare</h3>
            <input
              type="text"
              className={styles.modalSearch}
              placeholder="Search items…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            <div className={styles.modalList}>
              {loadingItems ? (
                <div className={styles.modalEmpty}>Loading items…</div>
              ) : filteredModalItems.length === 0 ? (
                <div className={styles.modalEmpty}>No items found.</div>
              ) : (
                filteredModalItems.map((item) => {
                  const alreadyAdded = comparedItemIds.has(item.id);
                  return (
                    <button
                      key={item.id}
                      className={styles.modalItem}
                      disabled={alreadyAdded}
                      onClick={() => handleAddItem(item.id)}
                    >
                      {(item.cached_image_path || item.image_url) ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                          src={(item.cached_image_path || item.image_url)!}
                          alt=""
                          className={styles.modalItemImage}
                        />
                      ) : (
                        <div className={styles.modalItemPlaceholder}>🖼</div>
                      )}
                      <div className={styles.modalItemInfo}>
                        <div className={styles.modalItemTitle}>
                          {item.title ?? item.url}
                        </div>
                        <div className={styles.modalItemMeta}>
                          {[item.brand, item.site_name, item.price ? `${formatCurrency(item.currency)}${item.price}` : null]
                            .filter(Boolean)
                            .join(" · ") || item.url}
                          {alreadyAdded && " (already added)"}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
            <div className={styles.modalActions}>
              <button
                className={styles.modalCancel}
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
