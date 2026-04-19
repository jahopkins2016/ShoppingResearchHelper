-- Persist the AI-generated per-photo classifications from enrich-item-from-photos.
-- Each element describes one photo (product / price_tag / spec_label / barcode /
-- receipt / other) in the same order as items.photo_urls. This lets the client
-- pick a sensible default image (the product photo rather than a price tag)
-- and lets users override it by tapping a different photo.

alter table public.items
  add column if not exists photo_classifications jsonb;
