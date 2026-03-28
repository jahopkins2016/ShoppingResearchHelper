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
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on user signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
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
  notes text,
  is_archived boolean default false,
  sort_order integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

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
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.collections enable row level security;
alter table public.items enable row level security;
alter table public.collection_shares enable row level security;

-- profiles
create policy "Users can view their own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.profiles for update using (auth.uid() = id);

-- collections
create policy "Users can manage their own collections"
  on public.collections for all using (auth.uid() = user_id);

create policy "Public collections are viewable by anyone"
  on public.collections for select using (is_public = true);

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
    exists (
      select 1 from public.collections
      where id = collection_shares.collection_id
        and user_id = auth.uid()
    )
  );

create policy "Shared users can view and update their own share"
  on public.collection_shares for select using (
    shared_with_user_id = auth.uid() or shared_with_email = (
      select email from public.profiles where id = auth.uid()
    )
  );
