-- When a collection_share flips to 'accepted' (with a resolved user id),
-- automatically create bidirectional friends rows. Fires on INSERT or
-- UPDATE so the behaviour is path-agnostic — works for the web accept
-- flow, the new mobile deep-link accept flow, or any future direct
-- insert of an already-accepted share.
--
-- Before this migration, the 'friends' table was only populated by a
-- "Sync Friends" button on the mobile app that scanned
-- collection_shares — and that button was additionally broken (it
-- wrote to a non-existent column). Users who accepted an invite
-- never appeared in each other's Friends lists.

CREATE OR REPLACE FUNCTION public.sync_friends_on_share_accept()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'accepted'
     AND NEW.shared_with_user_id IS NOT NULL
     AND NEW.shared_with_user_id <> NEW.shared_by
  THEN
    INSERT INTO public.friends (user_id, friend_id, source)
      VALUES (NEW.shared_by, NEW.shared_with_user_id, 'share')
      ON CONFLICT (user_id, friend_id) DO NOTHING;

    INSERT INTO public.friends (user_id, friend_id, source)
      VALUES (NEW.shared_with_user_id, NEW.shared_by, 'share')
      ON CONFLICT (user_id, friend_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS collection_shares_sync_friends ON public.collection_shares;

CREATE TRIGGER collection_shares_sync_friends
AFTER INSERT OR UPDATE OF status, shared_with_user_id
ON public.collection_shares
FOR EACH ROW
EXECUTE FUNCTION public.sync_friends_on_share_accept();

-- Backfill: establish friendships for everyone who accepted a share
-- before this trigger existed.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT DISTINCT shared_by, shared_with_user_id
    FROM public.collection_shares
    WHERE status = 'accepted'
      AND shared_with_user_id IS NOT NULL
      AND shared_with_user_id <> shared_by
  LOOP
    INSERT INTO public.friends (user_id, friend_id, source)
      VALUES (r.shared_by, r.shared_with_user_id, 'share')
      ON CONFLICT (user_id, friend_id) DO NOTHING;
    INSERT INTO public.friends (user_id, friend_id, source)
      VALUES (r.shared_with_user_id, r.shared_by, 'share')
      ON CONFLICT (user_id, friend_id) DO NOTHING;
  END LOOP;
END $$;
