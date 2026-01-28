# Hetzner Deployment Checklist

Use this checklist to ensure a smooth deployment to your Hetzner VPS.

## Pre-Deployment (Local)

- [ ] Review `HETZNER_QUICKSTART.md` for overview
- [ ] Review `HETZNER_SETUP_SUMMARY.md` for what changed
- [ ] Git status is clean (no uncommitted changes)
  ```bash
  git status
  ```
- [ ] Latest code is committed
  ```bash
  git log -1
  ```

## VPS Preparation

### Initial VPS Setup
- [ ] Hetzner VPS is running
- [ ] Can SSH into VPS: `ssh root@your-vps-ip`
- [ ] VPS has at least 2GB RAM
- [ ] VPS has at least 20GB free disk space: `df -h`

### Install Docker
- [ ] SSH into VPS
- [ ] Docker installed: `docker --version`
- [ ] Docker Compose installed: `docker compose --version`
- [ ] User added to docker group: `newgrp docker` (if needed)
- [ ] Git installed: `git --version`

### Clone Project
- [ ] Navigate to VPS: `ssh root@your-vps-ip`
- [ ] Clone repo: `git clone <url> /opt/aidashboard`
- [ ] Navigate to directory: `cd /opt/aidashboard`
- [ ] Verify file structure:
  ```bash
  ls -la docker-compose.prod.yml
  ls -la server/ingestor/Dockerfile
  ls -la web/Dockerfile
  ```

## Configuration

### Generate Passwords
- [ ] Generate database password:
  ```bash
  openssl rand -base64 32
  # Copy this value
  ```
- [ ] Generate ElectricSQL secret:
  ```bash
  openssl rand -base64 32
  # Copy this value
  ```

### Create Environment Files

**Option A: Automated (Recommended)**
```bash
chmod +x scripts/deploy-hetzner.sh
./scripts/deploy-hetzner.sh
# Follow prompts
```
- [ ] Script ran successfully
- [ ] .env file created: `ls -la .env`
- [ ] web/.env created: `ls -la web/.env`
- [ ] Values look correct (cat .env and verify)

**Option B: Manual**
- [ ] Copy .env.example to .env: `cp .env.example .env`
- [ ] Edit .env with your values:
  ```bash
  nano .env
  # Update: DB_PASSWORD, DB_NAME, ELECTRIC_URL, ELECTRIC_SECRET
  ```
- [ ] Copy web/.env.example to web/.env: `cp web/.env.example web/.env`
- [ ] Edit web/.env:
  ```bash
  nano web/.env
  # Update: PUBLIC_ELECTRIC_URL, ELECTRIC_SECRET
  ```
- [ ] Verify .env not in git: `git status` (should not show .env)
- [ ] Verify files exist:
  ```bash
  test -f .env && echo "✓ .env exists"
  test -f web/.env && echo "✓ web/.env exists"
  ```

### Environment File Verification
- [ ] DB_PASSWORD is secure (32 chars)
- [ ] DB_PASSWORD matches between .env and web/.env ELECTRIC_SECRET
- [ ] ELECTRIC_URL points to your VPS IP:3000
- [ ] ELECTRIC_SECRET is secure (32 chars)
- [ ] PUBLIC_ELECTRIC_URL matches ELECTRIC_URL
- [ ] RUST_LOG is set to 'info' (or 'debug' for troubleshooting)

## Build & Deploy

### Build Docker Images
- [ ] Navigate to project root: `cd /opt/aidashboard`
- [ ] Build images:
  ```bash
  docker compose -f docker-compose.prod.yml build
  ```
- [ ] Build succeeded (no errors)
- [ ] Verify images exist:
  ```bash
  docker images | grep aidashboard
  ```

### Start Services
- [ ] Start services:
  ```bash
  docker compose -f docker-compose.prod.yml up -d
  ```
- [ ] Services started without errors
- [ ] No immediate service exits

### Verify Services are Running
- [ ] All services running:
  ```bash
  docker compose -f docker-compose.prod.yml ps
  # All should show "running" status
  ```
- [ ] PostgreSQL health check:
  ```bash
  docker compose -f docker-compose.prod.yml exec postgres pg_isready -U postgres
  # Should return "accepting connections"
  ```
- [ ] ElectricSQL is accessible:
  ```bash
  curl http://localhost:3000/status
  ```
- [ ] Check ingestor logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs ingestor | head -20
  # Should show startup messages, not errors
  ```

### Verify Database Connectivity
- [ ] ElectricSQL can see PostgreSQL tables:
  ```bash
  docker compose -f docker-compose.prod.yml exec electric \
    curl http://localhost:3000/api/version
  ```
- [ ] Check ElectricSQL logs for errors:
  ```bash
  docker compose -f docker-compose.prod.yml logs electric | grep -i error
  # Should be empty or minimal
  ```

## Testing

### Test Web App Access
- [ ] From your local machine:
  ```bash
  curl http://your-vps-ip:5173
  # Should return HTML
  ```
- [ ] Open browser to: `http://your-vps-ip:5173`
- [ ] Page loads without errors
- [ ] No 500 errors in browser console

### Test ElectricSQL Connectivity
- [ ] From local machine:
  ```bash
  curl http://your-vps-ip:3000/status
  # Should return status info
  ```
