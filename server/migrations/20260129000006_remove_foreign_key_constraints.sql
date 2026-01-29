-- Drop foreign key constraints to support local-first/offline sync
-- This aligns with PGlite schema which doesn't enforce FKs
-- Referential integrity is maintained at application level

ALTER TABLE item_topics DROP CONSTRAINT IF EXISTS item_topics_item_id_fkey;
ALTER TABLE item_likes DROP CONSTRAINT IF EXISTS item_likes_item_id_fkey;
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_source_id_fkey;
