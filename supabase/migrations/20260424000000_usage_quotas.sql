-- Per-user, per-day call quotas for edge functions that hit paid APIs
-- (Anthropic vision in enrich-item-from-photos, Google Places in
-- reverse-geocode). Without this, a single compromised user token could
-- run the function in a loop and rack up unbounded charges.
--
-- Edge functions call check_and_increment_quota(kind, limit) on every
-- invocation. The function bumps the counter and reports whether the
-- caller is still under the daily cap.

CREATE TABLE IF NOT EXISTS public.usage_quotas (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind text NOT NULL,
  usage_date date NOT NULL DEFAULT current_date,
  count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, kind, usage_date)
);

ALTER TABLE public.usage_quotas ENABLE ROW LEVEL SECURITY;

-- Users can read their own counters (e.g. to show "X of Y used today");
-- writes only happen via the SECURITY DEFINER RPC below.
CREATE POLICY "Users can read their own usage"
  ON public.usage_quotas
  FOR SELECT
  USING (auth.uid() = user_id);

-- Atomically bump the counter and report whether the caller is under the
-- limit. Always increments — callers over the limit still bump the count,
-- so a tight retry loop converges on rejection rather than oscillating.
CREATE OR REPLACE FUNCTION public.check_and_increment_quota(
  p_kind text,
  p_limit int
)
RETURNS TABLE (allowed boolean, current_count int, daily_limit int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_count int;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN QUERY SELECT false, 0, p_limit;
    RETURN;
  END IF;

  INSERT INTO public.usage_quotas (user_id, kind, usage_date, count)
  VALUES (v_user_id, p_kind, current_date, 1)
  ON CONFLICT (user_id, kind, usage_date) DO UPDATE
    SET count = usage_quotas.count + 1
  RETURNING usage_quotas.count INTO v_count;

  RETURN QUERY SELECT (v_count <= p_limit), v_count, p_limit;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_and_increment_quota(text, int) TO authenticated;
