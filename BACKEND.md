# Lofield FM Backend Services

This document provides comprehensive documentation for the Lofield FM backend infrastructure, including API endpoints, database schema, streaming setup, and the scheduler service.

## Architecture Overview

The Lofield FM backend is built using:

- **Framework**: Next.js 16 API Routes (TypeScript)
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: Server-Sent Events (SSE) for live updates
- **Streaming**: Placeholder for Icecast or Node-based streaming server
- **Scheduler**: Node.js service for content generation and queue management

### Why Next.js API Routes?

We chose to use Next.js API Routes rather than a separate Express/Koa server for several reasons:

1. **Unified Codebase**: Keep frontend and backend in the same repository with shared TypeScript types
2. **Simplified Deployment**: Single deployment target instead of managing multiple services
3. **Edge-Ready**: Can deploy to serverless/edge platforms easily if needed
4. **Developer Experience**: Hot reload, TypeScript support, and modern tooling out of the box

The trade-off is that for very high-traffic scenarios or complex background jobs, we may need to extract certain services (like the scheduler) into separate microservices. For now, this architecture provides the best balance of simplicity and capability.

## Database Schema

We use Prisma as our ORM with PostgreSQL. The schema includes:

### Tables

1. **`Request`** - User-submitted song/topic requests
   - `id`: Unique identifier (CUID)
   - `userId`: Optional user identifier
   - `type`: "music" or "talk"
   - `rawText`: Original submission
   - `normalized`: LLM-processed prompt
   - `votes`: Upvote count
   - `status`: "pending", "approved", "rejected", "used"
   - `moderationStatus`: "pending", "approved", "rejected", "flagged"
   - `createdAt`, `usedAt`: Timestamps

2. **`Track`** - Generated music tracks
   - `id`: Unique identifier
   - `requestId`: Link to source request (optional)
   - `filePath`: Path to audio file
   - `title`, `artist`: Metadata
   - `lengthSeconds`: Duration
   - `createdAt`: Timestamp

3. **`Segment`** - Broadcast segments (music, talk, idents, handovers)
   - `id`: Unique identifier
   - `showId`: Link to show
   - `type`: "music", "talk", "ident", "handover"
   - `filePath`: Path to audio file
   - `startTime`, `endTime`: Scheduling times
   - `requestId`, `trackId`: Optional links
   - `metadata`: JSON for additional data