- [ ] Check browser console for WebSocket connections
- [ ] No CORS errors in browser console

### Test Data Sync
- [ ] Open browser DevTools (F12)
- [ ] Go to Console tab
- [ ] Data should be syncing from PGlite
- [ ] Check if any papers/news are displayed

### Test Ingestor
- [ ] Check ingestor is running:
  ```bash
  docker compose -f docker-compose.prod.yml ps ingestor
  # Should show "running" status
  ```
- [ ] Check ingestor logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs -f ingestor
  # Should show ingestion progress
  ```

## Post-Deployment

### Backup Database
- [ ] Create initial backup:
  ```bash
  docker compose -f docker-compose.prod.yml exec postgres pg_dump -U postgres aidashboard > /opt/aidashboard/backup-$(date +%Y%m%d).sql
  ```
- [ ] Backup file created: `ls -lh backup-*.sql`
- [ ] Download backup to local machine (secure location)

### Set Up Monitoring (Optional)

#### Enable Log Rotation
- [ ] Check disk usage:
  ```bash
  du -sh /var/lib/docker/containers/
  df -h
  ```
- [ ] Create docker daemon config:
  ```bash
  sudo mkdir -p /etc/docker
  sudo tee /etc/docker/daemon.json > /dev/null <<EOF
  {
    "log-driver": "json-file",
    "log-opts": {
      "max-size": "10m",
      "max-file": "3"
    }
  }
  EOF
  sudo systemctl restart docker
  ```

#### Set Up Cron for Backups (Optional)
- [ ] Add backup cron job:
  ```bash
  crontab -e
  # Add line:
  # 0 2 * * * cd /opt/aidashboard && docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U postgres aidashboard > backup-$(date +\%Y\%m\%d).sql
  ```

### Set Up HTTPS (Optional but Recommended)

See DEPLOYMENT.md "With HTTPS (Using Nginx Reverse Proxy)" for:
- [ ] Install Nginx and certbot
- [ ] Configure Nginx as reverse proxy
- [ ] Get SSL certificate from Let's Encrypt
- [ ] Update ELECTRIC_URL to use https://
- [ ] Restart services with new URLs

## Troubleshooting

### If Services Won't Start
- [ ] Check logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs
  ```
- [ ] Common issues:
  - [ ] Port 3000 or 5173 already in use: `lsof -i :3000` and `lsof -i :5173`
  - [ ] Insufficient disk space: `df -h`
  - [ ] Permission issues: `sudo chown -R $USER:$USER /opt/aidashboard`

### If Database Connection Fails
- [ ] Verify DATABASE_URL in .env
- [ ] Check PostgreSQL is healthy:
  ```bash
  docker compose -f docker-compose.prod.yml ps postgres
  docker compose -f docker-compose.prod.yml logs postgres
  ```
- [ ] Check password matches in .env

### If ElectricSQL Can't Connect to Database
- [ ] Check ElectricSQL logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs electric | grep -i error
  ```
- [ ] Verify PostgreSQL has logical replication enabled:
  ```bash
  docker compose -f docker-compose.prod.yml exec postgres psql -U postgres -c "SHOW wal_level;"
  # Should return "logical"
  ```

### If Web App Won't Load
- [ ] Check browser console for errors (F12)
- [ ] Check web app logs:
  ```bash
  docker compose -f docker-compose.prod.yml logs web
  ```
- [ ] Verify PUBLIC_ELECTRIC_URL is correct
- [ ] Test ElectricSQL is accessible from browser

## Maintenance

### Daily Checks
- [ ] Services still running: `docker compose -f docker-compose.prod.yml ps`
- [ ] No errors in logs: `docker compose -f docker-compose.prod.yml logs --since 24h | grep -i error`
- [ ] Disk space available: `df -h`

### Weekly Checks
- [ ] Test backup process works
- [ ] Check system updates needed: `sudo apt list --upgradable`
- [ ] Review error logs for patterns

### Monthly Tasks
- [ ] Update Docker images:
  ```bash
  docker pull postgres:16-alpine
  docker pull electricsql/electric:latest
  docker pull node:22-alpine
  docker pull rust:1.84-alpine
  ```
- [ ] Rebuild and restart:
  ```bash
  docker compose -f docker-compose.prod.yml build --pull
  docker compose -f docker-compose.prod.yml up -d
  ```
- [ ] Test application thoroughly

## Success Criteria

Your deployment is successful if:

✓ All containers running: `docker compose -f docker-compose.prod.yml ps` shows all "running"
✓ PostgreSQL healthy: Can connect and query
✓ ElectricSQL connected: Can reach status endpoint
✓ Web app loads: `http://your-vps-ip:5173` displays correctly
✓ Data syncing: See papers/news in the UI
✓ Ingestor running: Logs show active ingestion
✓ No critical errors: `docker compose -f docker-compose.prod.yml logs` shows no errors

---

## Need Help?

- **Quick reference**: HETZNER_QUICKSTART.md
- **Detailed guide**: DEPLOYMENT.md
- **What changed**: HETZNER_SETUP_SUMMARY.md
- **Docker logs**: `docker compose -f docker-compose.prod.yml logs -f`

You're deployed! 🎉
