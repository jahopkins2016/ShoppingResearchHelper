-- In-store item capture: photos + geolocation + store details.
-- Items can now be sourced from an in-store photo session instead of a URL,
-- so `items.url` becomes nullable and we add columns for the capture metadata.

alter table public.items
  add column if not exists source text not null default 'url',
  add column if not exists store_name text,
  add column if not exists store_address text,
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists captured_at timestamptz,
  add column if not exists photo_urls jsonb;

-- Backfill existing rows (safe because of the default, but explicit is clearer).
update public.items set source = 'url' where source is null;

alter table public.items
  add constraint items_source_check
  check (source in ('url', 'in_store'));

-- URL is no longer required — in-store items have no URL.
alter table public.items alter column url drop not null;

-- An in-store item must have at least one photo. A URL item must have a URL.
alter table public.items
  add constraint items_source_shape_check
  check (
    (source = 'url' and url is not null)
    or (source = 'in_store' and photo_urls is not null and jsonb_array_length(photo_urls) > 0)
  );

create index if not exists idx_items_source on public.items (source);
create index if not exists idx_items_captured_at on public.items (captured_at desc)
  where source = 'in_store';
