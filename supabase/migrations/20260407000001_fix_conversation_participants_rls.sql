-- Fix: the SELECT policy on conversation_participants was self-referencing,
-- causing infinite recursion (500 errors).  Replace it with a SECURITY DEFINER
-- helper function that bypasses RLS to look up the user's conversation IDs.

-- 1. Create a helper that returns conversation IDs for a given user
create or replace function public.user_conversation_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select conversation_id
  from public.conversation_participants
  where user_id = uid;
$$;

-- 2. Drop the broken self-referencing policy
drop policy if exists "Participants can view conversation members"
  on public.conversation_participants;

-- 3. Re-create using the helper (no self-reference)
create policy "Participants can view conversation members"
  on public.conversation_participants for select
  using (
    conversation_id in (select public.user_conversation_ids(auth.uid()))
  );
