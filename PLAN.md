## Goal

Extend existing Rust → Postgres → Electric → PGlite → SvelteKit stack (currently ingesting AI papers) into a unified “AI intel” dashboard that also ingests newsletters, blogs, and tweets, and surfaces papers, trends, and thought leaders in one UI. [web:440][web:447][web:446]

---

## Phase 1 – Unify data model

### 1. Add `sources` table

Define a generic table for any upstream feed (arXiv, RSS, Twitter, manual, etc.):

- `sources`
  - `id` (PK)
  - `name` (text)
  - `type` (text, e.g. `'arxiv' | 'rss' | 'twitter_api' | 'manual'`)
  - `medium` (text, e.g. `'paper' | 'newsletter' | 'blog' | 'tweet'`)
  - `ingest_url` (text, nullable; e.g. RSS URL, API endpoint)
  - `active` (bool, default true)
  - `frequency` (text, e.g. `'hourly' | 'daily'`)
  - `meta` (jsonb, optional)

Tasks:

- Write SQL migration for `sources`. [web:440][web:447]
- Generate Rust model / ORM types.
- Add to Electric schema for replication.

### 2. Introduce `items` table as unified content model

Normalize all content (papers, newsletters, blogs, tweets) into one `items` table:

- `items`
  - `id` (UUID PK)
  - `source_id` (FK → `sources.id`)
  - `source_type` (text) – mirror `sources.medium` for quick filters
  - `title` (text)
  - `url` (text)
  - `summary` (text, nullable)
  - `body` (text, nullable) – for full content where applicable
  - `published_at` (timestamptz)
  - `raw_metadata` (jsonb)
  - `created_at` (timestamptz, default now)

Migration / backfill:

- Create a `sources` row representing the existing arXiv feed (`type='arxiv'`, `medium='paper'`). [web:446]
- Backfill `items` from current `papers` table:
  - `papers.title` → `items.title`
  - `papers.link` → `items.url`
  - `papers.abstract` → `items.summary`
  - `papers.published_at` → `items.published_at`
  - other fields (arxiv_id, categories, etc.) → `items.raw_metadata`.
- Optionally keep `papers` as legacy; gradually update all code paths to use `items`. [web:440]

### 3. Topic and preference support

If not already present, add tables for topics and user feedback, similar to unified news/Twitter representations. [web:446]

- `item_topics`
  - `item_id` (FK → `items.id`)
  - `topic` (text)
- `item_likes`
  - `user_id`
  - `item_id` (FK → `items.id`)
  - `score` (int, e.g. -1, 0, 1)

Tasks:

- SQL migrations for `item_topics` and `item_likes`.
- Indexes:
  - `item_topics(topic, item_id)`
  - `item_likes(user_id, item_id)`

---

## Phase 2 – Refactor existing ingestor to use `sources`/`items`

### 4. Rust domain types

Define core enums and structs:

```rust
enum Medium {
    Paper,
    Newsletter,
    Blog,
    Tweet,
}

enum SourceType {
    Arxiv,
    Rss,
    TwitterApi,
    Manual,
}

struct Source {
    id: i32,
    name: String,
    source_type: SourceType,
    medium: Medium,
    ingest_url: Option<String>,
    active: bool,
    frequency: String,
    meta: serde_json::Value,
}

struct Item {
    id: Uuid,
    source_id: i32,
    source_type: Medium,
    title: String,
    url: String,
    summary: Option<String>,
    body: Option<String>,
    published_at: DateTime<Utc>,
    raw_metadata: serde_json::Value,
}
```

Implementation details:

Add conversions to/from DB rows.

Make Medium and SourceType serde-serializable for JSON fields / config if needed. [web:440][web:447]

5. Create a generic ingestion dispatcher
Replace a single ingest_arxiv() entrypoint with:

```rust
async fn run_ingestion_cycle(db: &DbPool) -> anyhow::Result<()> {
    let sources = load_active_sources(db).await?;
    for source in sources {
        match source.source_type {
            SourceType::Arxiv => ingest_from_arxiv(db, &source).await?,
            SourceType::Rss => ingest_from_rss(db, &source).await?,
            SourceType::TwitterApi => ingest_from_twitter(db, &source).await?,
            SourceType::Manual => { /* no-op or manual hook */ }
        }
    }
    Ok(())
}
```

Tasks:

Each ingest_from_* function:

Reads configuration from source (and source.meta). [web:447]

Fetches new records from upstream.

Maps them into Item structs.

Upserts into items with de-duplication.

De-duplication strategy:

Prefer a stable external id from raw_metadata (e.g. arxiv_id, tweet_id).

Fallback to (source_id, url) or (source_id, title, published_at).

6. Adapt existing arXiv ingestor
Refactor current arXiv code to:

Read categories, query parameters, etc. from source.meta.

Produce Item instances instead of legacy Paper structs.

Store arXiv-specific fields (id, categories, versions) inside raw_metadata. [web:446]

This preserves all existing functionality while feeding the unified items table.

