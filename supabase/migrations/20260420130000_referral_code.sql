-- Add referral_code to profiles for the Invite a Friend flow.
--
-- Before this migration, the mobile app queried profiles.referral_code
-- when building share URLs, got NULL back, and fell through to the bare
-- "https://saveit.website" link. That URL doesn't match the Android
-- intent-filter's pathPrefix="/join", so tapping a shared link on an
-- Android device with SaveIt installed always opened the browser
-- instead of the app.
--
-- Each user gets a unique 8-char uppercase-hex code (32 bits of entropy,
-- collision-safe for this app's scale). The handle_new_user trigger
-- assigns one automatically on signup.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Helper: generate a fresh unique code (retries on collision).
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  new_code text;
BEGIN
  LOOP
    new_code := upper(encode(gen_random_bytes(4), 'hex'));
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = new_code
    );
  END LOOP;
  RETURN new_code;
END;
$$;

-- Backfill existing rows one at a time so each generate_referral_code
-- call sees the previous row's insert when checking for collisions.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.profiles WHERE referral_code IS NULL LOOP
    UPDATE public.profiles
      SET referral_code = public.generate_referral_code()
      WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles
  ALTER COLUMN referral_code SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code);

-- Patch the signup trigger to include a referral_code going forward.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, referral_code)
  VALUES (new.id, new.email, public.generate_referral_code());
  RETURN new;
END;
$$;
