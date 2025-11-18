# Lofield FM Playout Service

The playout service is responsible for streaming audio content using HLS (HTTP Live Streaming) and archiving segments for time-shifted playback.

## Overview

This service:
- Consumes scheduled audio segments from the database
- Generates HLS streams using FFmpeg
- Archives segments for time-shifted playback
- Provides continuous 24/7 streaming

## Architecture

The playout service works in conjunction with:
- **Scheduler Service**: Generates and queues audio segments
- **Database**: Stores segment metadata and timing
- **Next.js API**: Serves HLS manifests and segments
- **Frontend Player**: Consumes HLS streams

## Features

- ✅ HLS streaming with configurable segment duration
- ✅ Automatic archive generation
- ✅ Time-shifted playback support
- ✅ Archive retention management
- ✅ Health monitoring
- ✅ Graceful error handling

## Installation

```bash
npm install
```

## Configuration

Create a `.env` file (see `.env.example`):

```bash
# Database connection
DATABASE_URL="postgresql://lofield:password@localhost:5432/lofield_fm"

# Output paths
STREAM_OUTPUT_PATH="/var/lofield/stream"
ARCHIVE_OUTPUT_PATH="/var/lofield/archive"

# HLS settings
HLS_SEGMENT_DURATION=6
HLS_LIST_SIZE=10

# Crossfade settings (seconds)
CROSSFADE_MUSIC_TO_MUSIC=2.0
CROSSFADE_MUSIC_TO_TALK=1.0
CROSSFADE_TALK_TO_MUSIC=0.5

# Audio quality
AUDIO_BITRATE=128k
AUDIO_SAMPLE_RATE=48000

# Polling interval (seconds)
POLL_INTERVAL=5

# Archive retention (days)
ARCHIVE_RETENTION_DAYS=30
```

## Prerequisites

### FFmpeg

The playout service requires FFmpeg to be installed:

```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# macOS
brew install ffmpeg

# Verify installation
ffmpeg -version
```

### Database

Ensure PostgreSQL is running and the database schema is up to date:

```bash
cd ../../web
npx prisma migrate deploy
```

## Running the Service

### Development

```bash
npm run dev
```

### Production

```bash
npm start
```

### Using PM2

```bash
pm2 start index.ts --name lofield-playout --interpreter tsx
pm2 save
pm2 startup
```

### Using Docker

```dockerfile
FROM node:20-alpine

# Install FFmpeg
RUN apk add --no-cache ffmpeg

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .

CMD ["npm", "start"]
```

## How It Works

### 1. Segment Polling

The service polls the database every 5 seconds (configurable) for segments that should be playing now or soon.

### 2. HLS Stream Generation

When segments are found:
1. Creates a concat file listing all segment audio files
2. Runs FFmpeg to:
   - Concatenate segments
   - Apply crossfading (future enhancement)
   - Normalize volume
   - Output HLS segments (.ts files)
   - Generate HLS manifest (.m3u8 file)

### 3. Archiving

As segments are processed:
1. Copies HLS segments to archive directory
2. Organizes by date: `YYYY/MM/DD/HH/`
3. Updates archive index with metadata
4. Enables time-shifted playback

### 4. Cleanup

Periodically removes archived segments older than the retention period (default: 30 days).

## Directory Structure

```
/var/lofield/
├── stream/              # Live HLS output
│   ├── live.m3u8       # HLS manifest
│   ├── live000.ts      # Current segment
│   ├── live001.ts      # Next segment
│   └── ...
│
└── archive/            # Time-shift archive
    ├── archive-index.json
    ├── 2024/
    │   ├── 01/
    │   │   ├── 15/
    │   │   │   ├── 14/
    │   │   │   │   ├── music_1705329600000.ts
    │   │   │   │   ├── talk_1705329780000.ts
    │   │   │   │   └── ...
```

## API Integration

The playout service doesn't expose its own API. Instead, Next.js API routes serve the HLS content:

### Live Stream

```
GET /api/stream/live.m3u8          - HLS manifest
GET /api/stream/segments/:file     - HLS segments
```

### Time-Shift Archive

```
GET /api/archive/time?ts=...                - Archive playlist
GET /api/archive/shows/:id?date=...         - Show episode
GET /api/archive/segments/YYYY/MM/DD/HH/... - Archive segment
```

### Health Check

```
GET /api/health/stream   - Service health status
```

## Monitoring

### Logs

The service logs structured JSON output:

```json
{
  "timestamp": "2024-01-15T14:00:00.000Z",
  "level": "info",
  "message": "Processing segments",
  "data": { "count": 5 }
}
```

### Health Status

Check service health:

```bash
curl http://localhost:3000/api/health/stream
```

Response:

```json
{
  "status": "healthy",
  "playoutService": "running",
  "liveStreamAge": 3,
  "queueDepth": 45,
  "lastSegmentAt": "2024-01-15T14:00:00Z",
  "archiveStorage": {
    "available": "150GB",
    "used": "50GB"
  }
}
```

## Troubleshooting

### FFmpeg not found

Ensure FFmpeg is installed and in your PATH:

```bash
which ffmpeg
ffmpeg -version
```

### No segments being processed

1. Check that the scheduler service is running
2. Verify database connection
3. Ensure segments exist in the database:

```sql
SELECT COUNT(*) FROM "Segment" WHERE "startTime" > NOW();
```

### Stream not playing

1. Check that playout service is running
2. Verify manifest exists: `ls -la /var/lofield/stream/`
3. Check API endpoint: `curl http://localhost:3000/api/stream/live.m3u8`

### Archive not working

1. Ensure archive directory is writable
2. Check disk space
3. Verify archive index exists: `cat /var/lofield/archive/archive-index.json`

### High CPU usage

- FFmpeg is CPU-intensive during transcoding
- Reduce HLS segment count (HLS_LIST_SIZE)
- Consider using hardware acceleration for FFmpeg

## Performance Optimization

### Hardware Acceleration

Enable FFmpeg hardware acceleration:

```bash
# NVIDIA GPU
ffmpeg -hwaccel cuda ...

# Intel QuickSync
ffmpeg -hwaccel qsv ...

# macOS VideoToolbox
ffmpeg -hwaccel videotoolbox ...
```

### Caching

Configure CDN caching for HLS segments:

```
# Segments (immutable)
Cache-Control: public, max-age=31536000, immutable

# Manifest (no cache)
Cache-Control: no-cache
```

## Future Enhancements

- [ ] Actual crossfading implementation (currently just concatenates)
- [ ] Volume ducking during voiceovers
- [ ] Multiple quality tiers (adaptive bitrate)
- [ ] Pre-generation of show episodes
- [ ] Real-time waveform visualization data
- [ ] Integration with CDN for global distribution

## Security

- Archive segments are publicly accessible (this is intentional)
- No authentication required for streaming (free radio)
- Path traversal protection in segment serving
- Rate limiting should be applied at reverse proxy level

## License

MIT

---

*Lofield FM Playout Service: Keeping the stream flowing, one segment at a time.*
