# Hetzner VPS Setup Summary

This document summarizes all changes made to support deploying to a single Hetzner VPS, replacing the previous Neon + Render setup.

## What Was Changed

### Previous Architecture (Neon + Render)
- **PostgreSQL**: Render Postgres (dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com)
- **ElectricSQL**: Render Web Service (electricsync.onrender.com)
- **Web App**: Render Node.js Service
- **Ingestor**: Render Background Worker

### New Architecture (Single Hetzner VPS)
- **PostgreSQL**: Docker container on VPS
- **ElectricSQL**: Docker container on VPS
- **Web App**: Docker container on VPS
- **Ingestor**: Docker container on VPS
- All services communicate via Docker network
- Single VPS with Docker Compose orchestration

---

## Files Created

### 1. Docker Compose Configuration
**File**: `docker-compose.prod.yml`
- Production Docker Compose setup for single VPS
- All services (postgres, electric, ingestor, web)
- Persistent volumes for PostgreSQL data
- Internal networking between services
- Auto-restart on failure
- Uses environment variables for configuration

### 2. Dockerfiles

**File**: `server/ingestor/Dockerfile`
- Multi-stage build for Rust ingestor
- Builder stage: Compiles Rust code
- Runtime stage: Minimal Alpine Linux image
- Size-optimized for production

**File**: `web/Dockerfile`
- Multi-stage build for SvelteKit web app
- Builder stage: Installs dependencies, builds app
- Runtime stage: Node.js 22 Alpine
- Uses pnpm for efficient dependency management

### 3. Environment Configuration Files

**File**: `.env.example`
- Root environment template with inline comments
- Development and production examples
- Guidance on secure password generation
- Clear explanations for each variable

**File**: `.env.prod.example`
- Production-focused environment example
- Shows typical production values
- Includes comments about security

**File**: `web/.env.example`
- Web app environment template
- PUBLIC_ELECTRIC_URL for browser connectivity
- ELECTRIC_SECRET for security

**File**: `server/ingestor/.env.example`
- Updated with local dev vs production URLs
- Explains Docker network communication

### 4. Documentation

**File**: `DEPLOYMENT.md` (Comprehensive)
- Complete step-by-step deployment guide
- VPS setup prerequisites
- Docker installation instructions
- Environment configuration walkthroughs
- Database backup/restore procedures
- Nginx reverse proxy setup with HTTPS
- Troubleshooting guide
- Performance tuning
- Security best practices
- Maintenance procedures

**File**: `HETZNER_QUICKSTART.md` (Quick Reference)
- 5-minute quick start guide
- TL;DR summary
- Configuration files reference table
- Environment variables reference
- Common tasks and commands
- Automated setup script instructions
- HTTPS setup guide

### 5. Deployment Automation

**File**: `scripts/deploy-hetzner.sh`
- Interactive deployment setup script
- Automatically installs Docker
- Generates secure passwords
- Prompts for VPS IP/domain
- Creates and configures `.env` files
- Builds Docker images
- Starts services
- Displays access information

---

## Key Configuration Changes

### PostgreSQL
| Aspect | Before | After |
|--------|--------|-------|
| Hosting | Render managed | Docker container |
| Host | dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com | localhost (via Docker) |
| Port | 5432 | 5432 (internal), 127.0.0.1:5432 (host only) |
| Access | Internet accessible | Docker network only |
| Credentials | Render-managed | Environment variables |
| Backups | Render automated | Manual with `pg_dump` |
| Configuration | Render defaults | Custom logical replication settings |

### ElectricSQL
| Aspect | Before | After |
|--------|--------|-------|
| Hosting | Render Web Service | Docker container |
| URL | https://electricsync.onrender.com | http://your-vps-ip:3000 |
| Access | HTTPS only | HTTP (can add HTTPS via reverse proxy) |
| Database Connection | Render Postgres endpoint | Docker network: postgres:5432 |
| Environment Var | ELECTRIC_URL | ELECTRIC_URL (same, different value) |

### Web App
| Aspect | Before | After |
|--------|--------|-------|
| Hosting | Render Web Service | Docker container |
| Port | 443 (HTTPS via Render) | 5173 (can reverse proxy for HTTPS) |
| Dependencies | Render buildpack | Docker build process |
| Environment | Render dashboard | `.env` file or environment variables |

### Rust Ingestor
| Aspect | Before | After |
|--------|--------|-------|
| Hosting | Render background worker | Docker container |
| Database Connection | Render Postgres (external) | Docker network: postgres:5432 |
| Schedule | Render scheduler | Internal loop with configurable interval |
| Logs | Render dashboard | Docker logs: `docker logs` |

---

## Environment Variables That Changed

