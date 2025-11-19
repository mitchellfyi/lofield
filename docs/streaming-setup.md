# Streaming Setup Guide

This guide walks you through setting up the complete Lofield FM streaming infrastructure.

## Overview

The streaming system consists of three main components:

1. **Scheduler Service** - Generates and queues audio segments
2. **Playout Service** - Creates HLS streams from queued segments
3. **Next.js API** - Serves streams and archives to the frontend

## Prerequisites

### System Requirements

- **Operating System**: Linux (Ubuntu/Debian recommended) or macOS
- **Node.js**: Version 20 or higher
- **PostgreSQL**: Version 14 or higher
- **FFmpeg**: Version 4.4 or higher
- **Disk Space**: Minimum 10GB for archives (more recommended)

### Install FFmpeg

#### Ubuntu/Debian
```bash
sudo apt-get update
sudo apt-get install ffmpeg
ffmpeg -version
```

#### macOS
```bash
brew install ffmpeg
ffmpeg -version
```

#### Verify Installation
```bash
ffmpeg -version
# Should show version 4.4 or higher
```

## Step 1: Database Setup

### Start PostgreSQL

Using Docker Compose (recommended):
```bash
cd /path/to/lofield
docker compose up -d postgres
```

Or use your own PostgreSQL installation.

### Run Migrations

```bash
cd web
npx prisma migrate deploy
```

### Seed Initial Data

```bash
cd web
npx tsx prisma/seed/seed.ts
```

This creates:
- Show definitions
- Presenter profiles
- Initial segment queue (if available)

## Step 2: Configure Environment Variables

Use the Makefile target to copy the root `.env` everywhere:

```bash
make env-sync
```

`make env-sync` copies `.env` into `web/.env`, `web/.env.local`, `services/scheduler/.env`, and `services/playout/.env`. Update the root `.env` first (passwords, API keys, cache paths) and re-run the sync anytime you change it.

If you need service-specific overrides, edit the copied files after syncing:

### Scheduler Service (optional overrides)

```bash
DATABASE_URL="postgresql://lofield:password@localhost:5432/lofield_fm"
SCHEDULER_BUFFER_MINUTES=45
MIN_QUEUE_DEPTH_MINUTES=15
AUDIO_STORAGE_PATH="/var/lofield/audio"
ARCHIVE_PATH="/var/lofield/archive"
```

### Playout Service (optional overrides)

```bash
DATABASE_URL="postgresql://lofield:password@localhost:5432/lofield_fm"
STREAM_OUTPUT_PATH="/var/lofield/stream"
ARCHIVE_OUTPUT_PATH="/var/lofield/archive"
HLS_SEGMENT_DURATION=6
HLS_LIST_SIZE=10
AUDIO_BITRATE=128k
POLL_INTERVAL=5
ARCHIVE_RETENTION_DAYS=30
```

### Next.js Frontend (optional overrides)

```bash
DATABASE_URL="postgresql://lofield:password@localhost:5432/lofield_fm"
STREAM_OUTPUT_PATH="/var/lofield/stream"
ARCHIVE_OUTPUT_PATH="/var/lofield/archive"
NEXT_PUBLIC_STREAM_URL="http://localhost:3000/api/stream/live.m3u8"
```

## Step 3: Create Storage Directories

```bash
sudo mkdir -p /var/lofield/audio
sudo mkdir -p /var/lofield/stream
sudo mkdir -p /var/lofield/archive
sudo chown -R $USER:$USER /var/lofield
chmod -R 755 /var/lofield
```

Or use a different location (update environment variables accordingly):
```bash
mkdir -p ~/lofield/audio
mkdir -p ~/lofield/stream
mkdir -p ~/lofield/archive
```

## Step 4: Install Dependencies

### Scheduler Service
```bash
cd services/scheduler
npm install
```

### Playout Service
```bash
cd services/playout
npm install
```

### Web Frontend
```bash
cd web
npm install
npx prisma generate
```

## Step 5: Start Services

### Terminal 1: Scheduler Service

```bash
cd services/scheduler
npm start
```

