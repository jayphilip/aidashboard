# CLAUDE.md

## Project: Zero-API AI Research Dashboard (Web)

**Stack:**  
- Backend: Rust, sqlx, Postgres, Docker  
- Sync: ElectricSQL (v2)  
- Web app: SvelteKit (or SolidStart), TypeScript, TailwindCSS  
- Browser DB: PGlite (WASM Postgres) + Drizzle ORM

**Architecture:** Local-first, offline‑friendly, “Zero API” (no custom REST/GraphQL).

**Goal:** A web dashboard for AI trends (papers, news, blogs) where data flows:
Rust Ingestors → Postgres → ElectricSQL → PGlite (browser) → SvelteKit/Solid UI.

---

## Architecture & Patterns

### 1. Zero‑API pattern

- **No custom REST/GraphQL:** The web app never calls bespoke JSON endpoints for app data.
- **Data sync:** Browser subscribes to ElectricSQL **shapes** (partial table streams).
- **Read flow:**  
  `External APIs → Rust ingestors → Postgres → Electric sync → PGlite (browser/WASM) → UI components`.
- **Write flow (later):**  
  `User writes → PGlite → Electric sync → Postgres` (for bookmarks, tags, etc.).

Rust ingestion and Electric sync are the only server‑side data paths.

### 2. Tech stack details

- **Backend (server):**  
  - Rust + Tokio, `reqwest` for HTTP, `sqlx` for Postgres.  
  - Runs on a schedule (e.g., hourly) to pull Semantic Scholar, arXiv, news APIs, newsletters, etc.
- **Database (server):**  
  - Postgres 16 (logical replication enabled) behind ElectricSQL.  
- **Sync layer:**  
  - ElectricSQL sync service (Docker) exposing shapes over HTTP/WebSockets. [web:46][web:69][web:107]
- **Web frontend:**  
  - SvelteKit or SolidStart with TypeScript + TailwindCSS. [web:114][web:116][web:119][web:121]  
  - Data layer: Electric TypeScript client + PGlite + Drizzle ORM (typed queries over local Postgres in WASM). [web:108][web:113][web:100]

---

## Commands (baseline, to adapt per toolchain)

- `docker compose up -d`      # Start Postgres + ElectricSQL
- `cargo run -p ingestor`     # Run Rust ingestion service (or `cargo run` if single crate)
- `sqlx migrate run`          # Apply DB migrations
- `npm run dev`               # Start SvelteKit/SolidStart dev server

Build/test examples:

- `cargo test`                # Rust tests
- `cargo clippy`              # Rust lints
- `npm run lint`              # TS/ESLint
- `npm run check`             # TypeScript check

---

## Code style guidelines

### Rust (backend ingestors)

- **Async:** Use `tokio` everywhere; keep ingestion tasks small and composable.
- **Errors:** `anyhow::Result` for app code, `thiserror` for reusable libraries.
- **Structure (suggested):**
  - `server/ingestor/src/db.rs` – DB pool + queries.
  - `server/ingestor/src/sources/` – modules per source (arxiv, semantic_scholar, news, newsletters).
  - `server/ingestor/src/main.rs` – scheduler loop (e.g., hourly jobs).
- **Crates:**  
  - `reqwest` for HTTP, `sqlx` for DB, `quick-xml` / `serde` for parsing, `chrono` for time.

### TypeScript (web frontend)

- **Data access:** Use ElectricSQL client + Drizzle over PGlite. Avoid `fetch` for app data; use SQL queries on the local DB.
- **Components:** Keep views thin; put data logic in hooks/stores (e.g., `useLatestPapers`, `useAiNews`).
- **Typing:** Strict TS. Mirror DB schema in Drizzle and reuse types in components.

---

## Workflow: adding a new data source

Example: add “AI newsletters” as a source.

1. **Server DB:**  
   - Add migration for `newsletter_issues` and `newsletter_links`.
2. **Ingest (Rust):**  
   - Implement `sources/newsletters.rs` to fetch issue metadata and insert into Postgres.
3. **ElectricSQL:**  
   - Expose `newsletter_issues` in Electric shapes (e.g., `shape_latest_newsletters`).
4. **Client (web):**  
   - Add Drizzle schema for `newsletter_issues`.  
   - Add `useNewsletterIssues()` hook or store querying PGlite via Drizzle.

---

## Debugging

- **Sync issues:**  
  - Check Electric logs (`docker logs electric-service`).  
  - Ensure Postgres `wal_level = logical` and Electric is connected. [web:46][web:69][web:86]
- **Ingestion failures:**  
  - Verify `DATABASE_URL`.  
  - Curl upstream APIs (Semantic Scholar, arXiv, news APIs) directly.  
  - Check Rust logs for detailed errors.
- **Frontend data issues:**  
  - Inspect PGlite DB via Drizzle debug / dev tooling. [web:108][web:113][web:100]  
  - Confirm Electric shapes are subscribed and emitting updates.