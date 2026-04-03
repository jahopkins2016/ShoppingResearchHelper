-- SaveIt Schema Migration
-- Run this in the Supabase SQL Editor: https://supabase.com/dashboard/project/fvzcsnphxrewvpvuqamt/sql

-- ============================================================
-- PROFILES
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  email text not null,
  referral_code text unique,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, referral_code)
  values (new.id, new.email, substr(md5(random()::text), 1, 8));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- COLLECTIONS
-- ============================================================
create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  description text,
  is_default boolean default false,
  is_public boolean default false,
  share_token text unique,
  cover_image_url text,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ITEMS
-- ============================================================
do $$ begin
  create type enrichment_status as enum ('pending', 'completed', 'failed');
exception when duplicate_object then null;
end $$;

create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  collection_id uuid not null references public.collections(id) on delete cascade,
  url text not null,
  title text,
  description text,
  image_url text,
  cached_image_path text,
  price text,
  currency text,
  site_name text,
  site_favicon_url text,
  enrichment_status enrichment_status default 'pending',
  price_drop_seen boolean default true,
  lowest_price text,
  notes text,
  is_archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- PRICE HISTORY
-- ============================================================
create table if not exists public.price_history (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  price text,
  currency text,
  checked_at timestamptz default now()
);

create index if not exists idx_price_history_item_checked
  on public.price_history (item_id, checked_at desc);

-- ============================================================
-- COLLECTION SHARES
-- ============================================================
do $$ begin
  create type share_role as enum ('viewer', 'editor');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type share_status as enum ('pending', 'accepted', 'declined');
exception when duplicate_object then null;
end $$;

create table if not exists public.collection_shares (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.collections(id) on delete cascade,
  shared_by uuid not null references public.profiles(id) on delete cascade,
  shared_with_email text not null,
  shared_with_user_id uuid references public.profiles(id) on delete set null,
  role share_role not null default 'viewer',
  status share_status not null default 'pending',
  created_at timestamptz default now()
);

-- ============================================================
-- REFERRALS
-- ============================================================
do $$ begin
  create type referral_status as enum ('pending', 'signed_up');
exception when duplicate_object then null;
end $$;

create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_email text not null,
  referred_user_id uuid references public.profiles(id) on delete set null,
  status referral_status not null default 'pending',
  created_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.items enable row level security;
alter table public.collection_shares enable row level security;
alter table public.price_history enable row level security;
alter table public.referrals enable row level security;

-- Helper functions (SECURITY DEFINER bypasses RLS to avoid circular policy recursion)
create or replace function public.rls_is_collection_owner(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.collections where id = cid and user_id = auth.uid()
  );
$$;

create or replace function public.rls_is_collection_shared_with_me(cid uuid)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.collection_shares
    where collection_id = cid
      and status in ('pending', 'accepted')
      and (
        shared_with_user_id = auth.uid()
        or shared_with_email = auth.jwt() ->> 'email'
      )
  );
$$;

-- profiles
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

create policy "Shared users can view sharer profiles"
  on public.profiles for select using (
    exists (
      select 1 from public.collection_shares
      where shared_by = profiles.id
        and (
          shared_with_user_id = auth.uid()
          or shared_with_email = auth.jwt() ->> 'email'
        )
    )
  );

-- collections
create policy "Users can manage their own collections"
  on public.collections for all using (auth.uid() = user_id);

create policy "Public collections are viewable by anyone"
  on public.collections for select using (is_public = true);

create policy "Shared users can view shared collections"
  on public.collections for select using (
    public.rls_is_collection_shared_with_me(id)
  );

-- items
create policy "Users can manage their own items"
  on public.items for all using (auth.uid() = user_id);

create policy "Collection editors can insert items"
  on public.items for insert with check (
    exists (
      select 1 from public.collection_shares
      where collection_id = items.collection_id
        and shared_with_user_id = auth.uid()
        and role = 'editor'
        and status = 'accepted'
    )
  );

create policy "Collection viewers and editors can view items"
  on public.items for select using (
    exists (
      select 1 from public.collection_shares
      where collection_id = items.collection_id
        and shared_with_user_id = auth.uid()
        and status = 'accepted'
    )
  );

-- collection_shares
create policy "Collection owners can manage shares"
  on public.collection_shares for all using (
    public.rls_is_collection_owner(collection_id)
  );

create policy "Shared users can view their own share"
  on public.collection_shares for select using (
    shared_with_user_id = auth.uid() or shared_with_email = auth.jwt() ->> 'email'
  );

create policy "Shared users can accept or decline their own share"
  on public.collection_shares for update using (
    shared_with_email = auth.jwt() ->> 'email'
  ) with check (
    status in ('accepted', 'declined')
  );

-- price_history
create policy "Users can view price history for their items"
  on public.price_history for select
  using (
    item_id in (select id from public.items where user_id = auth.uid())
  );

create policy "Service role can insert price history"
  on public.price_history for insert
  with check (true);

-- referrals
create policy "Users can view their own referrals"
  on public.referrals for select
  using (referrer_id = auth.uid());

create policy "Users can insert referrals"
  on public.referrals for insert
  with check (referrer_id = auth.uid());

create policy "Service role can update referrals"
  on public.referrals for update
  using (true);

-- ============================================================
-- SCHEMA ADDITIONS
-- ============================================================
alter table public.items add column if not exists last_viewed_at timestamptz;

-- Rich product metadata (extracted from JSON-LD, OG tags, page heuristics)
alter table public.items add column if not exists brand text;
alter table public.items add column if not exists category text;
alter table public.items add column if not exists availability text;        -- InStock, OutOfStock, PreOrder, etc.
alter table public.items add column if not exists condition text;           -- new, used, refurbished
alter table public.items add column if not exists rating numeric(3,2);     -- e.g. 4.50
alter table public.items add column if not exists rating_count integer;
alter table public.items add column if not exists review_count integer;
alter table public.items add column if not exists seller text;
alter table public.items add column if not exists sku text;
alter table public.items add column if not exists gtin text;               -- UPC / EAN / ISBN
alter table public.items add column if not exists sale_price text;
alter table public.items add column if not exists original_price text;     -- regular price when on sale
alter table public.items add column if not exists additional_images text[];
alter table public.items add column if not exists color text;
alter table public.items add column if not exists size text;
alter table public.items add column if not exists shipping text;
alter table public.items add column if not exists return_policy text;
alter table public.items add column if not exists product_metadata jsonb default '{}'::jsonb;  -- overflow for extras

-- Similar products table
create table if not exists public.similar_products (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null references public.items(id) on delete cascade,
  title text not null,
  url text not null,
  image_url text,
  price text,
  currency text,
  site_name text,
  similarity_source text,    -- 'json_ld', 'same_site', 'search', 'gtin_match'
  created_at timestamptz default now()
);

create index if not exists idx_similar_products_item
  on public.similar_products (item_id);

-- RLS for similar_products
alter table public.similar_products enable row level security;

create policy "Users can view similar products for their items"
  on public.similar_products for select
  using (
    item_id in (select id from public.items where user_id = auth.uid())
  );

create policy "Service role can manage similar products"
  on public.similar_products for all
  using (true);
