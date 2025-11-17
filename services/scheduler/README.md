# Lofield FM Scheduler Service

The scheduler service is the heart of Lofield FM, responsible for maintaining the 24/7 broadcast by coordinating show rotations, managing the queue of segments, invoking AI modules, and ensuring continuous playback with time-shifted listening and archiving.

## Architecture

The scheduler is organized into modular components:

### Core Modules

1. **Show Scheduler** (`src/show-scheduler.ts`)
   - Selects active show based on daily schedule (3-hour blocks)
   - Handles seasonal overrides and holiday tags
   - Manages show transitions and handover segments
   - Provides seasonal context for content generation

2. **Queue Manager** (`src/queue-manager.ts`)
   - Maintains queue of upcoming segments with metadata
   - Monitors queue depth (targets 10-15 minutes minimum buffer)
   - Triggers content generation when buffer runs low
   - Tracks segment start times, file paths, show IDs, and request IDs

3. **Content Generator** (`src/content-generator.ts`)
   - Integrates AI modules for music, scripts, and TTS
   - Generates music tracks from requests
   - Creates presenter commentary segments
   - Produces handover segments between shows
   - Generates station idents
   - Provides fallback content on AI failure

4. **Archiver** (`src/archiver.ts`)
   - Records segments into hour-long archive files
   - Maintains index with file offsets for time-shifted listening
   - Enables jump-to-time functionality
   - Assembles on-demand episodes per show

5. **Broadcaster** (`src/broadcaster.ts`)
   - Publishes "now playing" metadata via EventEmitter
   - Streams upcoming segments information
   - Broadcasts request identifiers for voting
   - Supports WebSocket/SSE integration

6. **Main Scheduler** (`src/scheduler.ts`)
   - Orchestrates all components
   - Runs scheduling loop with configurable interval
   - Handles errors and recovery
   - Ensures continuous streaming

## Responsibilities

## Features

### Show Scheduling
- **Automated show selection**: Determines active show based on UTC time and day of week
- **3-hour blocks**: Eight shows rotate daily (00:00-03:00, 03:00-06:00, etc.)
- **Seasonal awareness**: Adjusts content based on season (winter, spring, summer, autumn)
- **Holiday detection**: Recognizes major holidays (Christmas, New Year, Halloween, etc.)
- **Handover segments**: Generates 5-minute transitions between shows featuring both presenter duos

### Queue Management
- **Dynamic buffer**: Maintains configurable buffer of upcoming content (default: 45 minutes)
- **Smart replenishment**: Triggers generation when queue drops below threshold (default: 15 minutes)
- **Segment tracking**: Monitors all segments with metadata (type, show, request, track, timing)
- **Statistics**: Provides queue stats by segment type and duration

### AI Integration Pipeline
- **Music generation**: Calls text-to-music AI with normalized prompts from requests
- **Script generation**: Creates presenter scripts using LLMs with show-specific style
- **Text-to-speech**: Converts scripts to audio with presenter-specific voices
- **Cohesive workflow**: Orchestrates all AI modules into complete audio segments
- **Error resilience**: Falls back to stock content when AI services fail

### Time-Shift and Archiving
- **Hourly archives**: Records broadcast into hour-long MP3 files
- **Indexed storage**: Maintains offset index for efficient seeking
- **Jump-to-time**: Enables listeners to seek to any timestamp
- **Episode assembly**: Generates on-demand show episodes from archives
- **Retention management**: Cleans up old archives based on configured retention

### Real-Time Updates
- **Now playing**: Broadcasts current segment metadata
- **Queue visibility**: Shows upcoming segments
- **Request tracking**: Notifies when requests are played
- **Show transitions**: Announces show changes
- **SSE/WebSocket ready**: EventEmitter-based broadcasting for easy integration

### Error Handling and Recovery
- **Fallback content**: Uses stock tracks and generic idents on AI failure
- **Continuous streaming**: Never stops even during failures
- **Comprehensive logging**: Records all errors and decisions
- **Graceful shutdown**: Handles SIGINT/SIGTERM cleanly

## Running Locally

### Prerequisites

- Node.js 20+
- PostgreSQL database running (use Docker Compose from root directory)
- Database migrations applied

### Setup

```bash
# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env and set your DATABASE_URL and other settings

# Make sure database is running
cd ../..
docker-compose up -d postgres

# Make sure migrations are applied
cd web
npx prisma migrate dev

# Run the scheduler
cd ../services/scheduler
npm start
```

### Environment Variables

Create a `.env` file in the scheduler directory (or set these in your shell environment):

- **`DATABASE_URL`** (required): PostgreSQL connection string
  - Format: `postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=SCHEMA`
  - Must match the database configured in `docker-compose.yml`
  - Example: `postgresql://lofield:password@localhost:5432/lofield_fm?schema=public`

- **`SCHEDULER_BUFFER_MINUTES`** (optional): How far ahead to maintain the queue
  - Default: `45` minutes
  - Valid range: Any positive integer
  - Higher values mean more content is generated in advance

