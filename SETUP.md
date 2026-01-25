# AI Research Dashboard - Setup Guide

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Rust 1.70+
- `sqlx-cli` (for running migrations)

### 1. Start the Docker stack (Postgres + ElectricSQL)

```bash
cd infra
docker compose up -d
```

This starts:
- **Postgres 16** on `localhost:54321` (user: `postgres`, password: `postgres`, database: `aidashboard`)
- **ElectricSQL** on `localhost:3000`

Verify Postgres is healthy:
```bash
docker exec -it aidashboard-postgres psql -U postgres -d aidashboard -c "\d"
```

### 2. Run database migrations

```bash
# Install sqlx-cli if not already installed
cargo install sqlx-cli --no-default-features --features postgres

# Run migrations from the project root
export DATABASE_URL=postgresql://postgres:postgres@localhost:54321/aidashboard
sqlx migrate run --database-url $DATABASE_URL --source ./server/migrations
```

Verify the `papers` table was created:
```bash
docker exec -it aidashboard-postgres psql -U postgres -d aidashboard -c "\d papers"
```

### 3. Copy environment file

```bash
cp .env.example .env
# Edit .env if needed (defaults should work)
```

### 4. Run the Rust ingestor

```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:54321/aidashboard
export RUST_LOG=info
cargo run -p ingestor
```

You should see:
```
[INFO] Connecting to database: postgresql://...
[INFO] Database connection successful: (1,)
[INFO] Ingestor initialized. Ready to start ingestion.
```

## Project Structure

```
.
├── Cargo.toml                      # Workspace root
├── IMPLEMENTATION_PLAN.md          # Full implementation plan
├── CLAUDE.md                       # Project instructions
├── SETUP.md                        # This file
├── infra/
│   └── docker-compose.yml          # Postgres + ElectricSQL
├── server/
│   ├── ingestor/                   # Rust ingestion service
│   │   ├── Cargo.toml
│   │   ├── src/
│   │   │   ├── main.rs             # Entry point
│   │   │   ├── config.rs           # (TODO) Config loading
│   │   │   ├── db.rs               # (TODO) DB pool + queries
│   │   │   └── sources/
│   │   │       ├── mod.rs
│   │   │       └── arxiv.rs        # (TODO) ArXiv ingestion
│   │   └── .env.example
│   └── migrations/
│       └── 20260124000001_init_ai_dashboard.sql
└── web/                            # (TODO) SvelteKit/SolidStart app
```

## Next Steps

1. **Implement ArXiv ingestion** (`server/ingestor/src/sources/arxiv.rs`)
   - Fetch recent papers from ArXiv API
   - Parse XML and insert into `papers` table

2. **Set up ElectricSQL shapes**
   - Configure `shape_latest_papers` to stream recent papers to the web app

3. **Build the web app** (`web/`)
   - Initialize SvelteKit or SolidStart
   - Set up PGlite + Drizzle ORM
   - Create UI to display papers from the Electric sync

## Troubleshooting

### "Connection refused" on `localhost:54321`
- Ensure Docker containers are running: `docker ps`
- Check logs: `docker logs aidashboard-postgres`
- Restart: `docker compose down && docker compose up -d`

### Migration fails with "database already exists"
- The migrations table may already exist. Check with:
  ```bash
  docker exec -it aidashboard-postgres psql -U postgres -d aidashboard -c "SELECT * FROM _sqlx_migrations;"
  ```

### Cargo build fails
- Ensure you're using Rust 1.70+: `rustc --version`
- Clear cache: `cargo clean && cargo build`

## Documentation

- [CLAUDE.md](CLAUDE.md) - Project instructions and architecture overview
- [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) - Detailed multi-phase implementation plan
