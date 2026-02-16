# Bidirectional Sync with ElectricSQL

This project implements bidirectional sync between the browser (PGlite) and server (Postgres) using ElectricSQL v2.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐  │
│  │   UI     │◄────►│  PGlite  │◄────►│ Electric Client  │  │
│  │Components│      │  (WASM)  │      │   (ShapeStream)  │  │
│  └──────────┘      └──────────┘      └──────────────────┘  │
│       │ writes             │                    │ reads      │
│       ▼                    │                    ▼            │
│  ┌──────────┐              │           ┌──────────────┐     │
│  │Write API │              │           │ ElectricSQL  │     │
│  │  Client  │              │           │   Sync       │     │
│  └──────────┘              │           └──────────────┘     │
└───────┼────────────────────┼────────────────────┼───────────┘
        │                    │                    │
        │ HTTP POST/PATCH    │ Optimistic        │ WebSocket
        │ /DELETE            │ local update      │ sync
        ▼                    ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                         Server                               │
│  ┌──────────┐      ┌──────────┐      ┌──────────────────┐  │
│  │Write API │─────►│ Postgres │◄─────│  ElectricSQL     │  │
│  │ (Node)   │      │  (Main)  │      │  Sync Service    │  │
│  └──────────┘      └──────────┘      └──────────────────┘  │
│       :3001             :5432               :3000            │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### Read Path (Server → Client)
1. Rust ingestor writes data to Postgres
2. ElectricSQL sync service detects changes via logical replication
3. Electric streams changes to browser via ShapeStream
4. Changes are applied to PGlite (browser WASM Postgres)
5. UI reads from PGlite and displays data

### Write Path (Client → Server)
1. User interacts with UI (e.g., creates/edits a source)
2. UI calls write API endpoint (HTTP POST/PATCH/DELETE)
3. Write API server writes directly to server Postgres
4. ElectricSQL detects change via logical replication
5. Electric syncs update to all connected clients (typically < 1 second)
6. PGlite receives update and UI refreshes automatically

## Pattern: Online Writes

This implementation uses ElectricSQL's **Pattern #1 (Online Writes)**:

- **Best for**: Admin UIs, configuration pages, infrequent writes
- **Requires**: Online connectivity for writes
- **Benefits**: Simple, maintainable, no conflict resolution needed
- **UX**: Updates appear within 1 second via Electric sync
- **Note**: No optimistic updates to avoid PGlite API complexity