- **`MIN_QUEUE_DEPTH_MINUTES`** (optional): Minimum queue depth before triggering generation
  - Default: `15` minutes
  - Valid range: Any positive integer
  - Queue replenishment starts when depth falls below this value

- **`SCHEDULER_CHECK_INTERVAL`** (optional): How often to check the queue (in seconds)
  - Default: `60` seconds
  - Valid range: Any positive integer (recommended: 30-120)
  - Lower values check more frequently but use more resources

- **`AUDIO_STORAGE_PATH`** (optional): Directory for generated audio files
  - Default: `/tmp/lofield/audio`
  - Must be a writable directory path
  - Will be created automatically if it doesn't exist

- **`ARCHIVE_PATH`** (optional): Directory for time-shift archive files
  - Default: `/tmp/lofield/archive`
  - Must be a writable directory path
  - Used to store hourly broadcast archives

**AI Integration Variables** (used when AI modules are configured):
- `OPENAI_API_KEY`: For LLM-based script generation
- `ELEVENLABS_API_KEY`: For text-to-speech (ElevenLabs provider)
- `REPLICATE_API_TOKEN`: For music generation (Replicate provider)
- `STABILITY_AI_API_KEY`: For music generation (Stability AI provider)

See `.env.example` for a template with all available variables.

## Current Status

The scheduler service is **fully implemented** with modular architecture:

### Implemented Features ✅
- ✅ Show scheduling with 3-hour block rotation
- ✅ Queue monitoring and management
- ✅ Content generation pipeline (AI module integration points)
- ✅ Handover segment generation at show boundaries
- ✅ Time-shift archiving with indexed storage
- ✅ Real-time broadcasting (EventEmitter-based)
- ✅ Error handling and fallback content
- ✅ Service loop with graceful shutdown
- ✅ Comprehensive logging
- ✅ Unit tests for core modules
- ✅ TypeScript with strict typing

### Integration Points (Stubbed) ⏳
The following methods have integration points ready for actual AI services:
- ⏳ Music generation (`generateMusicTrack`) - calls to text-to-music API
- ⏳ Script generation (`generateCommentary`) - calls to LLM for scripts
- ⏳ TTS generation - calls to text-to-speech API
- ⏳ Audio file handling - actual audio processing and mixing

These integration points are stubbed with placeholder implementations that create test files. When ready to integrate real AI services, these methods can be updated to call the actual APIs from `web/lib/ai/` modules.

### Future Enhancements 🚀
- Playback engine integration (FFmpeg/GStreamer/Node playout)
- WebSocket server for live frontend updates
- Advanced crossfading between segments
- Backpressure handling for streaming
- Music/talk ratio enforcement per show
- Request prioritization algorithms
- Analytics and usage tracking

## Future Implementation

The following methods need AI integration:

### `normalizeRequestWithLLM(rawText: string)`

Call an LLM API to normalize user requests into proper music prompts:

```typescript
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [
    { role: "system", content: "You normalize music requests into lofi music generation prompts..." },
    { role: "user", content: rawText }
  ]
});
return response.choices[0].message.content;
```

### `generateMusic(prompt: string)`

Call a text-to-music API to generate lofi tracks:

```typescript
const audio = await musicGenAPI.generate({
  prompt: prompt,
  duration: 180,
  genre: "lofi"
});
return await saveAudioFile(audio);
```

### `generateCommentary(request, show)`

1. Generate script with LLM
2. Convert to audio with TTS
3. Return file path

```typescript
// Generate script
const script = await generatePresenterScript(request, show);

// Convert to audio
const audio = await ttsAPI.synthesize({
  text: script,
  voice: show.presenterVoiceId
});

return await saveAudioFile(audio);
```

## Production Deployment

In production, the scheduler should run as a long-running service:

### Using PM2

```bash
pm2 start index.ts --name lofield-scheduler --interpreter tsx
pm2 save
pm2 startup
```

### Using Systemd

Create `/etc/systemd/system/lofield-scheduler.service`:

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

Enable and start:
```bash
sudo systemctl enable lofield-scheduler
sudo systemctl start lofield-scheduler
```

### Using Docker

```dockerfile
FROM node:20-alpine

WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .

CMD ["npm", "start"]
```

## Monitoring

The scheduler logs important events:

- Queue status checks
- Content generation attempts
- Errors and failures

In production, pipe logs to a monitoring service:

```bash
pm2 start index.ts --name lofield-scheduler --log /var/log/lofield/scheduler.log
```

Or use structured logging with tools like Winston or Pino.

## Troubleshooting

### Database connection errors

Ensure `DATABASE_URL` is correct and PostgreSQL is running:

```bash
docker-compose up -d postgres
```

### Queue not generating content

Check the logs for errors. Ensure:
- Database has show and presenter data (run seed script)
- Audio storage path is writable
- API keys for AI services are configured (when implemented)

### Service crashes

The scheduler has graceful shutdown handlers for SIGINT and SIGTERM. Check logs to see why it exited.

---

*The scheduler: Keeping Lofield FM on the air, one segment at a time.*