7. Wire through Electric and PGlite
Update Electric configuration to replicate:

sources

items

item_topics

item_likes

Ensure PGlite schema matches, so the browser can query everything locally.

Remove or de-prioritize replication of legacy papers once the UI is migrated. [web:440][web:447]

## Phase 3 – Add newsletters and blogs via RSS

8. Seed newsletter/blog sources
Manually insert a small curated set of RSS-based sources into sources:

type = 'rss'

medium = 'newsletter' or 'blog'

ingest_url = '<RSS_URL>'

active = true

frequency = 'hourly' or 'daily'

meta can hold:

{"language": "en", "priority": 1.0} etc.

Start with a few high-signal feeds you actually read. [web:446]

9. Implement ingest_from_rss(source: &Source)
Steps:

Use an RSS/Atom client in Rust to fetch source.ingest_url. [web:440]

Parse feed entries.

For each entry, build an Item:

title from feed title.

url from entry link.

summary from description or content snippet.

body from full content when available (optional).

published_at from entry publication date; fallback to now.

raw_metadata for anything extra (author, categories, feed id).

Upsert into items with de-duplication by (source_id, url) or feed item id in raw_metadata.

Add basic error handling and logging; skip malformed entries but don’t break the whole cycle. [web:447]

10. Topic tagging
Implement a simple topic tagger applied after ingest, similar to unified Twitter/news models. [web:446][web:452]

Inputs:

Item.title

Item.summary or body

Output:

A small set of topics (e.g. ["LLM", "RL", "multimodal", "systems", "alignment"]).

Start rule-based:

Keyword matching + heuristics.

Store results in item_topics:

One row per (item, topic).

You can later replace this with an embedding-based or ML classifier, without changing the schema. [web:452]

## Phase 4 – Dashboard UX

11. “Today” page (3 lanes)
Build a main dashboard page with three lanes:

Papers lane

Query:

items where source_type = 'paper'

published_at >= now() - interval '1 day' (or configurable window)

Sort:

by a score combining recency, topic match, and like history.

Newsletters/blogs lane

Query:

items where source_type IN ('newsletter', 'blog')

Recent window (e.g. last 3 days).

Same scoring approach as papers.

Social lane (future tweets)

Query:

items where source_type = 'tweet'

For now, you can stub or leave empty until Twitter ingestion is implemented.

Card UI per item:

Show:

title

source name (join items.source_id → sources.name)

published date

one-line summary

Actions:

“Open”

“Like” / “Dislike” (writes to item_likes)

Optional “Save” / “Mark read”

This mirrors how unified news/Twitter dashboards expose multi-source streams. [web:446][web:449]

12. Topic trends view
Create a /topics page that aggregates across media:

For each topic:

Compute weekly counts of items:

count(*) grouped by week(published_at), filtered by item_topics.topic.

Optional: separate counts per source_type (papers vs newsletters/blogs).

UI:

List or table with:

topic name

small sparkline graph for last N weeks

total items and total liked items.

Filter controls:

Time range (e.g. 4 weeks, 3 months).

Media type (papers / newsletters+blogs / tweets). [web:446]

13. Sources admin view
Add a simple admin page:

List all sources:

name

type

medium

active

last ingested time (if you track this)

Actions:

Toggle active on/off.

Edit ingest_url and frequency.

Add new sources (RSS URLs, etc.).

This is standard for ingestion pipeline management. [web:444][web:450]

## Phase 5 – Tweets (optional, later)
14. Add Twitter/X sources
Insert new rows into sources for Twitter:

type = 'twitter_api'

medium = 'tweet'

meta holds:

query type: {"mode": "list", "list_id": "..."}

or {"mode": "user_timeline", "handle": "..."}

This mirrors unified Twitter/news ingestion patterns. [web:446][web:452]

15. Implement ingest_from_twitter(source)
Depending on what API or workaround you use:

Fetch recent tweets for the configured handle/list/search. [web:446]

Map to Item:

summary or body = tweet text.

url = tweet URL.

published_at = tweet created_at.

raw_metadata = JSON with tweet id, author handle, metrics, etc.

De-duplicate using tweet id in raw_metadata.

16. Noise control
Implement basic noise controls in queries, as recommended for multi-source dashboards. [web:447][web:440]

Per-source weights:

Store weight in sources.meta, e.g. {"weight": 1.0}.

In scoring for “Today”:

score = (recency_score + topic_score + like_history_score) * source_weight.

Hard caps per lane:

e.g. max 10 tweets, 10 newsletter/blog items, X papers per day.

Deliverables for Claude
Ask Claude to produce, step by step:

SQL migrations:

sources

items

item_topics

item_likes

Backfill script from papers → items.

Rust code:

Enums (Medium, SourceType) and structs (Source, Item).

DB mappers for Source and Item.

run_ingestion_cycle dispatcher.

Refactored ingest_from_arxiv.

New igest_from_rss.

Electric/PGlite:

Updated replication config for new tables.

SvelteKit:

“Today” page with three lanes.

“Topics” page for trends.

“Sources” admin page.