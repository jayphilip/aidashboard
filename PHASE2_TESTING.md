# Phase 2 Testing Guide

Phase 2 implements the generic ingestion dispatcher that routes to different source types based on database configuration.

## Key Changes

### 1. **Generic Ingestion Dispatcher** (`src/sources/mod.rs`)
- `run_ingestion_cycle()` loads active sources from database
- Routes each source to appropriate ingestor based on `source.type`:
  - `arxiv` → arXiv API ingestion
  - `rss` → RSS feed ingestion (TODO)
  - `twitter_api` → Twitter API ingestion (TODO)
  - `manual` → No automated ingestion (placeholder)
- Gracefully handles errors per-source (continues if one fails)

### 2. **Refactored Main Loop** (`src/main.rs`)
- Now calls `run_ingestion_cycle()` instead of `run_arxiv_ingestion()`
- Single configuration controls all sources

### 3. **Database Schema Updates**
- `sources` table stores feed configurations
- `items` table stores unified content
- `item_topics` table for topic tagging
- `item_likes` table for user ratings
- All tables included in Electric publication for sync

## Testing Steps

### Step 1: Start Infrastructure
```bash
cd infra
docker-compose up -d
cd ..
```

### Step 2: Run Migrations
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:54321/aidashboard
sqlx migrate run --source ./server/migrations
```

This will:
1. Create `papers` table (legacy)
2. Create `sources`, `items`, `item_topics`, `item_likes` tables
3. Seed default `arxiv-qfin` source

### Step 3: Verify Database Setup
```bash
psql $DATABASE_URL -c "
SELECT 
  s.id, s.name, s.type, s.medium, s.active, 
  COUNT(i.id) as item_count
FROM sources s
LEFT JOIN items i ON s.id = i.source_id
GROUP BY s.id, s.name, s.type, s.medium, s.active
ORDER BY s.id;
"
```

Expected output should show `arxiv-qfin` source with 0 items initially.

### Step 4: Build and Run Ingestor
```bash
cd server/ingestor
cargo build --release
cargo run --bin ingestor
```

The ingestor will:
1. Load active sources from database (should find `arxiv-qfin`)
2. Route to arXiv ingestion
3. Fetch papers from arXiv API
4. Insert items into the `items` table
5. Sleep and repeat based on configured interval

### Step 5: Verify Items Were Inserted
```bash
psql $DATABASE_URL -c "
SELECT id, title, url, published_at, source_id 
FROM items 
ORDER BY published_at DESC 
LIMIT 10;
"
```

You should see ~100 items from the arXiv query (q-fin.GN category).

### Step 6: Check Item Metadata
```bash
psql $DATABASE_URL -c "
SELECT 
  id, 
  title,
  raw_metadata->>'arxiv_id' as arxiv_id,
  raw_metadata->'categories' as categories,
  raw_metadata->>'pdf_url' as pdf_url
FROM items 
LIMIT 5;
"
```

All arXiv-specific data should be stored in the `raw_metadata` JSONB field.

## Testing Multiple Sources (Future)

Once RSS ingestion is implemented, you can add more sources:

```bash
psql $DATABASE_URL -c "
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
  'hacker-news',
  'rss',
  'blog',
  'https://news.ycombinator.com/rss',
  true,
  'hourly',
  '{}'::jsonb
);
"
```

The dispatcher will automatically route it to RSS ingestion once implemented.

## Architecture Notes

The dispatcher uses a match statement to route by source type:

```rust
pub async fn run_ingestion_cycle(pool: &PgPool, arxiv_api_url: &str) -> Result<u64> {
    let sources = crate::db::get_active_sources(pool).await?;
    
    for source in sources {
        match source.source_type.as_str() {
            "arxiv" => run_arxiv_ingestion(pool, arxiv_api_url).await?,
            "rss" => { /* todo */ }
            "twitter_api" => { /* todo */ }
            _ => { /* unknown source type */ }
        }
    }
}
```

This makes it easy to add new source types without changing the main loop or database structure.

## Next Steps (Phase 3)

1. Implement RSS ingestion (`ingest_from_rss()`)
2. Add newsletter/blog sources to the database
3. Implement topic tagging (rule-based keyword matching)
4. Update web frontend to query `items` table instead of `papers`
5. Add item_topics and item_likes support to frontend
