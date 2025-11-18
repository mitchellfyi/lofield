# Docker Setup for Lofield FM

This guide explains how to build and run Lofield FM using Docker and Docker Compose for both local development and production deployment.

## Overview

The Docker setup provides:

- **Multi-stage Dockerfiles** for optimized production images
- **Development mode** with hot reload support
- **Complete service stack**: Web app (Next.js), Scheduler, Playout, Database (PostgreSQL), Streaming (Icecast), and optional Nginx reverse proxy
- **Health checks** for all services
- **Persistent volumes** for data storage
- **Environment configuration** via `.env` files

## Architecture

```
┌─────────────┐
│   Nginx     │  (Optional reverse proxy - production only)
│  Port 80    │
└─────┬───────┘
      │
      ├─────────────┐
      │             │
┌─────▼─────┐ ┌────▼────────┐
│    Web    │ │   Playout   │
│  Next.js  │ │  Streaming  │
│  Port 3000│ │             │
└─────┬─────┘ └────┬────────┘
      │            │
      │       ┌────▼────────┐
      │       │   Icecast   │
      │       │  Port 8000  │
      │       └─────────────┘
      │
┌─────▼─────┐
│ Scheduler │
└─────┬─────┘
      │
┌─────▼─────┐
│ PostgreSQL│
│  Port 5432│
└───────────┘
```

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (version 20.10 or later)
- [Docker Compose](https://docs.docker.com/compose/install/) (version 2.0 or later)
- At least 4GB of available RAM
- API keys for AI services (OpenAI, Replicate)

## Quick Start

### 1. Environment Setup

Copy the example environment file and configure it:

```bash
cp .env.docker .env
```

Edit `.env` and set the required values:

```bash
# Required: Set secure passwords
POSTGRES_PASSWORD=your-secure-database-password
ICECAST_SOURCE_PASSWORD=your-secure-source-password
ICECAST_ADMIN_PASSWORD=your-secure-admin-password
ICECAST_RELAY_PASSWORD=your-secure-relay-password

# Required: AI service API keys
OPENAI_API_KEY=sk-...
REPLICATE_API_TOKEN=r8_...

# Optional: Additional AI services
ELEVENLABS_API_KEY=...
```

**Security Note**: Generate secure passwords using:
```bash
openssl rand -base64 32
```

### 2. Production Deployment

Build and start all services:

```bash
docker-compose up --build -d
```

This will start:
- PostgreSQL database (port 5432)
- Icecast streaming server (port 8000)
- Web application (port 3000)
- Scheduler service (background)
- Playout/streaming service (background)

To include Nginx reverse proxy:

```bash
docker-compose --profile production up --build -d
```

### 3. Development Mode

For local development with hot reload:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up --build
```

This mounts your source code as volumes, enabling live code updates without rebuilding containers.

### 4. Access the Application

- **Web UI**: http://localhost:3000
- **Live Stream**: http://localhost:8000/lofield (via Icecast)
- **Icecast Admin**: http://localhost:8000/admin/ (username: admin)
- **With Nginx**: http://localhost (port 80)

## Database Management

### Running Migrations

Migrations run automatically when the scheduler and playout services start. To run manually:

```bash
# Using web service
docker-compose exec web npx prisma migrate deploy

# Or directly
docker-compose exec scheduler npx prisma migrate deploy --schema=../web/prisma/schema.prisma
```

### Seeding the Database

```bash
docker-compose exec web npx tsx prisma/seed/seed.ts
```

### Accessing Prisma Studio

```bash
docker-compose exec web npx prisma studio
```

Then open http://localhost:5555

### Database Backups

Backup the PostgreSQL database:

```bash
docker-compose exec postgres pg_dump -U lofield lofield_fm > backup.sql
```

Restore from backup:

```bash
cat backup.sql | docker-compose exec -T postgres psql -U lofield lofield_fm
```

## Service Management

### View Logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f web
docker-compose logs -f scheduler
docker-compose logs -f playout
```

### Restart Services

```bash
# All services
docker-compose restart

# Specific service
docker-compose restart scheduler
```

### Stop Services

```bash
# Stop all
docker-compose down

# Stop and remove volumes (WARNING: deletes data)
docker-compose down -v
```

### Check Service Health

```bash
docker-compose ps
```

## Volumes and Data Persistence

The setup uses Docker volumes for persistent data:

- `postgres_data`: PostgreSQL database files
- `audio_storage`: Generated audio files (shared between scheduler and playout)
- `cache_storage`: AI service response cache
- `stream_output`: Live stream output files
- `archive_output`: Archived broadcast files

### Inspect Volumes

```bash
docker volume ls
docker volume inspect lofield_postgres_data
```

### Backup Volumes

```bash
# Backup audio storage
docker run --rm -v lofield_audio_storage:/data -v $(pwd):/backup alpine tar czf /backup/audio_backup.tar.gz -C /data .

# Restore audio storage
docker run --rm -v lofield_audio_storage:/data -v $(pwd):/backup alpine tar xzf /backup/audio_backup.tar.gz -C /data
```

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `POSTGRES_PASSWORD` | PostgreSQL password | (secure random string) |
| `ICECAST_SOURCE_PASSWORD` | Icecast source password | (secure random string) |
| `ICECAST_ADMIN_PASSWORD` | Icecast admin password | (secure random string) |
| `OPENAI_API_KEY` | OpenAI API key | `sk-...` |
| `REPLICATE_API_TOKEN` | Replicate API token | `r8_...` |

### Optional Variables

See `.env.docker` for a complete list of configurable options including:
- Music generation settings
- Script generation parameters
- TTS configuration
- Caching options
- Storage paths
- Retry policies

## Production Deployment

### Using Nginx Reverse Proxy

The optional Nginx service provides:
- SSL/TLS termination (configure certificates)
- Request routing to appropriate services
- Static asset serving
- Security headers
- Caching

To enable:

```bash
docker-compose --profile production up -d
```

### SSL/TLS Configuration

1. Obtain SSL certificates (e.g., using Let's Encrypt)
2. Update `nginx/nginx.conf` with SSL configuration
3. Mount certificates in `docker-compose.yml`:

```yaml
nginx:
  volumes:
    - ./ssl:/etc/nginx/ssl:ro
```

### Environment-Specific Configuration

Create separate env files for different environments:

```bash
# Development
docker-compose --env-file .env.dev up

# Staging
docker-compose --env-file .env.staging up

# Production
docker-compose --env-file .env.prod up
```

### Resource Limits

Add resource limits in `docker-compose.yml`:

```yaml
services:
  web:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '1'
          memory: 1G
```

## Troubleshooting

### Services Won't Start

Check logs for errors:

```bash
docker-compose logs
```

Common issues:
- Missing environment variables
- Port conflicts (3000, 5432, 8000)
- Insufficient disk space or memory

### Database Connection Errors

Verify PostgreSQL is healthy:

```bash
docker-compose ps postgres
docker-compose logs postgres
```

Test connection:

```bash
docker-compose exec postgres psql -U lofield -d lofield_fm -c "SELECT 1;"
```

### Migration Failures

Reset and re-run migrations:

```bash
docker-compose exec web npx prisma migrate reset
docker-compose exec web npx prisma migrate deploy
```

### Icecast Connection Issues

Check Icecast status:

```bash
curl http://localhost:8000/status.xsl
```

Verify source password in both `.env` and playout service config.

### Out of Memory

Increase Docker memory allocation:
- Docker Desktop: Settings → Resources → Memory
- Docker daemon: Edit `/etc/docker/daemon.json`

### Permission Errors

Services run as non-root users. If volume permissions fail:

```bash
# Fix ownership (adjust UID/GID as needed)
docker-compose exec web chown -R nextjs:nodejs /app
```

## Building for Production

### Build Images

Build without starting:

```bash
docker-compose build
```

Build specific service:

```bash
docker-compose build web
```

### Push to Registry

Tag and push images to a container registry:

```bash
# Tag images
docker tag lofield_web:latest your-registry.com/lofield/web:latest

# Push images
docker push your-registry.com/lofield/web:latest
```

### Multi-Architecture Builds

Build for multiple platforms (e.g., amd64, arm64):

```bash
docker buildx create --use
docker buildx build --platform linux/amd64,linux/arm64 -t your-registry.com/lofield/web:latest ./web
```

## Development Workflow

### Hot Reload Development

Use the development compose file:

```bash
docker-compose -f docker-compose.yml -f docker-compose.dev.yml up
```

Changes to source code will automatically reload the services.

### Running Tests

```bash
# Web tests
docker-compose exec web npm test

# Scheduler tests
docker-compose exec scheduler npm test

# Playout tests
docker-compose exec playout npm test
```

### Installing Dependencies

After adding dependencies to `package.json`:

```bash
# Rebuild the service
docker-compose build web

# Or in dev mode, just restart
docker-compose restart web
```

### Code Linting

```bash
docker-compose exec web npm run lint
docker-compose exec web npm run format
```

## CI/CD Integration

### Example GitHub Actions Workflow

```yaml
name: Build and Push Docker Images

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Build images
        run: docker-compose build
      
      - name: Run tests
        run: |
          docker-compose up -d postgres
          docker-compose run web npm test
      
      - name: Push to registry
        run: |
          echo "${{ secrets.REGISTRY_PASSWORD }}" | docker login -u "${{ secrets.REGISTRY_USERNAME }}" --password-stdin
          docker-compose push
```

## Additional Resources

- [Next.js Docker Documentation](https://nextjs.org/docs/deployment#docker-image)
- [PostgreSQL Docker Hub](https://hub.docker.com/_/postgres)
- [Icecast Documentation](https://icecast.org/docs/)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [Prisma Docker Guide](https://www.prisma.io/docs/guides/deployment/deployment-guides/deploying-to-aws-ecs)

## Support

For issues or questions:
- Check the [main README](README.md)
- Review [BACKEND.md](BACKEND.md) for backend architecture
- File an issue on GitHub

---

*Lofield FM: Now containerized for your deployment convenience.*
