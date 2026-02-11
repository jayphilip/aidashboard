-- Add composite indexes for common query patterns
-- These indexes optimize filtered queries by source_type and published_at

-- Index for queries filtering by source_type and sorting by published_at
CREATE INDEX IF NOT EXISTS idx_items_source_type_published
    ON items(source_type, published_at DESC);

-- Index for queries filtering by source_id and sorting by published_at
CREATE INDEX IF NOT EXISTS idx_items_source_id_published
    ON items(source_id, published_at DESC);

-- Expression index for COALESCE pattern used in queries
-- Matches the pattern: COALESCE(published_at, created_at)
CREATE INDEX IF NOT EXISTS idx_items_published_coalesce
    ON items(COALESCE(published_at, created_at) DESC);
