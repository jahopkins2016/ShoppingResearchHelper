-- Archive support for collections: nullable timestamp records when a collection
-- was archived. UI filters hide archived by default; RLS is unchanged so owners
-- can still load archived collections via direct link to unarchive them.

ALTER TABLE collections ADD COLUMN archived_at timestamptz;

CREATE INDEX idx_collections_user_archived ON collections(user_id, archived_at);