Expected output:
```
{"timestamp":"2024-01-15T14:00:00.000Z","level":"info","message":"Starting Lofield FM Scheduler Service..."}
{"timestamp":"2024-01-15T14:00:00.100Z","level":"info","message":"Current show","data":{"showId":"deep_work_allegedly","name":"Deep Work (According to Calendar Blocks)"}}
```

### Terminal 2: Playout Service

```bash
cd services/playout
npm start
```

Expected output:
```
{"timestamp":"2024-01-15T14:00:00.000Z","level":"info","message":"Starting Lofield FM Playout Service..."}
{"timestamp":"2024-01-15T14:00:05.000Z","level":"info","message":"Processing segments","data":{"count":5}}
{"timestamp":"2024-01-15T14:00:06.000Z","level":"info","message":"FFmpeg started"}
```

### Terminal 3: Next.js Frontend

```bash
cd web
npm run dev
```

Expected output:
```
  ▲ Next.js 16.0.3
  - Local:        http://localhost:3000
  - Ready in 2.3s
```

## Step 6: Verify Streaming

### Check Health Endpoint

```bash
curl http://localhost:3000/api/health/stream
```

Expected response:
```json
{
  "status": "healthy",
  "playoutService": "running",
  "liveStreamAge": 3,
  "queueDepth": 45,
  "lastSegmentAt": "2024-01-15T14:00:00Z",
  "archiveStorage": {
    "available": "unknown",
    "used": "0 MB"
  }
}
```

### Check Live Stream Manifest

```bash
curl http://localhost:3000/api/stream/live.m3u8
```

Expected response:
```
#EXTM3U
#EXT-X-VERSION:3
#EXT-X-TARGETDURATION:6
#EXT-X-MEDIA-SEQUENCE:1234
#EXTINF:6.0,
live001.ts
#EXTINF:6.0,
live002.ts
```

### Test in Browser

1. Open http://localhost:3000
2. You should see the audio player
3. Click play
4. Audio should start streaming

## Troubleshooting

### Scheduler Service Issues

**Problem**: "No segments being generated"

Solution:
1. Check database connection: `psql $DATABASE_URL`
2. Verify show data exists: `SELECT COUNT(*) FROM "Show";`
3. Check logs for AI generation errors
4. Ensure audio storage path is writable

**Problem**: "Queue running dry"

Solution:
1. Increase `SCHEDULER_BUFFER_MINUTES` (default: 45)
2. Reduce `MIN_QUEUE_DEPTH_MINUTES` (default: 15)
3. Check request queue: `SELECT COUNT(*) FROM "Request" WHERE status = 'approved';`

### Playout Service Issues

**Problem**: "FFmpeg not found"

Solution:
```bash
which ffmpeg
# If not found, install FFmpeg (see Prerequisites)
```

**Problem**: "No segments to process"

Solution:
1. Ensure scheduler service is running
2. Check database for queued segments:
   ```sql
   SELECT COUNT(*) FROM "Segment" WHERE "startTime" > NOW();
   ```
3. Verify file paths in database match actual files

**Problem**: "Permission denied" on stream directory

Solution:
```bash
sudo chown -R $USER:$USER /var/lofield
chmod -R 755 /var/lofield
```

### Streaming Issues

**Problem**: "Stream not playing in browser"

Solution:
1. Open browser console (F12) and check for errors
2. Verify HLS.js is loaded: check network tab
3. Test manifest directly: `curl http://localhost:3000/api/stream/live.m3u8`
4. Check segment files exist:
   ```bash
   ls -la /var/lofield/stream/
   ```

**Problem**: "HLS error: network error"

Solution:
1. Check that segment files are being served
2. Verify CORS headers in API responses
3. Try refreshing the page
4. Check browser console for specific error codes

**Problem**: "Audio stuttering or buffering"

Solution:
1. Increase `HLS_LIST_SIZE` (default: 10)
2. Reduce `HLS_SEGMENT_DURATION` (default: 6)
3. Check system load: `top` or `htop`
4. Verify adequate disk I/O speed

### Archive Issues

**Problem**: "Time-shift not working"

Solution:
1. Check archive directory exists and has files:
   ```bash
   ls -la /var/lofield/archive/
   ```