Reference: [ElectricSQL Writes Guide](https://electric-sql.com/docs/guides/writes)

## Components

### 1. Write API Server ([server.ts](web/server.ts))

Simple Node.js HTTP server that provides CRUD endpoints for sources:

```
POST   /api/sources       - Create source
PATCH  /api/sources/:id   - Update source
DELETE /api/sources/:id   - Delete source
GET    /health            - Health check
```

**Environment Variables:**
- `DATABASE_URL` - Postgres connection string
- `API_PORT` - Server port (default: 3001)

### 2. Client Library ([web/src/lib/sources.ts](web/src/lib/sources.ts))

Functions for source management with bidirectional sync:

```typescript
createSource()        // POST to API + optimistic PGlite insert
updateSource()        // PATCH to API + optimistic PGlite update
deleteSource()        // DELETE to API + optimistic PGlite delete
toggleSourceActive()  // PATCH to API + optimistic PGlite update
```

Each function:
1. Writes to server via API (authoritative)
2. Optimistically updates local PGlite (instant UX)
3. Awaits Electric sync to overwrite with server truth

## Running Locally

### Development Mode

Start both API server and web app:

```bash
cd web
npm run dev:all
```

Or start separately:

```bash
# Terminal 1 - API Server
cd web
npm run api

# Terminal 2 - Web App
cd web
npm run dev
```

### With Docker Compose

The production setup includes the API server:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Services:
- **postgres** - Main database (port 5432)
- **electric** - Sync service (port 3000)
- **api** - Write API (port 3001)
- **web** - Frontend (port 5173)
- **ingestor** - Background data ingestion

## Configuration

### Environment Variables

**Web App** ([web/.env.local](web/.env.local)):
```bash
VITE_ELECTRIC_URL=http://localhost:3000  # Electric sync service
VITE_API_URL=http://localhost:3001      # Write API server
```

**API Server**:
```bash
DATABASE_URL=postgresql://postgres:changeme@localhost:5432/aidashboard
API_PORT=3001
```

**Docker Compose** ([docker-compose.prod.yml](docker-compose.prod.yml)):
```yaml
environment:
  ELECTRIC_WRITE_TO_PG_MODE: direct  # Enable writes (for Electric config)
```

## Testing the Sync

### 1. Test API Directly

```bash
# Create source
curl -X POST http://localhost:3001/api/sources \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Source",
    "type": "rss",
    "medium": "blog",
    "ingestUrl": "https://example.com/feed.xml",
    "active": true
  }'

# Update source
curl -X PATCH http://localhost:3001/api/sources/1 \
  -H "Content-Type: application/json" \
  -d '{"active": false}'

# Delete source
curl -X DELETE http://localhost:3001/api/sources/1
```

### 2. Test via UI

1. Open browser to http://localhost:5173
2. Navigate to Sources page
3. Click "New Source" button
4. Fill in form and click "Save"
5. **Watch DevTools Console** for sync logs:
   ```
   [ItemsSync] sources: Received update for source 21
   ```
6. Changes appear immediately (optimistic) then refresh from server

### 3. Verify in Database

```bash
# Check Postgres directly
docker exec aidashboard-postgres psql -U postgres -d aidashboard \
  -c "SELECT id, name, type, active FROM sources ORDER BY id DESC LIMIT 5;"
```

### 4. Multi-Client Sync Test

1. Open app in **two browser tabs**
2. Create/edit a source in tab 1
3. Watch tab 2 update automatically via Electric sync
4. Verify both show same data

## Troubleshooting

### API Server Not Starting

**Check logs:**
```bash
npm run api  # Look for connection errors
```

**Verify Postgres is running:**
```bash
docker ps | grep postgres
```

**Test database connection:**
```bash
psql "postgresql://postgres:changeme@localhost:5432/aidashboard" -c "SELECT 1"
```

### Writes Not Syncing

**Check Electric logs:**
```bash
docker logs aidashboard-electric --tail=50
```

**Verify logical replication:**
```bash
docker exec aidashboard-postgres psql -U postgres -d aidashboard \
  -c "SHOW wal_level;"  # Should be 'logical'
```

**Check Electric connection:**
```bash
curl http://localhost:3000/v1/shape?table=sources
```

### Browser Console Errors

**CORS errors:**
- API server includes CORS headers, but check console
- Verify `VITE_API_URL` matches actual API server URL

**Network errors:**
- Check API server is running: `curl http://localhost:3001/health`
- Verify firewall/port forwarding if using Docker

**Sync not happening:**
- Check Electric URL in console logs
- Verify WebSocket connection in DevTools Network tab
- Look for `[ItemsSync]` logs in console

## Extending to Other Tables

To add bidirectional sync for other tables (e.g., `items`, `item_likes`):

### 1. Add API Endpoints

Edit [server.ts](web/server.ts):

```typescript
// Add routes for new table
if (pathname?.startsWith('/api/items')) {
  // Implement CRUD operations
}
```

### 2. Update Client Library

Create or update library file (e.g., `web/src/lib/items.ts`):

```typescript
export async function createItem(item: NewItem) {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';

  // Write to server
  const response = await fetch(`${apiUrl}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });

  if (!response.ok) throw new Error('Failed to create item');

  // Optimistic local update
  const db = await getDb();
  await db.insert(items).values(item);
}
```

### 3. Ensure Electric Syncs Table

Verify table is included in Electric ShapeStream subscriptions:

Edit [web/src/contexts/ItemsContext.tsx](web/src/contexts/ItemsContext.tsx) to add new shape if needed.

## Performance Considerations

### Optimistic Updates

- **Instant UX**: Changes appear immediately
- **Eventual consistency**: Electric sync overwrites with server truth
- **Conflict resolution**: Server always wins (last write wins)

### Network Efficiency

- Write API uses simple HTTP/JSON (standard REST)
- Electric sync uses WebSocket with binary protocol
- Batched updates reduce network overhead

### Local-First Benefits

- **Fast reads**: All data in local PGlite
- **Offline reads**: Works without network (for cached data)
- **Online writes**: Simple, no complex sync logic

## Future Enhancements

### For Full Offline Support

If you need offline writes, consider upgrading to Pattern #3 or #4:

- **Pattern #3**: Shared Persistent Optimistic State
  - Store write queue in localStorage
  - Retry on reconnection
  - More complex but better offline UX

- **Pattern #4**: Through-the-Database Sync
  - Use PGlite for both reads and writes
  - Background sync worker
  - Full local-first experience
  - Requires conflict resolution strategy

### Authentication

Current implementation has no auth. For production:

1. Add JWT/session auth to API server
2. Include auth headers in client requests
3. Configure Electric with auth mode
4. Add user-level row-level security (RLS)

### Observability

- Add structured logging (e.g., pino, winston)
- Monitor sync latency via Electric metrics
- Track API endpoint performance
- Set up alerts for sync failures

## References

- [ElectricSQL Docs](https://electric-sql.com/docs)
- [Write Patterns Guide](https://electric-sql.com/docs/guides/writes)
- [PGlite Documentation](https://pglite.dev/)
- [Project CLAUDE.md](CLAUDE.md)
