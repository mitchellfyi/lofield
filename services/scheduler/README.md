# Lofield FM Scheduler Service

The scheduler service is responsible for maintaining the 24/7 broadcast queue by generating content ahead of time.

## Responsibilities

1. **Queue Monitoring**: Continuously monitors the queue to ensure sufficient buffer
2. **Content Generation**: Generates music tracks and presenter segments using AI
3. **Database Management**: Creates segments and tracks in the database
4. **Playlog Recording**: Records when content is broadcast

## Architecture

The scheduler operates on a simple loop:

```
┌─────────────────────────────────────────┐
│ 1. Check queue length                   │
│ 2. If queue < 50% of buffer, generate   │
│ 3. Fetch top-voted requests             │
│ 4. Generate content (stubbed for now)   │
│ 5. Insert into database                 │
│ 6. Wait for next check interval         │
└─────────────────────────────────────────┘
```

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

- **`SCHEDULER_CHECK_INTERVAL`** (optional): How often to check the queue (in seconds)
  - Default: `60` seconds
  - Valid range: Any positive integer (recommended: 30-120)
  - Lower values check more frequently but use more resources

- **`AUDIO_STORAGE_PATH`** (optional): Directory for generated audio files
  - Default: `/tmp/lofield/audio`
  - Must be a writable directory path
  - Will be created automatically if it doesn't exist

**Future AI Integration Variables** (not yet implemented):
- `OPENAI_API_KEY`: For LLM-based content generation
- `ELEVENLABS_API_KEY`: For text-to-speech
- `STABILITY_AI_API_KEY`: For text-to-music generation

See `.env.example` for a template with all available variables.

## Current Status

This is a **skeleton implementation** with stubbed AI integration points:

- ✅ Queue monitoring
- ✅ Database queries for shows and requests
- ✅ Service loop and graceful shutdown
- ⏳ LLM integration for prompt normalization (stubbed)
- ⏳ Text-to-music AI integration (stubbed)
- ⏳ TTS integration for presenter commentary (stubbed)
- ⏳ Audio file generation and storage (stubbed)
- ⏳ Segment creation in database (stubbed)

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