4. **`Show`** - Show definitions (synced from config/shows/*.json)
   - `id`: Matches config file ID
   - `name`, `description`: Show metadata
   - `startHour`, `durationHours`: Scheduling
   - `talkFraction`, `musicFraction`: Ratio requirements
   - `presenterIds`: JSON array of presenter IDs
   - `configJson`: Full configuration

5. **`Presenter`** - Presenter definitions (synced from config/presenters.json)
   - `id`: Matches config file ID
   - `name`: Presenter name
   - `voiceId`: TTS voice identifier
   - `personaJson`: Full personality configuration

6. **`Playlog`** - Record of what has been broadcast
   - `id`: Unique identifier
   - `segmentId`: Link to segment
   - `playedAt`: Timestamp

### Relationships

- Request → Track (one-to-many)
- Request → Segment (one-to-many)
- Track → Segment (one-to-many)
- Show → Segment (one-to-many)
- Segment → Playlog (one-to-many)

## API Endpoints

All endpoints are under `/api/` and return JSON.

### Requests

#### `GET /api/requests`

List and filter requests.

**Query Parameters:**
- `status` (optional): Filter by status ("pending", "approved", "rejected", "used")
- `limit` (optional): Number of results (default: 50)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
[
  {
    "id": "clx...",
    "type": "music",
    "rawText": "Chill sunset vibes with jazzy piano",
    "normalized": "Lofi hip-hop with warm jazz chords...",
    "votes": 12,
    "status": "pending",
    "moderationStatus": "approved",
    "createdAt": "2024-01-15T10:30:00Z",
    "usedAt": null
  }
]
```

#### `POST /api/requests`

Submit a new request.

**Request Body:**
```json
{
  "type": "music",
  "text": "Rainy day coffee shop atmosphere with soft guitar"
}
```

**Validation:**
- `type` must be "music" or "talk"
- `text` must be at least 10 characters

**Response:**
```json
{
  "id": "clx...",
  "type": "music",
  "rawText": "Rainy day coffee shop atmosphere with soft guitar",
  "votes": 0,
  "status": "pending",
  "moderationStatus": "pending",
  "createdAt": "2024-01-15T11:00:00Z"
}
```

#### `POST /api/requests/{id}/vote`

Upvote a request.

**Response:**
```json
{
  "success": true,
  "id": "clx...",
  "votes": 13
}
```

### Now Playing

#### `GET /api/now-playing`

Get the currently playing segment.

**Response:**
```json
{
  "segmentId": "clx...",
  "type": "music",
  "startTime": "2024-01-15T11:00:00Z",
  "endTime": "2024-01-15T11:03:30Z",
  "showName": "Morning Commute (The Fictional One)",
  "title": "Rainy Coding Session",
  "artist": "Lofield FM",
  "requestText": "Rainy day coffee shop atmosphere",
  "requesterName": "Alex in Bristol"
}
```

### Queue

#### `GET /api/queue`

Get upcoming segments.

**Query Parameters:**
- `minutes` (optional): Look-ahead window in minutes (default: 60)

**Response:**
```json
{
  "queueLength": 5,
  "minutesAhead": 60,
  "items": [
    {
      "segmentId": "clx...",
      "type": "music",
      "scheduledTime": "2024-01-15T11:03:30Z",
      "duration": 210,
      "title": "Deep Focus Beats"
    },
    {
      "segmentId": "clx...",
      "type": "talk",
      "scheduledTime": "2024-01-15T11:07:00Z",
      "duration": 30
    }
  ]
}
```

### Archive

#### `GET /api/archive`

Get archived segments.

**Query Parameters:**
- `start_time` (optional): ISO 8601 timestamp
- `end_time` (optional): ISO 8601 timestamp
- `show_id` (optional): Filter by show
- `limit` (optional): Number of results (default: 50)

**Response:**
```json
{
  "total": 23,
  "segments": [
    {
      "id": "clx...",
      "showName": "Morning Commute (The Fictional One)",
      "startTime": "2024-01-15T09:00:00Z",
      "endTime": "2024-01-15T09:03:30Z",
      "type": "music",
      "streamUrl": "/audio/segment_123.mp3"
    }
  ]
}
```

### Real-Time Updates

#### `GET /api/events`

Server-Sent Events endpoint for real-time updates.

**Usage:**
```javascript
const eventSource = new EventSource('/api/events');

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('now-playing', (e) => {
  const nowPlaying = JSON.parse(e.data);
  console.log('Now playing:', nowPlaying);
});
```

**Events:**
- `connected`: Sent when connection is established
- `now-playing`: Sent every 10 seconds with current segment data

## Local Development Setup

### Prerequisites

- Node.js 20+
- Docker and Docker Compose (recommended) OR PostgreSQL installed locally

### Quick start (Docker + Make)

The repo includes a `Makefile` that wraps every Docker Compose command:

1. **Bootstrap environment variables**
   ```bash
   make setup
   # edit .env with real secrets + API keys
   ```
   `make setup` copies `.env.docker → .env` (if needed) and syncs the root `.env` into `web/.env`, `web/.env.local`, `services/scheduler/.env`, and `services/playout/.env`. Re-run `make env-sync` whenever you change `.env`.

2. **Launch the full stack**
   ```bash
   make dev        # or: make dev-hot for bind mounts + hot reload
   ```
   This starts PostgreSQL (5432), Icecast (8000), the Next.js app (3000), the scheduler, and playout services.

3. **Apply migrations & seed data**
   ```bash
   make migrate
   make seed
   ```

The API is now reachable at `http://localhost:3000/api/` and the live stream at `http://localhost:8000/lofield`.

Need detached containers or raw commands? Use `docker compose up --build -d`, `docker compose exec web npx prisma migrate deploy`, etc.—the Make targets simply wrap those calls.

### Alternative: Local PostgreSQL

If you prefer not to use Docker:

1. **Install PostgreSQL** on your system
2. **Create a database:**
   ```bash
   createdb lofield_fm
   ```
3. **Update DATABASE_URL** in `.env`:
   ```
   DATABASE_URL="postgresql://yourusername:yourpassword@localhost:5432/lofield_fm"
   ```
4. **Run `make env-sync`** so the service-specific `.env` files match
5. **Use the usual npm workflows** inside `web/` and `services/*/`

### Database Management

**View database in Prisma Studio:**
```bash
make studio
```

**Create a new migration:**
```bash
npx prisma migrate dev --name <migration_name>
```

**Reset database (WARNING: deletes all data):**
```bash
npx prisma migrate reset
```

## Streaming Infrastructure

### Options

We have two primary options for streaming:

1. **Icecast** (Traditional radio streaming server)
   - Pros: Battle-tested, supports multiple formats, built for radio
   - Cons: Separate service to manage, requires configuration

2. **Node-based streaming** (Custom implementation)
   - Pros: Fully integrated with our stack, easier to customize
   - Cons: More work to build, potential performance issues at scale

### Icecast Setup (Recommended)

**Install Icecast:**
```bash
# Ubuntu/Debian
sudo apt-get install icecast2

# macOS
brew install icecast
```

**Configure Icecast:**
Edit `/etc/icecast2/icecast.xml`:
```xml
<icecast>
  <limits>
    <clients>100</clients>
    <sources>2</sources>
  </limits>
  
  <authentication>
    <source-password>hackme</source-password>
    <admin-password>hackme</admin-password>
  </authentication>
  
  <hostname>localhost</hostname>
  <listen-socket>
    <port>8000</port>
  </listen-socket>
  
  <mount>
    <mount-name>/lofield</mount-name>
    <stream-name>Lofield FM</stream-name>
    <stream-description>Background noise for people just trying to make it through the day</stream-description>
    <stream-genre>Lo-Fi</stream-genre>
  </mount>
</icecast>
```

**Start Icecast:**
```bash
sudo systemctl start icecast2
```

**Access the stream:**
- Stream URL: `http://localhost:8000/lofield`
- Admin UI: `http://localhost:8000/admin/`

### Feeding Audio to the Stream

The scheduler service will need to connect to Icecast as a source client and stream audio data. This can be done using libraries like:
- `icecast-metadata-js` for Node.js
- `libshout` bindings for Node.js
- FFmpeg piped to Icecast

## Scheduler Service

The scheduler service runs as a separate process and is responsible for maintaining the broadcast queue.

### Location

`services/scheduler/index.ts`

### Running the Scheduler

```bash
cd services/scheduler
npx tsx index.ts
```

Or with custom configuration:
```bash
SCHEDULER_BUFFER_MINUTES=60 \
SCHEDULER_CHECK_INTERVAL=30 \
AUDIO_STORAGE_PATH=/var/lofield/audio \
npx tsx index.ts
```

### How It Works

1. **Queue Monitoring**: Checks every minute (configurable) to see how much content is queued
2. **Buffer Maintenance**: Ensures at least 45 minutes (configurable) of content is ready
3. **Content Generation**: When queue runs low, generates new segments:
   - Fetches top-voted requests
   - Normalizes prompts using LLM
   - Generates music using text-to-music AI
   - Generates presenter commentary using LLM + TTS
   - Creates segments in database
4. **Playlog Recording**: Records when segments are played

### AI Integration Points

The scheduler has stub methods for AI integration:

- `normalizeRequestWithLLM()`: Call OpenAI/Anthropic to normalize requests
- `generateMusic()`: Call MusicGen/Stable Audio to create lofi tracks
- `generateCommentary()`: Generate script with LLM, convert to audio with TTS

These will be implemented in future iterations.

## Environment Variables

See `.env.example` for all available environment variables.

**Required:**
- `DATABASE_URL`: PostgreSQL connection string

**Optional:**
- `AUDIO_STORAGE_PATH`: Where to store generated audio files (default: `/tmp/lofield/audio`)
- `SCHEDULER_BUFFER_MINUTES`: Content buffer size (default: 45)
- `ICECAST_*`: Streaming server configuration
- `*_API_KEY`: API keys for AI services (for future use)

## Testing the API

### Using curl

**Submit a request:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "music", "text": "Calm evening vibes with gentle piano"}'
```

**Get requests:**
```bash
curl http://localhost:3000/api/requests?status=pending
```

**Upvote a request:**
```bash
curl -X POST http://localhost:3000/api/requests/{id}/vote
```

**Get now playing:**
```bash
curl http://localhost:3000/api/now-playing
```

**Get queue:**
```bash
curl http://localhost:3000/api/queue?minutes=30
```

### Using the Browser

Visit `http://localhost:3000` to see the web interface, which uses these API endpoints.

