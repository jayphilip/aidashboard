# Hetzner VPS Deployment - Complete Setup

This guide explains the new Docker-based deployment for your Hetzner VPS, replacing the previous Neon + Render setup.

## Quick Summary

You now have everything needed to run your entire AI Dashboard on a single Hetzner VPS:

- **PostgreSQL 16** - Runs in Docker container
- **ElectricSQL** - Runs in Docker container
- **SvelteKit Web App** - Runs in Docker container
- **Rust Ingestor** - Runs in Docker container

All services are defined in `docker-compose.prod.yml` and orchestrated together.

---

## What's New (Replacing Neon + Render)

### Database
- ❌ Render PostgreSQL (`dpg-d5qvuo9r0fns73dr76t0-a.oregon-postgres.render.com`)
- ✅ Docker PostgreSQL (local on VPS)

### Sync Layer
- ❌ Render ElectricSQL (`electricsync.onrender.com`)
- ✅ Docker ElectricSQL (local on VPS)

### Web App
- ❌ Render Node.js Service
- ✅ Docker SvelteKit App

### Ingestor
- ❌ Render Background Worker
- ✅ Docker Container with scheduled tasks

---

## Files Created (8 Total)

### Configuration & Deployment
| File | Purpose |
|------|---------|
| `docker-compose.prod.yml` | Orchestrates all services on single VPS |
| `server/ingestor/Dockerfile` | Multi-stage build for Rust ingestor |
| `web/Dockerfile` | Multi-stage build for SvelteKit app |

### Environment Configuration
| File | Purpose |
|------|---------|
| `.env.example` | Root environment template (development examples) |
| `.env.prod.example` | Root environment template (production example) |
| `web/.env.example` | Web app environment template |
| `server/ingestor/.env.example` | Ingestor environment template |

### Scripts & Automation
| File | Purpose |
|------|---------|
| `scripts/deploy-hetzner.sh` | Interactive deployment setup script |

### Documentation (4 Guides)
| File | Purpose |
|------|---------|
| `HETZNER_QUICKSTART.md` | 5-minute quick start guide |
| `HETZNER_SETUP_SUMMARY.md` | Detailed summary of all changes |
| `DEPLOYMENT.md` | Comprehensive deployment guide (100+ lines) |
| `DEPLOYMENT_CHECKLIST.md` | Step-by-step checklist for deployment |

---

## Getting Started

### Option A: Automated Setup (Recommended)

The easiest way - interactive script handles everything:

```bash
# On your Hetzner VPS, after cloning the repo:
cd /opt/aidashboard
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
```

This script will:
1. Verify Docker is installed
2. Generate secure passwords
3. Ask for your VPS IP/domain
4. Create `.env` and `web/.env` files
5. Build Docker images
6. Start all services
7. Show you how to access the app

### Option B: Manual Setup

If you prefer manual control:

```bash
# 1. Configure environment
cp .env.example .env
nano .env  # Edit with your values

cp web/.env.example web/.env
nano web/.env  # Edit with matching values

# 2. Build Docker images
docker compose -f docker-compose.prod.yml build

# 3. Start services
docker compose -f docker-compose.prod.yml up -d

# 4. Verify everything is running
docker compose -f docker-compose.prod.yml ps
```

---

## Essential Commands

### Service Management
```bash
# Start all services
docker compose -f docker-compose.prod.yml up -d

# Stop all services
docker compose -f docker-compose.prod.yml down

# Restart services
docker compose -f docker-compose.prod.yml restart

# Restart specific service
docker compose -f docker-compose.prod.yml restart web
```

### Monitoring & Logs
```bash
# View all logs (follow in real-time)
docker compose -f docker-compose.prod.yml logs -f

# View specific service logs
docker compose -f docker-compose.prod.yml logs -f electric
docker compose -f docker-compose.prod.yml logs -f ingestor

# View service status
docker compose -f docker-compose.prod.yml ps
```

### Database Access
```bash
# Connect to PostgreSQL
docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -d aidashboard

# Backup database
docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres aidashboard > backup.sql

# Restore from backup
docker compose -f docker-compose.prod.yml exec -T postgres psql -U postgres -d aidashboard < backup.sql
```

### Deployment Updates
```bash
# Pull latest code
git pull origin main

# Rebuild images
docker compose -f docker-compose.prod.yml build

# Restart with new code (zero downtime)
docker compose -f docker-compose.prod.yml up -d
```

---

## Access Your Application

Once running, access via:

- **Web App**: `http://your-vps-ip:5173`
- **ElectricSQL**: `http://your-vps-ip:3000` (for debugging)

### Optional: HTTPS Setup

For production, set up HTTPS with Nginx reverse proxy:

```bash
# Automatic redirect from HTTP to HTTPS
# SSL certificates from Let's Encrypt
# See DEPLOYMENT.md for detailed instructions
```

---

## Environment Variables

### What You Need to Configure

**`.env` (root directory)**
```env
DB_PASSWORD=your-secure-password          # Generate: openssl rand -base64 32
ELECTRIC_URL=http://your-vps-ip:3000     # How browsers connect
ELECTRIC_SECRET=your-secure-secret        # Generate: openssl rand -base64 32
```

