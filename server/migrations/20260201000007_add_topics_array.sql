-- Add topics array column to items table
ALTER TABLE items ADD COLUMN topics TEXT[] DEFAULT '{}';

-- Populate from existing item_topics data
UPDATE items
SET topics = ARRAY(
  SELECT DISTINCT topic 
  FROM item_topics 
  WHERE item_topics.item_id = items.id
  ORDER BY topic
);

-- Create GIN index for fast array queries (optional, only if needed later)
CREATE INDEX idx_items_topics_gin ON items USING GIN(topics);

-- Create trigger function to keep array in sync with junction table
CREATE OR REPLACE FUNCTION sync_item_topics_to_array()
RETURNS TRIGGER AS $$
BEGIN
  -- Handle INSERT and UPDATE
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    UPDATE items
    SET topics = ARRAY(
      SELECT DISTINCT topic 
      FROM item_topics 
      WHERE item_id = NEW.item_id
      ORDER BY topic
    )
    WHERE id = NEW.item_id;
    RETURN NEW;
  END IF;
  
  -- Handle DELETE
  IF (TG_OP = 'DELETE') THEN
    UPDATE items
    SET topics = ARRAY(
      SELECT DISTINCT topic 
      FROM item_topics 
      WHERE item_id = OLD.item_id
      ORDER BY topic
    )
    WHERE id = OLD.item_id;
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Attach trigger to item_topics table
DROP TRIGGER IF EXISTS item_topics_array_sync ON item_topics;
CREATE TRIGGER item_topics_array_sync
AFTER INSERT OR UPDATE OR DELETE ON item_topics
FOR EACH ROW
EXECUTE FUNCTION sync_item_topics_to_array();