## Production Deployment

### Database

For production, use a managed PostgreSQL service:
- **Vercel Postgres**: Seamless integration if deploying to Vercel
- **Supabase**: Postgres + real-time features
- **AWS RDS**: Enterprise-grade managed PostgreSQL
- **Railway**: Simple PostgreSQL hosting

Update your `DATABASE_URL` environment variable in production.

### API

Deploy the Next.js app to:
- **Vercel** (recommended for Next.js)
- **Railway**
- **Docker** on any cloud provider

### Scheduler Service

The scheduler should run as a separate always-on process:
- **PM2** for process management
- **Docker** container with restart policy
- **Kubernetes** deployment
- **Systemd** service on Linux

### Streaming Server

Deploy Icecast on:
- Dedicated server (VPS)
- Docker container
- Or use a managed streaming service

## Security Considerations

1. **Rate Limiting**: Implement rate limiting on POST endpoints to prevent spam
2. **Authentication**: Add user authentication for request submissions
3. **Input Validation**: All user inputs are validated and sanitized
4. **SQL Injection**: Prisma provides protection against SQL injection
5. **CORS**: Configure CORS policies for production
6. **Environment Variables**: Never commit `.env` files; use secrets management

## Future Enhancements

- [ ] User authentication and accounts
- [ ] Request moderation dashboard
- [ ] Admin panel for content management
- [ ] Websockets for lower latency real-time updates
- [ ] Metrics and monitoring (Prometheus, Grafana)
- [ ] CDN integration for audio delivery
- [ ] Multi-region database replication
- [ ] Automated backup and disaster recovery

## Troubleshooting

### Database connection issues

If you get database connection errors:
1. Check that PostgreSQL is running
2. Verify `DATABASE_URL` in `.env`
3. Run `npx prisma db push` to sync schema

### Prisma client not found

Run:
```bash
npx prisma generate
```

### Migration errors

Reset the database (WARNING: deletes data):
```bash
npx prisma migrate reset
```

## Support

For issues or questions:
- Check the [main README](../README.md)
- Review [architecture documentation](../docs/architecture.md)
- Open an issue on GitHub

---

*Lofield FM Backend: Keeping the music playing, one API call at a time.*