2. Verify archive index exists:
   ```bash
   cat /var/lofield/archive/archive-index.json
   ```
3. Check playout service is archiving segments (logs)

**Problem**: "Old archives not being cleaned up"

Solution:
1. Verify `ARCHIVE_RETENTION_DAYS` is set
2. Check playout service logs for cleanup runs
3. Manually trigger cleanup if needed (restart playout service)

## Production Deployment

### Using PM2 (Recommended)

Install PM2:
```bash
npm install -g pm2
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'lofield-scheduler',
      cwd: './services/scheduler',
      script: 'index.ts',
      interpreter: 'tsx',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://...',
      },
    },
    {
      name: 'lofield-playout',
      cwd: './services/playout',
      script: 'index.ts',
      interpreter: 'tsx',
      env: {
        NODE_ENV: 'production',
        DATABASE_URL: 'postgresql://...',
      },
    },
    {
      name: 'lofield-web',
      cwd: './web',
      script: 'npm',
      args: 'start',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
};
```

Start all services:
```bash
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Using Docker

See `docker-compose.yml` for a complete containerized setup.

### Using Systemd

Create service files in `/etc/systemd/system/`:

**lofield-scheduler.service**:
```ini
[Unit]
Description=Lofield FM Scheduler Service
After=network.target postgresql.service

[Service]
Type=simple
User=lofield
WorkingDirectory=/opt/lofield/services/scheduler
ExecStart=/usr/bin/npx tsx index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**lofield-playout.service**:
```ini
[Unit]
Description=Lofield FM Playout Service
After=network.target postgresql.service

[Service]
Type=simple
User=lofield
WorkingDirectory=/opt/lofield/services/playout
ExecStart=/usr/bin/npx tsx index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable lofield-scheduler
sudo systemctl enable lofield-playout
sudo systemctl start lofield-scheduler
sudo systemctl start lofield-playout
```

## Monitoring

### Log Monitoring

#### PM2
```bash
pm2 logs lofield-scheduler
pm2 logs lofield-playout
pm2 monit
```

#### Systemd
```bash
journalctl -u lofield-scheduler -f
journalctl -u lofield-playout -f
```

### Health Checks

Add to your monitoring system:
```bash
# Health endpoint
curl http://localhost:3000/api/health/stream

# Stream availability
curl -I http://localhost:3000/api/stream/live.m3u8

# Queue depth
curl http://localhost:3000/api/queue
```

### Metrics to Monitor

- **Scheduler**: Queue depth, segment generation rate, AI failures
- **Playout**: FFmpeg status, stream age, archive size
- **System**: CPU usage, disk space, network bandwidth

## Backup and Recovery

### Database Backups

```bash
# Backup
pg_dump $DATABASE_URL > lofield_backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < lofield_backup_20240115.sql
```

### Archive Backups

```bash
# Sync to remote storage
rsync -avz /var/lofield/archive/ user@backup-server:/backups/lofield/

# Or use cloud storage
aws s3 sync /var/lofield/archive/ s3://lofield-archives/
```

## Scaling Considerations

### Single Server (Development)

- Scheduler: 1 instance
- Playout: 1 instance
- Web: 1 instance
- Database: 1 instance
- Suitable for: < 100 concurrent listeners

### Multi-Server (Production)

- Scheduler: 1 instance (stateful)
- Playout: 1 instance (stateful)
- Web: N instances (stateless, load balanced)
- Database: Primary + replicas
- CDN: For HLS segment distribution
- Suitable for: 100+ concurrent listeners

### CDN Integration

Configure CDN to cache:
- HLS segments: Long cache (immutable)
- HLS manifests: No cache
- Archive segments: Long cache

Example Cloudflare configuration:
```
/api/stream/segments/*  - Cache everything, 1 year
/api/stream/live.m3u8   - Bypass cache
/api/archive/segments/* - Cache everything, 1 year
/api/archive/time       - Cache 1 hour
```

## Support

For issues or questions:
- Check the troubleshooting section above
- Review service logs for errors
- Open an issue on GitHub
- Consult `docs/streaming-architecture.md` for technical details

---

*Lofield FM: Now streaming in production.*