### ELECTRIC_URL
**Old**: `https://electricsync.onrender.com`
**New**: `http://your-vps-ip:3000` or `https://yourdomain.com` (with reverse proxy)

### PUBLIC_ELECTRIC_URL (Web App)
**Old**: `https://electricsync.onrender.com`
**New**: `http://your-vps-ip:3000` or `https://yourdomain.com` (matches ELECTRIC_URL)

### DATABASE_URL
**In .env files - not committed**
**Old**: `postgresql://ai_dashboard_eze2_user:HnTjLq6xv42mktbRJrnincfO0uCR6GYS@dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com:5432/ai_dashboard_eze2?sslmode=require`
**New**: `postgresql://postgres:password@localhost:54321/aidashboard` (dev) or `postgresql://postgres:password@postgres:5432/aidashboard` (production)

### New Environment Variables
**DB_USER**: PostgreSQL username (default: postgres)
**DB_PASSWORD**: PostgreSQL password (secure, environment-specific)
**DB_NAME**: PostgreSQL database name (default: aidashboard)
**ELECTRIC_SECRET**: ElectricSQL security secret (new, secure)

---

## How to Deploy

### Quick Way (Automated)
```bash
# On your Hetzner VPS
cd /opt/aidashboard
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

### Manual Way
```bash
# 1. Configure environment
cp .env.example .env
# Edit .env with your values and secure passwords

cp web/.env.example web/.env
# Edit web/.env with matching values

# 2. Build images
docker compose -f docker-compose.prod.yml build

# 3. Start services
docker compose -f docker-compose.prod.yml up -d

# 4. Verify
docker compose -f docker-compose.prod.yml ps
```

---

## Removed References

The following old references are no longer valid and have been updated:

✓ `dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com` - Replaced with local Docker PostgreSQL
✓ `electricsync.onrender.com` - Replaced with local Docker ElectricSQL + optional reverse proxy
✓ Render buildpack configuration - Replaced with Dockerfiles
✓ Render environment variables - Replaced with local .env files

Note: Neon references in `package-lock.json` and `pnpm-lock.yaml` are optional peer dependencies and unused.

---

## Database Migrations

If you have pending database migrations, run before starting services:

```bash
# From your local machine:
sqlx migrate run --database-url "postgresql://postgres:password@your-vps-ip:5432/aidashboard"

# Or via Docker container:
docker compose -f docker-compose.prod.yml exec postgres sqlx migrate run
```

---

## Security Considerations

### Passwords
- Generate secure passwords: `openssl rand -base64 32`
- Store in `.env` (which is in `.gitignore`)
- Never commit `.env` files
- Use different passwords for different environments

### Network Access
- PostgreSQL: Only accessible via Docker network (not exposed to internet)
- ElectricSQL: Port 3000 exposed (can be hidden behind reverse proxy)
- Web App: Port 5173 exposed (can be behind reverse proxy on port 443)

### HTTPS Setup
- Not included by default (plain HTTP)
- Recommended: Set up Nginx reverse proxy with Let's Encrypt SSL
- Instructions in DEPLOYMENT.md

### Backups
- Set up regular PostgreSQL backups
- Example cron job in DEPLOYMENT.md
- Test restore procedures regularly

---

## Rollback to Render (If Needed)

If you need to go back to Render:

1. Stop Docker services: `docker compose -f docker-compose.prod.yml down`
2. Restore from backup: `psql -U postgres -d aidashboard < backup.sql`
3. Update `.env` with Render database URL
4. Redeploy to Render using original process

---

## Testing & Verification

### Start Services
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Verify Each Service
```bash
# PostgreSQL health
docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres

# ElectricSQL connectivity
curl http://localhost:3000/status

# Web app access
curl http://localhost:5173

# Ingestor running
docker compose -f docker-compose.prod.yml logs ingestor
```

### View All Logs
```bash
docker compose -f docker-compose.prod.yml logs -f
```

---

## Support & Documentation

- **Quick start**: HETZNER_QUICKSTART.md
- **Full guide**: DEPLOYMENT.md
- **Script help**: `scripts/deploy-hetzner.sh`
- **Configuration**: `.env.example`, `web/.env.example`

---

## Summary

You now have:
✓ A single docker-compose.prod.yml that runs everything on one VPS
✓ Multi-stage Dockerfiles for efficient production images
✓ Comprehensive environment configuration templates
✓ Automated setup script for easy deployment
✓ Detailed deployment guide with troubleshooting
✓ All Render/Neon references replaced with local Docker services
✓ Everything running in an isolated Docker network
✓ Persistent data volumes for PostgreSQL
✓ Auto-restart on failure

Ready to deploy to Hetzner VPS! 🚀
