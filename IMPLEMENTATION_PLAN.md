# Implementation Plan: Zero‑API AI Research Web Dashboard

## Overview

Build a local‑first **web dashboard** for AI research, news, and ideas using:

**Data flow:**  
Rust ingestors → Postgres → ElectricSQL → PGlite (browser/WASM) → SvelteKit/Solid UI.

**Current state:** Empty project.  
**Primary goal:** Get the **backend ingestion + Postgres + Electric sync** working for one source (arXiv / Semantic Scholar), then hook it up to a minimal web UI.

---

## Phase 1 – Backend scaffolding (Rust first)

### 1.1 Repo structure

Create a monorepo layout:

- `server/ingestor/` – Rust ingestion service (this is the first thing to build)
- `server/migrations/` – SQL migrations for Postgres
- `infra/` – Docker Compose for Postgres + ElectricSQL
- `web/` – SvelteKit or SolidStart app (added later)

### 1.2 Rust project initialisation

In `server/ingestor`:

- Initialise a new Rust binary crate.
- Add dependencies: `tokio`, `anyhow`, `sqlx`, `reqwest`, `serde`, `serde_json`, `chrono`, `uuid`, `quick-xml` (for arXiv XML).

Goal: a single `cargo run` that connects to Postgres and can run a test query.

---

## Phase 2 – Database & infra

### 2.1 Docker Compose (Postgres + ElectricSQL)

File: `infra/docker-compose.yml`

- Postgres 16 with:
  - `wal_level=logical`  
  - exposed port (e.g. `54321`)
- ElectricSQL sync service:
  - Connected to the same Postgres DB
  - Exposed on a port (e.g. `3000`) for shape streaming

### 2.2 Schema: initial tables

File: `server/migrations/202601240001_init_ai_dashboard.sql`

Start with minimal tables:

- `papers`  
  - `id UUID PRIMARY KEY`  
  - `source TEXT` (e.g., `arxiv`, `semantic_scholar`)  
  - `external_id TEXT UNIQUE` (e.g., `arxiv_id`)  
  - `title TEXT`  
  - `authors TEXT[]`  
  - `abstract TEXT`  
  - `categories TEXT[]`  
  - `published_at TIMESTAMPTZ`  
  - `url TEXT`  
  - `pdf_url TEXT`  
  - `created_at`, `updated_at` timestamps  

You can expand later with `score`, `newsletter_mentions`, etc.

### 2.3 Migrations

- Install `sqlx-cli` and point `DATABASE_URL` at the Docker Postgres.
- Run `sqlx migrate run` from `server/`.

Verify:

- `docker exec -it <postgres-container> psql -U postgres -d <db> -c "\d papers"`

---

## Phase 3 – Rust ingestion pipeline (hourly backend)

### 3.1 Module structure

Inside `server/ingestor/src`:

- `main.rs` – entry point, scheduler loop (runs every hour)
- `config.rs` – load env (DB URL, API keys, intervals)
- `db.rs` – Postgres pool + insert/upsert helpers
- `sources/`
  - `mod.rs`
  - `arxiv.rs` – first real source
  - `semantic_scholar.rs` – enrichment (later)
  - `news.rs`, `newsletters.rs` – to be added

### 3.2 Implement DB pool

- Use `sqlx::PgPool` (with `PgPoolOptions`).  
- Read `DATABASE_URL` from env.  
- Keep the interface small: `insert_or_update_paper(...)`, etc.

### 3.3 First ingestor: ArXiv (cs.AI / cs.LG)

In `sources/arxiv.rs`:

- Fetch: call ArXiv API (`http://export.arxiv.org/api/query`) for recent cs.AI / cs.LG papers.
- Parse: parse Atom XML with `quick-xml` into an internal `Paper` struct.
- Upsert: insert into `papers` with `ON CONFLICT (external_id) DO UPDATE` (or `DO NOTHING` initially).

### 3.4 Scheduler

In `main.rs`:

- Start DB pool.
- Run an infinite loop:
  - Call `run_arxiv_ingestion_cycle(&pool).await`.
  - Sleep for 1 hour (`tokio::time::sleep(Duration::from_secs(3600))`).

This is the critical first task: backend populates Postgres **without any frontend**.

---

## Phase 4 – ElectricSQL sync configuration

### 4.1 ElectricSQL setup

- Configure ElectricSQL to connect to the Postgres instance. [web:49][web:69][web:107]
- Ensure logical replication is enabled and a publication is set up.

### 4.2 Define shapes

Decide initial shapes to expose (e.g. via Electric config):

- `shape_latest_papers` – recent `papers` (e.g. last 30 days, ordered by `published_at`).
- Possibly use filters like `source = 'arxiv'` or specific categories.

Goal: `curl` to the Electric shape endpoint should return your `papers` rows as JSON.

---

## Phase 5 – Web app scaffolding (SvelteKit / SolidStart)

### 5.1 Initialise web project

Under `web/`:

- Create a new SvelteKit or SolidStart project (TypeScript). [web:116][web:119][web:120][web:123]
- Add TailwindCSS for styling.

### 5.2 Add local‑first data stack

Install:

- ElectricSQL TypeScript client. [web:103][web:107]
- PGlite (WASM Postgres). [web:67][web:75][web:77]  
- Drizzle ORM configured for PGlite. [web:108][web:113][web:100]

Configure PGlite + Electric client in a small module (e.g. `web/src/lib/db.ts`) and Drizzle schema for `papers`.

---

## Phase 6 – Minimal dashboard UI (read‑only)

### 6.1 Data hook/store

Implement a small hook or store:

- Example: `useLatestPapers()` or `createLatestPapersStore()`.
- Subscribe to the `shape_latest_papers` Electric shape.
- Expose `papers`, `isLoading`, `error`.

### 6.2 Page & components

Create a simple page:

- Route: `/`  
- Show a table or list of recent papers:
  - Title, primary author(s), published date, source, link.

No filters or advanced UI yet; the goal is **end‑to‑end data from ingestion → Postgres → Electric → browser DB → UI**.

---

## Phase 7 – Validation checklist

- Docker stack (Postgres + ElectricSQL) starts and stays healthy.
- `papers` table exists and has rows from ArXiv.
- Electric shape endpoint returns JSON data for `papers`.
- Web app starts and shows a list of papers without calling custom REST endpoints.
- New ingestion runs (manually or hourly) and new papers appear in the UI without extra wiring.

---

## Next steps (after foundation)

Once the above is working:

1. Add **Semantic Scholar enrichment** (citations, venue, DOI) as a background task.
2. Add **AI news** tables and ingestion (News APIs + curated sources).
3. Add **newsletter issue metadata** for curation signals.
4. Implement **filters** in the UI (by category, source, date range).
5. Add **user data** (bookmarks, tags) as bidirectional synced tables.
6. Consider **semantic search** (vector index in a separate service or in‑browser if feasible).

Backend remains the source of truth; ElectricSQL keeps the browser’s PGlite in sync; the web UI is a thin layer over the local database.