**`web/.env`**
```env
PUBLIC_ELECTRIC_URL=http://your-vps-ip:3000  # Must match ELECTRIC_URL
ELECTRIC_SECRET=your-secure-secret           # Must match root .env
```

### Security Notes

- Generate passwords: `openssl rand -base64 32`
- Never commit `.env` files (already in `.gitignore`)
- Use different passwords for different environments
- Store credentials securely

---

## Documentation Map

Start here based on your needs:

1. **Getting started quickly?**
   → Read `HETZNER_QUICKSTART.md` (5 minutes)

2. **Want to understand all changes?**
   → Read `HETZNER_SETUP_SUMMARY.md` (overview)

3. **Following step-by-step deployment?**
   → Use `DEPLOYMENT_CHECKLIST.md` (checklist format)

4. **Need comprehensive reference?**
   → Read `DEPLOYMENT.md` (100+ detailed sections)

5. **Setting up automated deployment?**
   → Run `scripts/deploy-hetzner.sh`

---

## Architecture Overview

```
┌─────────────────────────────────────────┐
│        Hetzner VPS (Single Machine)     │
├─────────────────────────────────────────┤
│                                         │
│  ┌────────────────────────────────────┐ │
│  │     Docker Network: aidashboard    │ │
│  │                                    │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │  PostgreSQL 16               │  │ │
│  │  │  (localhost:5432 internal)   │  │ │
│  │  └──────────────────────────────┘  │ │
│  │           ↑                         │ │
│  │  ┌──────────────────────────────┐  │ │
│  │  │  ElectricSQL                 │  │ │
│  │  │  (localhost:3000 internal)   │  │ │
│  │  │  Port 3000 → :3000 external  │  │ │
│  │  └──────────────────────────────┘  │ │
│  │       ↑         ↑                   │ │
│  │  ┌──────────┐ ┌──────────────────┐ │ │
│  │  │ Ingestor │ │  SvelteKit Web   │ │ │
│  │  │ (running)│ │  Port 3000→5173  │ │ │
│  │  └──────────┘ └──────────────────┘ │ │
│  │                                    │ │
│  └────────────────────────────────────┘ │
│                                         │
│  Optional: Nginx Reverse Proxy          │
│  (for HTTPS, port 443)                 │
└─────────────────────────────────────────┘
```

---

## Troubleshooting

### Services won't start?
```bash
docker compose -f docker-compose.prod.yml logs
# Check for specific error messages
```

### Can't connect to ElectricSQL?
- Verify `ELECTRIC_URL` is correct
- Check port 3000 is open: `curl http://localhost:3000`
- See DEPLOYMENT.md for detailed troubleshooting

### Database connection issues?
- Verify passwords match in `.env`
- Check PostgreSQL is running: `docker ps`
- See DEPLOYMENT.md "Troubleshooting" section

---

## Key Features

✅ **Single Machine** - Everything on one Hetzner VPS
✅ **Docker Orchestrated** - Simple `docker compose` commands
✅ **Persistent Data** - PostgreSQL volume survives restarts
✅ **Auto-Restart** - Services restart on failure
✅ **Easy Updates** - Git pull → rebuild → restart
✅ **Production Ready** - HTTPS support, backups, monitoring
✅ **Secure** - Passwords, secrets, network isolation
✅ **Documented** - 4 guides, scripts, examples

---

## Next Steps

1. **SSH into your Hetzner VPS**
2. **Clone repository** to `/opt/aidashboard`
3. **Run setup script** or follow manual steps
4. **Access your app** at `http://your-vps-ip:5173`
5. **Set up HTTPS** (optional but recommended)
6. **Configure backups** (see DEPLOYMENT.md)

---

## Support

- **Quick questions?** → HETZNER_QUICKSTART.md
- **Deployment help?** → DEPLOYMENT_CHECKLIST.md
- **Detailed info?** → DEPLOYMENT.md
- **Understanding changes?** → HETZNER_SETUP_SUMMARY.md
- **Script help?** → `scripts/deploy-hetzner.sh --help`

---

## Deployment Verification Checklist

After deployment, verify:

- [ ] All containers running: `docker compose -f docker-compose.prod.yml ps`
- [ ] PostgreSQL healthy: `docker compose -f docker-compose.prod.yml exec postgres pg_isready`
- [ ] ElectricSQL accessible: `curl http://localhost:3000`
- [ ] Web app loads: `curl http://localhost:5173` (returns HTML)
- [ ] No error logs: `docker compose -f docker-compose.prod.yml logs | grep -i error`
- [ ] Data syncing: Check UI for papers/news
- [ ] Ingestor running: `docker compose -f docker-compose.prod.yml logs ingestor | grep -i "running\|ingesting"`

---

## You're Ready to Deploy! 🚀

Everything is configured and ready. Your journey from Neon + Render to a self-hosted Hetzner VPS starts now.

**Start with**: `./scripts/deploy-hetzner.sh` or follow `DEPLOYMENT_CHECKLIST.md`

Good luck! 🎉
