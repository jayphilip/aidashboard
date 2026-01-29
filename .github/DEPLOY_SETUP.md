# Auto-Deploy Setup Guide

This GitHub Actions workflow automatically deploys to your Hetzner VPS when you push to `main`.

## Prerequisites

1. Your VPS should have:
   - Docker and Docker Compose installed
   - Project cloned at `~/aidashboard`
   - SSH access configured

## GitHub Secrets Setup

Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 3 secrets:

| Secret Name | Value | Example |
|------------|-------|---------|
| `VPS_HOST` | Your VPS IP address | `46.224.178.113` |
| `VPS_USER` | SSH username | `root` or `ubuntu` |
| `VPS_SSH_KEY` | Your private SSH key | Contents of `~/.ssh/id_rsa` |

### Getting your SSH private key:

```bash
# On your local machine
cat ~/.ssh/id_rsa
```

Copy the **entire output** (including `-----BEGIN` and `-----END` lines) and paste it as the `VPS_SSH_KEY` secret.

## Updating Project Path

If your project is NOT at `~/aidashboard` on the VPS, update line 26 in `.github/workflows/deploy.yml`:

```yaml
cd ~/aidashboard  # ← Change this to your actual path
```

## Testing

After setting up secrets, push to main:

```bash
git push origin main
```

Then check:
- GitHub Actions tab in your repo for deployment status
- Your VPS to verify the app updated

## Troubleshooting

- **Deployment fails**: Check the Actions tab for error logs
- **SSH connection refused**: Verify `VPS_HOST` and port 22 is open
- **Permission denied**: Ensure `VPS_SSH_KEY` matches the public key on VPS
- **Container not starting**: Check `docker-compose.prod.yml` is valid

## Manual Deploy (if needed)

```bash
ssh user@your-vps-ip
cd ~/aidashboard
git pull origin main
docker-compose -f docker-compose.prod.yml up -d --build web
```
