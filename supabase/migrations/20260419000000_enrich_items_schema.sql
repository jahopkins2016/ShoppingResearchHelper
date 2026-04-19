-- Columns and table required by the enrich-item edge function. The function
-- had drifted badly from the DB: every enrichment failed silently when
-- PostgREST rejected the update for unknown columns (lowest_price,
-- additional_images, product_metadata, etc.) and the similar_products insert
-- hit a missing table. Also recreate the item-images storage bucket.

alter table items
  add column if not exists brand text,
  add column if not exists category text,
  add column if not exists availability text,
  add column if not exists condition text,
  add column if not exists rating numeric,
  add column if not exists rating_count integer,
  add column if not exists review_count integer,
  add column if not exists seller text,
  add column if not exists sku text,
  add column if not exists gtin text,
  add column if not exists sale_price numeric,
  add column if not exists original_price numeric,
  add column if not exists additional_images jsonb,
  add column if not exists color text,
  add column if not exists size text,
  add column if not exists shipping text,
  add column if not exists return_policy text,
  add column if not exists product_metadata jsonb,
  add column if not exists lowest_price numeric,
  add column if not exists price_drop_seen boolean default true;

create table if not exists similar_products (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references items(id) on delete cascade,
  title text,
  url text not null,
  image_url text,
  price numeric,
  currency text,
  site_name text,
  similarity_source text,
  created_at timestamptz not null default now()
);

create index if not exists similar_products_item_id_idx on similar_products(item_id);

alter table similar_products enable row level security;

drop policy if exists "similar_products_select_own" on similar_products;
create policy "similar_products_select_own" on similar_products
  for select using (
    exists (select 1 from items i where i.id = similar_products.item_id and i.user_id = auth.uid())
  );

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "item_images_public_read" on storage.objects;
create policy "item_images_public_read" on storage.objects
  for select using (bucket_id = 'item-images');
