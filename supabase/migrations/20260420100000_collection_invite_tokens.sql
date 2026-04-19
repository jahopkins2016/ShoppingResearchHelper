-- Link-based collection invites
--
-- Adds a single stable invite_token per collection. Anyone with the link
-- can join the collection as a viewer via accept_collection_invite(token).
-- Editor invites still go through the email-based collection_shares flow.

alter table public.collections
  add column if not exists invite_token text unique;

-- Backfill existing rows with a fresh token.
update public.collections
set invite_token = gen_random_uuid()::text
where invite_token is null;

alter table public.collections
  alter column invite_token set not null;

alter table public.collections
  alter column invite_token set default gen_random_uuid()::text;

-- Fetch minimal collection metadata from an invite token. Runs as the
-- function owner so unauthenticated / non-member users can still read the
-- collection name shown on the landing page.
create or replace function public.get_collection_by_invite_token(p_token text)
returns table (
  id uuid,
  name text,
  description text,
  owner_name text
)
language sql
security definer
set search_path = public
as $$
  select c.id, c.name, c.description, p.display_name
  from public.collections c
  left join public.profiles p on p.id = c.user_id
  where c.invite_token = p_token
    and c.archived_at is null;
$$;

grant execute on function public.get_collection_by_invite_token(text) to anon, authenticated;

-- Accept a link invite as the current user. Inserts an accepted
-- collection_shares row (role = viewer) unless the user already owns the
-- collection or has an existing share.
create or replace function public.accept_collection_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_collection_id uuid;
  v_owner_id uuid;
  v_user_id uuid := auth.uid();
  v_user_email text;
begin
  if v_user_id is null then
    raise exception 'not authenticated';
  end if;

  select id, user_id into v_collection_id, v_owner_id
  from public.collections
  where invite_token = p_token
    and archived_at is null;

  if v_collection_id is null then
    raise exception 'invalid invite token';
  end if;

  if v_owner_id = v_user_id then
    return v_collection_id;
  end if;

  select email into v_user_email from public.profiles where id = v_user_id;

  -- If a pending/accepted share for this email already exists, just mark it accepted.
  update public.collection_shares
  set status = 'accepted',
      shared_with_user_id = v_user_id
  where collection_id = v_collection_id
    and shared_with_email = v_user_email;

  if not found then
    insert into public.collection_shares
      (collection_id, shared_by, shared_with_email, shared_with_user_id, role, status)
    values
      (v_collection_id, v_owner_id, v_user_email, v_user_id, 'viewer', 'accepted');
  end if;

  return v_collection_id;
end;
$$;

grant execute on function public.accept_collection_invite(text) to authenticated;
