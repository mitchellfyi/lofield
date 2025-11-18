# Deployment Guide for Lofield FM

This guide explains how to deploy Lofield FM to a production server using GitHub Actions and Docker. The automated deployment pipeline builds Docker images and deploys them to a DigitalOcean droplet whenever changes are pushed to the `main` branch.

## Overview

The deployment process consists of:

1. **Automated CI/CD**: GitHub Actions workflow builds Docker images and pushes to GitHub Container Registry (GHCR)
2. **Containerized Services**: All services run in Docker containers orchestrated by Docker Compose
3. **Zero-Downtime Deployment**: Rolling updates ensure the station stays on air
4. **Health Checks**: Automated verification that services are running correctly

## Architecture

```
GitHub (main branch push)
    ↓
GitHub Actions Workflow
    ├── Build Docker Images (web, scheduler, playout, nginx)
    ├── Push to GHCR (ghcr.io/mitchellfyi/lofield)
    └── Deploy to Droplet
        ├── SSH into server
        ├── Pull latest images
        ├── Run database migrations
        ├── Restart services (docker compose up -d)
        └── Health checks
```

## Prerequisites

### 1. DigitalOcean Droplet Setup

You need a droplet with:
- **OS**: Ubuntu 22.04 LTS (recommended)
- **RAM**: Minimum 4GB (8GB recommended for production)
- **Storage**: At least 50GB
- **Network**: Public IPv4 address
- **Access**: SSH access configured

### 2. Server Software

Install Docker and Docker Compose on the droplet:

```bash
# Update system packages
sudo apt update
sudo apt upgrade -y

# Install Docker
sudo apt install -y docker.io docker-compose

# Add your user to the docker group (replace 'deploy' with your username)
sudo usermod -aG docker deploy

# Reload group membership
newgrp docker

# Verify installation
docker --version
docker-compose --version
```

### 3. Application Setup on Droplet

```bash
# Create application directory
sudo mkdir -p /home/deploy/lofield
sudo chown -R deploy:deploy /home/deploy/lofield
cd /home/deploy/lofield

# Clone the repository (optional - if you want to keep code on server)
git clone https://github.com/mitchellfyi/lofield.git .

# Create persistent data directories
sudo mkdir -p /data/postgres /data/archive /data/stream /data/audio /data/cache
sudo chown -R 1001:1001 /data/postgres /data/audio /data/cache
sudo chown -R deploy:deploy /data/archive /data/stream

# Create environment file
cp .env.example .env
```

### 4. Environment Configuration

Edit the `.env` file and configure all required variables:

```bash
nano .env
```

