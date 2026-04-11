-- Make collections public by default and allow anonymous reads on items in public collections

-- 1. Change default for is_public from false to true
ALTER TABLE collections ALTER COLUMN is_public SET DEFAULT true;

-- 2. Backfill: make all existing collections public
UPDATE collections SET is_public = true WHERE is_public = false;

-- 3. Allow anyone (including anonymous) to read items in public collections
CREATE POLICY "Items in public collections are viewable by anyone"
  ON items FOR SELECT
  USING (
    collection_id IN (SELECT id FROM collections WHERE is_public = true)
  );

-- 4. Allow anonymous users to read profiles (for owner display names on public pages)
CREATE POLICY "Public profiles are viewable by anyone"
  ON profiles FOR SELECT
  USING (true);
