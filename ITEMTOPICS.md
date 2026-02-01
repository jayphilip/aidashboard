# Item Topics Array Migration Plan

## Overview
Migrate from syncing 120K `item_topics` rows to embedding topics as TEXT[] in the `items` table. This reduces sync time from 60s+ to ~10s and client storage from ~50MB to ~5MB while maintaining all functionality.

## Architecture Decision
**Hybrid approach**: Keep normalized junction table on server for analytics/flexibility, sync denormalized array to clients for performance.

---

## Server-Side Changes

### 1. Database Migration

```sql
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
Deploy:

bash
# Save above SQL to migration file
docker exec -it aidashboard-postgres psql -U postgres -d aidashboard < server/migrations/add_topics_array.sql
2. Verify Migration
sql
-- Check that topics were populated
SELECT 
  COUNT(*) as total_items,
  COUNT(*) FILTER (WHERE topics IS NOT NULL AND array_length(topics, 1) > 0) as items_with_topics,
  AVG(array_length(topics, 1)) as avg_topics_per_item
FROM items;

-- Verify trigger works (insert test topic)
INSERT INTO item_topics (item_id, topic) 
VALUES ((SELECT id FROM items LIMIT 1), 'test-topic');

-- Check that items.topics updated
SELECT topics FROM items WHERE 'test-topic' = ANY(topics);

-- Clean up test
DELETE FROM item_topics WHERE topic = 'test-topic';
Client-Side Changes
3. Update Client Schema (web/src/lib/db.ts)
typescript
// In the CREATE TABLE IF NOT EXISTS items section, add:
CREATE TABLE IF NOT EXISTS items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id INTEGER,
  source_type TEXT CHECK (source_type IN ('paper', 'newsletter', 'blog', 'tweet')),
  title TEXT,
  url TEXT,
  summary TEXT,
  body TEXT,
  published_at TIMESTAMPTZ,
  raw_metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  topics TEXT[] DEFAULT '{}'  -- ADD THIS LINE
);
4. Update Drizzle Schema (web/src/lib/schema.ts)
typescript
import { pgTable, uuid, integer, text, timestamp, jsonb } from 'drizzle-orm/pg-core';

export const items = pgTable('items', {
  id: uuid('id').primaryKey().defaultRandom(),
  sourceId: integer('source_id'),
  sourceType: text('source_type'),
  title: text('title'),
  url: text('url'),
  summary: text('summary'),
  body: text('body'),
  publishedAt: timestamp('published_at', { withTimezone: true }),
  rawMetadata: jsonb('raw_metadata').default('{}'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
  topics: text('topics').array().default([]),  // ADD THIS LINE
});

// Keep itemTopics schema for type compatibility, even though we wont sync it
export const itemTopics = pgTable('item_topics', {
  id: integer('id').primaryKey(),
  itemId: uuid('item_id'),
  topic: text('topic'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
});
5. Update TypeScript Types (web/src/lib/items.ts)
typescript
export interface Item {
  id: string;
  sourceId: number | null;
  sourceType: string;
  title: string;
  url: string;
  summary: string | null;
  body: string | null;
  publishedAt: Date;
  rawMetadata: any;
  createdAt: Date;
  updatedAt: Date;
  topics: string[];  // ADD THIS LINE
}

// InferSelectModel will also work if using Drizzle types
export type Item = InferSelectModel<typeof items>;
6. Remove item_topics from Sync (web/src/contexts/ItemsContext.tsx)
typescript
// Change totalShapes from 4 to 3
let completedShapes = new Set<string>();
const totalShapes = 3; // items, sources, item_likes only (removed item_topics)

// DELETE the entire item_topics stream block:
/*
const topicsStream = new ShapeStream({ ... });
topicsStream.subscribe(async (messages) => { ... });
*/

// Keep only: itemsStream, sourcesStream, likesStream
7. Handle Topics Array Parsing in Items Stream
PostgreSQL arrays come as strings in JSON, need parsing:

typescript
// In itemsStream.subscribe, after type conversions:
if (message.value) {
  itemCount++;
  
  const itemData = { ...message.value };
  
  // Convert source_id from string to integer
  if (itemData.source_id) {
    itemData.source_id = parseInt(itemData.source_id, 10);
  }
  
  // Parse topics array from PostgreSQL format
  if (itemData.topics) {
    if (typeof itemData.topics === 'string') {
      // Handle PostgreSQL array format: "{topic1,topic2,topic3}"
      itemData.topics = itemData.topics
        .replace(/^\{|\}$/g, '') // Remove { }
        .split(',')
        .map(t => t.trim())
        .filter(Boolean);
    } else if (!Array.isArray(itemData.topics)) {
      // Fallback: ensure its an array
      itemData.topics = [];
    }
  } else {
    itemData.topics = [];
  }
  
  // Validate required fields
  if (!itemData.id || !itemData.title || !itemData.url) {
    console.warn('[ItemsSync] Missing required fields, skipping item');
    continue;
  }
  
  itemBatch.push(itemData);
  
  if (itemCount % 100 === 0) {
    console.log(`[ItemsSync] items: Processed ${itemCount}...`);
  }
  
  if (itemBatch.length >= BATCH_SIZE) {
    await flushBatch('items', itemBatch, pg);
    itemBatch = [];
  }
}
8. Update Topic Queries (web/src/lib/items.ts)
typescript
/**
 * Get all unique topics from items (using array column)
 */
export async function getAllTopics(): Promise<string[]> {
  try {
    const pg = await getPGlite();
    
    // Use unnest to extract all unique topics from arrays
    const result = await pg.query(`
      SELECT DISTINCT unnest(topics) as topic
      FROM items
      WHERE topics IS NOT NULL AND array_length(topics, 1) > 0
      ORDER BY topic
    `);
    
    return result.rows.map(r => r.topic);
  } catch (err) {
    logger.warn('Failed to get topics:', err);
    return [];
  }
}

/**
 * Get items by topic (using array operators)
 */
export async function getItemsByTopics(topics: string[]): Promise<Item[]> {
  try {
    const pg = await getPGlite();
    
    // Use PostgreSQL array overlap operator (&&)
    const result = await pg.query(`
      SELECT *
      FROM items
      WHERE topics && $1
      ORDER BY COALESCE(published_at, created_at) DESC
    `, [topics]);
    
    return result.rows;
  } catch (err) {
    logger.warn('Failed to get items by topics:', err);
    return [];
  }
}

/**
 * Search items with topic filter (update existing searchItems function)
 */
// In searchItems function, update topic filtering:
if (topics && topics.length > 0) {
  // OLD (wont work without item_topics table):
  // allConditions.push(inArray(itemTopics.topic, topics!));
  
  // NEW (using array column):
  allConditions.push(sql`${items.topics} && ${topics}`);
}
9. Update Components Using Topics
Topics are now directly on the item object:

typescript
// Before (if you were joining):
const itemsWithTopics = await db
  .select({ item: items, topics: itemTopics })
  .from(items)
  .leftJoin(itemTopics, eq(items.id, itemTopics.itemId));

// After (topics are embedded):
const items = await getAllItems();
// Each item already has .topics array

// In components:
function ItemCard({ item }: { item: Item }) {
  return (
    <Box>
      <Text>{item.title}</Text>
      
      {/* Display topics directly */}
      <Flex gap={2} flexWrap="wrap">
        {item.topics.map(topic => (
          <Badge key={topic} colorScheme="purple">
            {topic}
          </Badge>
        ))}
      </Flex>
    </Box>
  );
}
Deployment Steps
1. Run Server Migration
bash
docker exec -it aidashboard-postgres psql -U postgres -d aidashboard -f server/migrations/add_topics_array.sql
2. Verify Server Migration
bash
docker exec -it aidashboard-postgres psql -U postgres -d aidashboard -c "
SELECT COUNT(*) as items_with_topics 
FROM items 
WHERE array_length(topics, 1) > 0;
"
3. Update and Rebuild Client
bash
# Make all client code changes above
docker compose -f docker-compose.prod.yml build web
docker compose -f docker-compose.prod.yml up -d web
4. Clear Client Storage
Users need to clear IndexedDB to get new schema:

javascript
// In browser console, or add auto-clear on version bump
localStorage.clear();
const dbs = await indexedDB.databases();
for (const db of dbs) {
  indexedDB.deleteDatabase(db.name);
}
location.reload();
5. Verify Sync Performance
Check console logs:

text
[ItemsSync] items complete - 3054 total
[ItemsSync] sources complete - 20 total
[ItemsSync] item_likes complete - 0 total
[ItemsSync] ✅ Sync complete
[ItemsSync] 📊 Local DB stats: {total: 3054, latest: '2026-01-30...'}
Should complete in ~10-15 seconds instead of 60+.

Rollback Plan
If something breaks:

Rollback Client
typescript
// Re-add item_topics to sync
const totalShapes = 4;

const topicsStream = new ShapeStream({
  url: `${baseUrl}?table=item_topics`,
});
// ... restore original topic sync code
Keep Server Changes
The trigger and topics array dont hurt anything. Junction table still works normally.