**Required environment variables** (see issue #65 for complete configuration):

```bash
# Database
POSTGRES_PASSWORD=<secure-random-password>
POSTGRES_USER=lofield
POSTGRES_DB=lofield_fm

# Icecast Streaming
ICECAST_SOURCE_PASSWORD=<secure-source-password>
ICECAST_ADMIN_PASSWORD=<secure-admin-password>
ICECAST_RELAY_PASSWORD=<secure-relay-password>
ICECAST_HOSTNAME=<your-droplet-domain-or-ip>

# AI Services (required)
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...

# Optional AI Services
ELEVENLABS_API_KEY=...
STABILITY_AI_API_KEY=...

# Streaming Configuration
NEXT_PUBLIC_STREAM_URL=http://<your-droplet-domain-or-ip>:8000/live.mp3
NEXT_PUBLIC_ARCHIVE_BASE_URL=http://<your-droplet-domain-or-ip>:8000/archive
```

**Generate secure passwords:**
```bash
openssl rand -base64 32
```

### 5. Docker Compose Configuration

Update `docker-compose.yml` to use images from GHCR instead of building locally. Create or modify the file:

```yaml
# Update image references to use GHCR
services:
  web:
    image: ghcr.io/mitchellfyi/lofield/web:latest
    # Remove 'build' section
    
  scheduler:
    image: ghcr.io/mitchellfyi/lofield/scheduler:latest
    # Remove 'build' section
    
  playout:
    image: ghcr.io/mitchellfyi/lofield/playout:latest
    # Remove 'build' section
    
  nginx:
    image: ghcr.io/mitchellfyi/lofield/nginx:latest
    # Remove 'build' section
```

### 6. Initial Deployment

Start services manually for the first time:

```bash
# Log in to GHCR
echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USERNAME --password-stdin

# Pull images
docker compose pull

# Start database and run migrations
docker compose up -d postgres
docker compose run --rm scheduler npx prisma migrate deploy

# Start all services
docker compose up -d

# Check status
docker compose ps
docker compose logs -f
```

## GitHub Actions Setup

### 1. Generate SSH Key Pair

On your **local machine**, generate an SSH key pair for deployment:

```bash
# Generate SSH key (use a strong passphrase or leave empty for CI/CD)
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/lofield_deploy

# This creates two files:
# - ~/.ssh/lofield_deploy (private key - DO NOT SHARE)
# - ~/.ssh/lofield_deploy.pub (public key)
```

### 2. Add Public Key to Droplet

Copy the **public key** to your droplet:

```bash
# Display the public key
cat ~/.ssh/lofield_deploy.pub

# On the droplet, add it to authorized_keys
# SSH into your droplet first
ssh deploy@165.22.114.81

# Add the public key
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste the public key content
chmod 600 ~/.ssh/authorized_keys
```

Or use `ssh-copy-id`:

```bash
ssh-copy-id -i ~/.ssh/lofield_deploy.pub deploy@165.22.114.81
```

### 3. Configure GitHub Secrets

Add the following secrets to your GitHub repository:

**Navigate to**: Repository → Settings → Secrets and variables → Actions → New repository secret

| Secret Name | Value | Description |
|-------------|-------|-------------|
| `DEPLOY_HOST` | `165.22.114.81` | Droplet IP address or hostname |
| `DEPLOY_USER` | `deploy` | SSH user (e.g., `deploy` or `root`) |
| `SSH_PRIVATE_KEY` | `<contents of ~/.ssh/lofield_deploy>` | **Private key** (entire file content) |
| `REGISTRY_USERNAME` | `<your-github-username>` | GitHub username for GHCR |
| `REGISTRY_PASSWORD` | `<personal-access-token>` | GitHub PAT with `write:packages` and `delete:packages` scopes |
| `REGISTRY` | `ghcr.io/mitchellfyi/lofield` | Container registry URL |

**Creating a GitHub Personal Access Token (PAT):**

1. Go to GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token" → "Generate new token (classic)"
3. Give it a descriptive name: "Lofield FM GHCR Access"
4. Set expiration (recommend: 90 days or 1 year)
5. Select scopes:
   - ✅ `write:packages` (Upload packages to GitHub Package Registry)
   - ✅ `delete:packages` (Delete packages from GitHub Package Registry)
6. Click "Generate token"
7. **Copy the token immediately** (you won't be able to see it again)
8. Save it as `REGISTRY_PASSWORD` secret in GitHub

### 4. Workflow Configuration

The deployment workflow is defined in `.github/workflows/deploy.yml`. It consists of two jobs:

#### Job 1: Build and Push Images

- Triggers on pushes to `main` branch or manual dispatch
- Uses Docker Buildx for efficient multi-layer builds
- Builds four images: `web`, `scheduler`, `playout`, `nginx`
- Tags images with both commit SHA and `latest`
- Pushes to GitHub Container Registry (GHCR)
- Uses layer caching to speed up builds

#### Job 2: Deploy to Server

- Waits for build job to complete
- Connects to droplet via SSH
- Logs into GHCR and pulls latest images
- Runs database migrations
- Restarts services with `docker compose up -d` (zero downtime)
- Cleans up old images
- Runs health checks to verify deployment

### 5. Testing the Workflow

You can test the workflow in several ways:

**Method 1: Push to main**
```bash
git checkout main
git pull origin main
# Make a change
git add .
git commit -m "Test deployment workflow"
git push origin main
```

**Method 2: Manual dispatch**
1. Go to GitHub → Actions → "Build and Deploy to DigitalOcean"
2. Click "Run workflow" → Select `main` branch → "Run workflow"

**Method 3: Create a deployment branch**
```bash
git checkout -b deploy/test-deployment
# Make changes
git push origin deploy/test-deployment
# Create PR to main
```

## Monitoring and Verification

### 1. GitHub Actions Logs

Monitor the deployment in real-time:

1. Go to GitHub → Actions
2. Click on the running workflow
3. Click on individual jobs to see logs
4. Check for green checkmarks ✅ or red X marks ❌

### 2. Server Logs

SSH into the droplet and check service logs:

```bash
ssh deploy@165.22.114.81

# View all service logs
docker compose logs -f

# View specific service logs
docker compose logs -f web
docker compose logs -f scheduler
docker compose logs -f playout

# Check service status
docker compose ps
```

### 3. Health Checks

The deployment workflow automatically checks these endpoints:

**Stream Health** (checks stream, playout service, queue depth, and archive):
```bash
curl http://localhost:3000/api/health/stream
```

Expected response:
```json
{
  "status": "healthy",
  "playoutService": "running",
  "liveStreamAge": 15,
  "queueDepth": 120,
  "lastSegmentAt": "2025-11-18T17:00:00.000Z",
  "archiveStorage": {
    "used": "2.5 GB"
  }
}
```

**Basic Health** (simple uptime check):
```bash
curl http://localhost:3000/api/health
```

### 4. Stream Testing

Test the live stream:

```bash
# From the droplet
curl -I http://localhost:8000/lofield

# From your local machine (replace with your droplet IP)
curl -I http://165.22.114.81:8000/lofield
```

Listen to the stream in a browser:
```
http://165.22.114.81:8000/lofield
```

## Troubleshooting

### Deployment Fails at Build Stage

**Symptom**: GitHub Actions workflow fails during image build

**Solutions**:
1. Check if Dockerfiles have syntax errors
2. Verify all files referenced in Dockerfiles exist
3. Check build logs for missing dependencies
4. Ensure secrets are configured correctly

```bash
# Test build locally
docker compose build web
```

### Deployment Fails at SSH Stage

**Symptom**: "Permission denied" or "Connection refused" errors

**Solutions**:
1. Verify `DEPLOY_HOST` is correct (IP or hostname)
2. Check `DEPLOY_USER` matches server user
3. Ensure `SSH_PRIVATE_KEY` secret contains the complete private key
4. Verify public key is in `~/.ssh/authorized_keys` on the server
5. Check firewall allows SSH (port 22)

```bash
# Test SSH connection manually
ssh -i ~/.ssh/lofield_deploy deploy@165.22.114.81

# Check authorized keys on server
cat ~/.ssh/authorized_keys

# Check SSH service status
sudo systemctl status ssh
```

### Images Won't Pull on Server

**Symptom**: "unauthorized" or "not found" errors when pulling images

**Solutions**:
1. Verify `REGISTRY_USERNAME` and `REGISTRY_PASSWORD` secrets
2. Ensure PAT has `write:packages` scope
3. Check if images exist in GHCR
4. Make packages public or verify auth

```bash
# On the server, test GHCR login
echo $GHCR_TOKEN | docker login ghcr.io -u $GHCR_USERNAME --password-stdin

# List images
docker images | grep ghcr.io

# Manually pull an image
docker pull ghcr.io/mitchellfyi/lofield/web:latest
```

### Database Migration Fails

**Symptom**: Migration errors during deployment

**Solutions**:
1. Check database is running: `docker compose ps postgres`
2. Verify `DATABASE_URL` in `.env` is correct
3. Check PostgreSQL logs: `docker compose logs postgres`
4. Manually run migrations: `docker compose run --rm scheduler npx prisma migrate deploy`

```bash
# Check database connectivity
docker compose exec postgres psql -U lofield -d lofield_fm -c "SELECT 1;"

# Reset and re-run migrations (CAUTION: destroys data)
docker compose exec web npx prisma migrate reset
docker compose run --rm scheduler npx prisma migrate deploy
```

### Health Checks Fail

**Symptom**: Deployment succeeds but health check returns error

**Solutions**:
1. Wait longer for services to start (default: 10 seconds)
2. Check if web service is running: `docker compose ps web`
3. Check web service logs: `docker compose logs web`
4. Test health endpoint manually: `curl http://localhost:3000/api/health/stream`
5. Verify playout service is generating stream files

```bash
# Check if web service is accessible
curl http://localhost:3000/api/health

# Check if stream files exist
ls -lah /var/lofield/stream/

# Restart web service
docker compose restart web
```

### Services Keep Restarting

**Symptom**: Services restart in a loop

**Solutions**:
1. Check logs for crash reasons: `docker compose logs <service>`
2. Verify environment variables in `.env`
3. Check resource usage: `docker stats`
4. Ensure volumes have correct permissions
5. Verify API keys are valid

```bash
# Check resource usage
docker stats

# Check specific service
docker compose logs --tail=100 scheduler

# Restart a single service
docker compose restart scheduler
```

### Out of Disk Space

**Symptom**: "no space left on device" errors

**Solutions**:
1. Clean up Docker resources:
   ```bash
   docker system prune -a
   docker volume prune
   ```
2. Remove old images: `docker image prune -f`
3. Check disk usage: `df -h`
4. Monitor volume sizes: `docker system df`
5. Configure log rotation for Docker

```bash
# Check disk usage
df -h

# See Docker disk usage
docker system df

# Clean up everything (CAUTION)
docker system prune -a --volumes
```

### Service Shows "Unhealthy" Status

**Symptom**: Docker health check marks service as unhealthy

**Solutions**:
1. Check health check command in `docker-compose.yml`
2. Verify service is actually responding
3. Check if ports are accessible
4. Review service logs

```bash
# Check health status
docker compose ps

# Inspect health check details
docker inspect lofield_web | grep -A 10 Health

# Test health check manually
docker exec lofield_web wget --quiet --tries=1 --spider http://localhost:3000/api/health
```

## Rollback Procedures

### Rollback to Previous Deployment

If a deployment fails, you can quickly rollback:

**Method 1: Revert the commit**
```bash
# On your local machine
git revert <bad-commit-sha>
git push origin main
# GitHub Actions will deploy the reverted state
```

**Method 2: Deploy a specific commit**
```bash
# SSH into the droplet
ssh deploy@165.22.114.81
cd /home/deploy/lofield

# Pull a specific image tag (use commit SHA)
docker pull ghcr.io/mitchellfyi/lofield/web:<previous-commit-sha>

# Update docker-compose.yml to use specific tags
# Then restart
docker compose up -d
```

**Method 3: Restore from backup**
```bash
# Stop services
docker compose down

# Restore database backup
cat backup.sql | docker compose exec -T postgres psql -U lofield lofield_fm

# Start services
docker compose up -d
```

## Best Practices

### 1. Use Staging Environment

Before deploying to production:
- Test changes in a staging droplet
- Use a separate `staging` branch
- Configure a separate workflow for staging

### 2. Database Backups

Automate database backups:

```bash
# Create backup script
cat > /home/deploy/backup.sh << 'EOF'
#!/bin/bash
BACKUP_DIR=/home/deploy/backups
mkdir -p $BACKUP_DIR
docker compose exec -T postgres pg_dump -U lofield lofield_fm | gzip > $BACKUP_DIR/lofield_$(date +%Y%m%d_%H%M%S).sql.gz
find $BACKUP_DIR -name "lofield_*.sql.gz" -mtime +7 -delete
EOF

chmod +x /home/deploy/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
# Add: 0 2 * * * /home/deploy/backup.sh
```

### 3. Monitoring and Alerting

Set up monitoring:
- Use UptimeRobot or similar for uptime monitoring
- Monitor health endpoints every 5 minutes
- Set up alerts for service failures
- Track resource usage (CPU, RAM, disk)

### 4. Security

- Keep packages updated: `sudo apt update && sudo apt upgrade`
- Configure firewall: `ufw allow 22,80,443,3000,8000/tcp`
- Use SSL/TLS certificates (Let's Encrypt)
- Rotate secrets regularly
- Limit SSH access to specific IPs if possible
- Use strong passwords and keys
- Enable Docker Content Trust

### 5. Logging

Configure centralized logging:
- Use Docker logging drivers
- Ship logs to external service (e.g., Papertrail, Loggly)
- Rotate logs to prevent disk space issues
- Monitor error rates

## Additional Resources

- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/en/actions)
- [GHCR Documentation](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-container-registry)
- [DigitalOcean Docker Tutorial](https://www.digitalocean.com/community/tutorials/how-to-install-and-use-docker-on-ubuntu-22-04)

## Related Documentation

- [DOCKER.md](../DOCKER.md) - Docker setup and development (issue #71)
- Issue #65 - Environment configuration
- Issue #66 - Deployment plan
- Issue #71 - Docker setup

---

*Lofield FM: Now deploying automatically, because we trust computers more than we trust ourselves.*
