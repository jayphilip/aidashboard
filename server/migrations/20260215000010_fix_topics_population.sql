-- Migration: Fix topics array population with more efficient query
-- Created: 2026-02-15
-- Fixes timeout issue from migration 20260201000007

-- Use a more efficient JOIN-based update instead of correlated subquery
UPDATE items i
SET topics = COALESCE(topic_arrays.topics, '{}')
FROM (
  SELECT
    item_id,
    ARRAY_AGG(DISTINCT topic ORDER BY topic) as topics
  FROM item_topics
  GROUP BY item_id
) AS topic_arrays
WHERE i.id = topic_arrays.item_id
AND i.topics = '{}'; -- Only update items that haven't been populated yet

-- Note: This is much faster because:
-- 1. It's a single pass join instead of a correlated subquery
-- 2. Only updates items that need updating (topics = '{}')
-- 3. Uses ARRAY_AGG which is optimized for aggregation
