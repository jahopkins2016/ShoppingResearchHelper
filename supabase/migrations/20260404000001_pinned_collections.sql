-- Pinned Collections migration
-- Run this in the Supabase SQL Editor to create the pinned_collections table

create table if not exists public.pinned_collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  sort_order integer default 0,
  pinned_at timestamptz default now(),
  unique (user_id, collection_id)
);

create index if not exists idx_pinned_collections_user
  on public.pinned_collections (user_id, sort_order);

alter table public.pinned_collections enable row level security;

create policy "Users can manage their own pinned collections"
  on public.pinned_collections for all
  using (auth.uid() = user_id);
