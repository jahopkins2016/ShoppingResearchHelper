-- Soft-archive for individual items.
-- Mirrors the collections.archived_at pattern so users can hide items
-- from default views without deleting them.

alter table public.items
  add column if not exists archived_at timestamptz;

create index if not exists items_archived_at_idx
  on public.items (archived_at)
  where archived_at is not null;
