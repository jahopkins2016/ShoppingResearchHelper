-- Fix friends table: ensure authenticated role has table-level access
-- and add explicit INSERT policy (not relying on FOR ALL for inserts)

GRANT SELECT, INSERT, UPDATE, DELETE ON public.friends TO authenticated;

-- Add explicit INSERT policy in case FOR ALL doesn't cover INSERT in PostgREST
DO $$ BEGIN
  CREATE POLICY "Users can insert their own friends"
    ON public.friends FOR INSERT
    WITH CHECK (auth.uid() = user_id);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
