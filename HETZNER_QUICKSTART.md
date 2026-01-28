# Hetzner Deployment Quick Start

## TL;DR - Get Running in 5 Minutes

### Local Setup (One Time)

```bash
# Clone and navigate to project
cd /opt/aidashboard

# Build images
docker compose -f docker-compose.prod.yml build

# Configure environment (will prompt for VPS IP/domain)
cp .env.example .env
# Edit .env with your VPS details and secure passwords
```

### SSH into Your Hetzner VPS

```bash
ssh root@your-vps-ip
cd /opt/aidashboard

# Start services
docker compose -f docker-compose.prod.yml up -d

# View logs
docker compose -f docker-compose.prod.yml logs -f
```

### Access Your App

- **Web App**: `http://your-vps-ip:5173`
- **ElectricSQL**: `http://your-vps-ip:3000`

---

## Configuration Files Created

| File | Purpose | Notes |
|------|---------|-------|
| `docker-compose.prod.yml` | Production Docker setup | All services on single machine |
| `server/ingestor/Dockerfile` | Build Rust ingestor | Multi-stage build for small image |
| `web/Dockerfile` | Build SvelteKit app | Uses Node.js 22 |
| `.env.example` | Root environment template | Copy to `.env` and configure |
| `web/.env.example` | Web app environment template | Copy to `web/.env` and configure |
| `server/ingestor/.env.example` | Ingestor environment template | For reference, reads from root `.env` |
| `scripts/deploy-hetzner.sh` | Automated setup script | Interactive setup helper |
| `DEPLOYMENT.md` | Full deployment guide | Detailed instructions & troubleshooting |

---

## What Changed from Neon/Render

### Before (Neon + Render)
```
Postgres: Render (Oregon, dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com)
          ↓
ElectricSQL: Render Web Service (electricsync.onrender.com)
             ↓
Web App: Render Web Service
```

### After (Hetzner VPS)
```
PostgreSQL 16 (localhost:5432)
    ↓
ElectricSQL (localhost:3000, internal)
    ↓
Web App (localhost:5173)
    ↓
Reverse Proxy (optional Nginx with HTTPS)
```

All services run in Docker containers on the same VPS machine.

---

## Key Configuration Changes

### PostgreSQL
- **Before**: Render managed database
- **After**: Docker container with persistent volume
- **Access**: Internal (via Docker network), not exposed to internet
- **Backup**: Manual with `pg_dump` (see DEPLOYMENT.md)

### ElectricSQL
- **Before**: `https://electricsync.onrender.com`
- **After**: `http://your-vps-ip:3000` (or with reverse proxy: `https://yourdomain.com`)
- **Update**: Change `ELECTRIC_URL` in `.env` and `PUBLIC_ELECTRIC_URL` in `web/.env`

### Web App
- **Before**: Render Node.js service
- **After**: Docker container running `npm start`
- **Access**: `http://your-vps-ip:5173` or via Nginx reverse proxy

### Rust Ingestor
- **Before**: Render cron job or background worker
- **After**: Docker container with background ingestion loop
- **Database**: Connects to local PostgreSQL
- **Interval**: Configurable via `INGESTION_INTERVAL_SECS` environment variable

---

## Environment Variables Reference

### Root `.env` (copy from `.env.example`)

```env
DB_USER=postgres
DB_PASSWORD=your-secure-password        # Generate: openssl rand -base64 32
DB_NAME=aidashboard

ELECTRIC_URL=http://your-vps-ip:3000   # How browsers connect
ELECTRIC_SECRET=your-secure-secret      # Generate: openssl rand -base64 32

RUST_LOG=info
INGESTION_INTERVAL_SECS=3600
```

### `web/.env` (copy from `web/.env.example`)

```env
PUBLIC_ELECTRIC_URL=http://your-vps-ip:3000
ELECTRIC_SECRET=your-secure-secret
```

---

## Common Tasks

### View Logs
```bash
docker compose -f docker-compose.prod.yml logs -f

# Specific service
docker compose -f docker-compose.prod.yml logs -f electric
docker compose -f docker-compose.prod.yml logs -f ingestor
```

### Stop Services
```bash
docker compose -f docker-compose.prod.yml down
```

### Restart Services
```bash
docker compose -f docker-compose.prod.yml restart

# Or specific service
docker compose -f docker-compose.prod.yml restart web
```

### Deploy New Code
```bash
git pull
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

### Access PostgreSQL
```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d aidashboard
```

### Backup Database
```bash
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres aidashboard > backup.sql
```

---

## Setup With HTTPS (Recommended for Production)

1. Set up Nginx reverse proxy (see DEPLOYMENT.md section "With HTTPS")
2. Use Let's Encrypt SSL certificate
3. Update `ELECTRIC_URL` to use `https://yourdomain.com`
4. Restart services

---

## Troubleshooting

### Services won't start
```bash
# Check logs
docker compose -f docker-compose.prod.yml logs
```

### Can't connect to ElectricSQL
- Verify `ELECTRIC_URL` is correct and accessible
- Check port 3000 is open: `curl http://localhost:3000`
- Make sure ElectricSQL is running: `docker ps`

### Database connection errors
- Verify `DB_PASSWORD` matches in `.env`
- Check database is healthy: `docker compose -f docker-compose.prod.yml ps postgres`

### Web app not loading
- Check `PUBLIC_ELECTRIC_URL` in `web/.env`
- Verify browser can reach ElectricSQL on the configured URL
- Check web logs: `docker compose -f docker-compose.prod.yml logs web`

---

## Automated Setup Script

Use the provided setup script for interactive configuration:

```bash
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

This will:
1. Check Docker installation
2. Generate secure passwords
3. Prompt for your VPS IP/domain
4. Create `.env` and `web/.env` files
5. Build Docker images
6. Start services

---

## Important Security Notes

✅ **Do:**
- Use strong, randomly generated passwords
- Enable HTTPS with reverse proxy in production
- Keep `.env` files out of version control (already in `.gitignore`)
- Limit database access to Docker network only
- Regularly backup your database
- Keep Docker images updated

❌ **Don't:**
- Commit `.env` files to Git
- Use default/weak passwords
- Expose PostgreSQL port to the internet
- Skip HTTPS in production
- Store passwords in code comments

---

## Next Steps

1. Read [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions
2. SSH into your Hetzner VPS
3. Clone the repository to `/opt/aidashboard`
4. Run `scripts/deploy-hetzner.sh` or manually configure as above
5. Verify all services are running: `docker compose -f docker-compose.prod.yml ps`
6. Access your app at `http://your-vps-ip:5173`

---

## Support

For detailed information, see:
- **Full deployment guide**: [DEPLOYMENT.md](DEPLOYMENT.md)
- **Docker Compose file**: [docker-compose.prod.yml](docker-compose.prod.yml)
- **Environment examples**: `.env.example`, `web/.env.example`
