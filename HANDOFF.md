# Implementation Plan: Phase 4 (ElectricSQL) + Phase 5 (SvelteKit Web App)

## Overview
Implement the Zero-API data sync layer (ElectricSQL) and build the SvelteKit frontend to display papers from the local browser database (PGlite).

**Architecture:** Rust → Postgres → ElectricSQL → PGlite (browser) → SvelteKit UI

---

## Phase 4: ElectricSQL Configuration

### Critical Fix: ElectricSQL Container Not Starting
**Issue:** ElectricSQL requires `ELECTRIC_INSECURE=true` environment variable to start in development.

**File to modify:** `infra/docker-compose.yml`

Add to electric service environment:
```yaml
ELECTRIC_INSECURE: "true"
```

**Commands:**
```bash
cd infra
docker compose down
docker compose up -d
docker logs aidashboard-electric  # Verify startup
curl http://localhost:3000/v1/health  # Should return healthy status
```

### Create Postgres Publication
**New file:** `server/migrations/20260124000002_electric_publication.sql`

```sql
CREATE PUBLICATION electric_publication FOR ALL TABLES;
```

**Apply migration:**
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:54321/aidashboard
sqlx migrate run --source ./server/migrations
```

### Test Shape Endpoint
```bash
curl "http://localhost:3000/v1/shape?table=papers&offset=-1&subset__order_by=published_at%20DESC&subset__limit=10" | jq '.rows[0]'
 # Should return first paper
curl "http://localhost:3000/v1/shape?table=papers&offset=-1&subset__order_by=published_at%20DESC&subset__limit=50" | jq '.[keys[0]] | length' # Should return 50
```

**Phase 4 Complete When:**
- ElectricSQL container running without errors - yes
- Publication exists in Postgres - yes
- Shape endpoint returns JSON array of 50 papers - yes

---

## Phase 5: SvelteKit Web App

### 5.1: Initialize SvelteKit Project
```bash
cd /Users/jasonalbert/Documents/Projects/aidashboard
npm create svelte@latest web
# Select: Skeleton project, TypeScript, Prettier, ESLint

cd web
npm install
npm install -D @sveltejs/adapter-static
```

**Configure static adapter** in `web/svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-static';

export default {
  kit: {
    adapter: adapter({ fallback: 'index.html' })
  }
};
```

### 5.2: Add TailwindCSS
```bash
cd web
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

**Create:** `web/tailwind.config.js`
```javascript
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: { extend: {} },
  plugins: []
};
```

**Create:** `web/src/app.css`
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

**Create:** `web/src/routes/+layout.svelte`
```svelte
<script>
  import '../app.css';
</script>

<slot />
```

### 5.3: Install Data Layer
```bash
cd web
npm install @electric-sql/client @electric-sql/pglite drizzle-orm
```

### 5.4: Database Infrastructure

**Create:** `web/src/lib/db.ts`
- Initialize PGlite (WASM Postgres in browser)
- Initialize Drizzle ORM over PGlite
- Export Electric shape stream helper

**Create:** `web/src/lib/schema.ts`
- Drizzle schema mirroring server `papers` table
- Include all fields: id, source, externalId, title, authors[], abstract, categories[], publishedAt, url, pdfUrl, timestamps

### 5.5: Data Sync Store

**Create:** `web/src/lib/stores/papers.ts`
- Reactive Svelte store for papers data
- Initialize Electric shape stream for `papers` table
- Handle insert/update/delete operations from shape
- Sync to PGlite
- Provide reactive access to papers with loading/error states
- Export: `papers$` (data), `papersState` (loading/error), `initializePapersSync()`, `cleanupPapersSync()`

### 5.6: Main UI

**Create:** `web/src/routes/+page.svelte`
- Initialize sync on mount
- Cleanup on destroy
- Display states:
  - Loading: spinner + "Loading papers..."
  - Error: error message with details
  - Empty: "No papers found"
  - Data: Table showing papers with columns:
    - Title + abstract excerpt
    - Authors (first 2 + "et al.")
    - Published date
    - Categories (badges)
    - Source badge
    - Link to paper

### 5.7: Environment Config

**Create:** `web/.env`
```bash
PUBLIC_ELECTRIC_URL=http://localhost:3000
```

### 5.8: Run Development Server
```bash
cd web
npm run dev
# Open http://localhost:5173
```

**Phase 5 Complete When:**
- SvelteKit dev server runs without errors
- Browser displays table of 50 papers
- Data matches Postgres (verify title, authors, dates)
- No fetch() calls for app data (only Electric shapes)

---

## Critical Files to Create/Modify

### Phase 4
1. `infra/docker-compose.yml` - Add `ELECTRIC_INSECURE: "true"`
2. `server/migrations/20260124000002_electric_publication.sql` - Create publication

### Phase 5
1. `web/svelte.config.js` - Configure static adapter
2. `web/tailwind.config.js` - TailwindCSS config
3. `web/src/app.css` - Tailwind imports
4. `web/src/routes/+layout.svelte` - CSS import
5. `web/src/lib/db.ts` - PGlite + Electric setup
6. `web/src/lib/schema.ts` - Drizzle schema
7. `web/src/lib/stores/papers.ts` - Sync logic + reactive store
8. `web/src/routes/+page.svelte` - Main UI page
9. `web/.env` - Electric URL config

---

## Verification Checklist

### Phase 4
- [ ] `docker ps | grep electric` shows container running
- [ ] `curl http://localhost:3000/v1/health` returns success
- [ ] `curl http://localhost:3000/v1/shape/papers | jq 'length'` returns 50
- [ ] Electric logs show no errors

### Phase 5
- [ ] `npm run dev` starts without errors
- [ ] `npm run check` passes TypeScript checks
- [ ] Browser at `http://localhost:5173` displays papers table
- [ ] Browser console shows no errors
- [ ] Papers count matches database (50)
- [ ] Paper titles/authors match database records

### End-to-End
- [ ] Run `cargo run -p ingestor` to fetch new papers
- [ ] New papers appear in UI without refresh (reactive sync)
- [ ] No custom API endpoints exist (Zero-API architecture verified)
- [ ] Data flows: Rust → Postgres → Electric → PGlite → UI

---

## Potential Issues

**Issue:** ElectricSQL shape returns empty array
- **Fix:** Restart Electric after creating publication: `docker compose restart electric`
- **Verify:** `docker exec aidashboard-postgres psql -U postgres -d aidashboard -c "SELECT * FROM pg_publication_tables;"`

**Issue:** CORS errors accessing Electric from browser
- **Fix:** Electric allows localhost by default in insecure mode (already configured)

**Issue:** PGlite WASM loading errors
- **Fix:** Add to `web/vite.config.js`:
  ```javascript
  export default {
    optimizeDeps: { exclude: ['@electric-sql/pglite'] }
  }
  ```

**Issue:** Shape stream not updating PGlite
- **Fix:** Add console.log in shape subscription handler to debug message flow
- **Check:** Network tab for active connections to Electric

---

## Success Criteria
1. ElectricSQL streams papers data over HTTP shapes
2. SvelteKit app displays all 50 papers in a table
3. No fetch() calls for app data (Zero-API)
4. Real-time sync: new ingestion → appears in UI automatically
5. All TypeScript checks pass
6. UI is responsive and styled with Tailwind