-- Add full-text search to items table

-- Add tsvector column for full-text search
ALTER TABLE items ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX IF NOT EXISTS idx_items_search_vector ON items USING GIN(search_vector);

-- Function to update search_vector column
CREATE OR REPLACE FUNCTION items_search_vector_update() RETURNS trigger AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
    setweight(to_tsvector('english', COALESCE(NEW.summary, '')), 'B') ||
    setweight(to_tsvector('english', COALESCE(NEW.body, '')), 'C');
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update search_vector on insert/update
DROP TRIGGER IF EXISTS items_search_vector_trigger ON items;
CREATE TRIGGER items_search_vector_trigger
  BEFORE INSERT OR UPDATE OF title, summary, body
  ON items
  FOR EACH ROW
  EXECUTE FUNCTION items_search_vector_update();

-- Populate search_vector for existing rows
UPDATE items SET search_vector =
  setweight(to_tsvector('english', COALESCE(title, '')), 'A') ||
  setweight(to_tsvector('english', COALESCE(summary, '')), 'B') ||
  setweight(to_tsvector('english', COALESCE(body, '')), 'C')
WHERE search_vector IS NULL;

-- Add comment explaining the weights
COMMENT ON COLUMN items.search_vector IS 'Full-text search vector with weights: A=title (highest), B=summary, C=body (lowest)';
