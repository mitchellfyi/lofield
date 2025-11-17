# Lofield FM Backend Quick Start Guide

This guide will help you get the Lofield FM backend running locally in just a few minutes.

## Prerequisites

- Node.js 20+ installed
- Docker and Docker Compose installed (recommended)
- Git

## Step-by-Step Setup

### 1. Clone and Navigate

```bash
git clone https://github.com/mitchellfyi/lofield.git
cd lofield
```

### 2. Configure Secure Credentials

**IMPORTANT**: Set up secure credentials before starting services.

```bash
# Copy environment variable templates
cp .env.example .env
cd web
cp .env.example .env
cd ..
```

**Edit both `.env` files** and replace all `CHANGE_ME_*` placeholders with secure passwords:

- **Root `.env`**: Contains credentials for Docker services (PostgreSQL, Icecast)
- **`web/.env`**: Contains credentials for the Next.js application

**For development**, you can use simple passwords like:
```bash
# In root .env
POSTGRES_PASSWORD=dev_password_123
ICECAST_SOURCE_PASSWORD=dev_source_123
ICECAST_RELAY_PASSWORD=dev_relay_123
ICECAST_ADMIN_PASSWORD=dev_admin_123
```

**For production**, generate strong passwords:
```bash
# Generate secure random passwords
openssl rand -base64 32
```

⚠️ **Security Warning**: Never commit `.env` files or use default/example passwords in production!

### 3. Start the Database

Using Docker Compose (easiest):

```bash
docker-compose up -d
```

This starts:
- PostgreSQL on `localhost:5432`
- Icecast streaming server on `localhost:8000`

**Note**: Docker Compose will now require the `.env` file to be configured. If you see errors about missing environment variables, make sure you completed step 2.

**Alternative:** If you have PostgreSQL installed locally, skip this step and update the `DATABASE_URL` in `web/.env` with your local database credentials.

### 3. Install Dependencies

```bash
cd web
npm install
```

### 4. Configure Environment

The `.env` files were already created in step 2. Verify that:
- Root `.env` has secure passwords for POSTGRES_PASSWORD and ICECAST_* variables
- `web/.env` has a DATABASE_URL with the same POSTGRES_PASSWORD you set in root `.env`
- `web/.env` has ICECAST_SOURCE_PASSWORD and ICECAST_ADMIN_PASSWORD matching root `.env`

If using local PostgreSQL instead of Docker, edit `web/.env` and update `DATABASE_URL` to point to your local instance.

### 5. Set Up Database

```bash
# Generate Prisma client
npx prisma generate

# Run migrations to create tables
npx prisma migrate dev --name init

# Seed with initial data
npx tsx prisma/seed/seed.ts
```

### 6. Start the API Server

```bash
npm run dev
```

The server will start at `http://localhost:3000`

### 7. Test the API

Open a new terminal and try these commands:

**Get all requests:**
```bash
curl http://localhost:3000/api/requests
```

**Submit a new request:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "music", "text": "Calm evening vibes with gentle piano"}'
```

**Upvote a request (replace {id} with an actual ID from the first request):**
```bash
curl -X POST http://localhost:3000/api/requests/{id}/vote
```

**Check now playing (will return 404 until segments are created):**
```bash
curl http://localhost:3000/api/now-playing
```

**View queue:**
```bash
curl http://localhost:3000/api/queue
```

### 8. (Optional) Start the Scheduler

In a new terminal:

```bash
cd services/scheduler

# Install dependencies (if not already done)
npm install

# Configure environment
cp .env.example .env
# Edit .env and set DATABASE_URL to match your web/.env

# Start the scheduler
npm start
```

The scheduler will monitor the queue and log its activity. Currently, it's a skeleton that monitors but doesn't generate content yet (AI integration pending).

**Configuration**: The scheduler can be configured via environment variables in `services/scheduler/.env`:
- `SCHEDULER_BUFFER_MINUTES`: How far ahead to maintain the queue (default: 45 minutes)
- `SCHEDULER_CHECK_INTERVAL`: How often to check the queue (default: 60 seconds)
- `AUDIO_STORAGE_PATH`: Where to store generated audio files (default: /tmp/lofield/audio)

### 9. (Optional) View Database

To see the data in a nice UI:

```bash
cd web
npx prisma studio
```

This opens a web interface at `http://localhost:5555` where you can browse and edit database records.

## What's Working

✅ **API Endpoints:**
- Submit and list requests
- Upvote requests
- Real-time updates via Server-Sent Events
- Queue and archive endpoints

✅ **Database:**
- PostgreSQL with all tables created
- Sample data seeded
- ORM queries working

✅ **Scheduler Service:**
- Queue monitoring
- Database integration

⏳ **Not Yet Implemented:**
- AI content generation (LLM, text-to-music, TTS)
- Actual audio file generation
- Streaming to Icecast
- User authentication

## Troubleshooting

### Database connection error

If you get `PrismaClientInitializationError`:

1. Make sure Docker Compose is running: `docker-compose ps`
2. Check database is accessible: `docker-compose logs postgres`
3. Verify `DATABASE_URL` in `.env`

### Port already in use

If port 3000 or 5432 is already in use:

- For port 3000: Use `PORT=3001 npm run dev`
- For port 5432: Stop other PostgreSQL instances or change port in `docker-compose.yml`

### Prisma client not found

Run:
```bash
npx prisma generate
```

## Next Steps

- Read [BACKEND.md](../BACKEND.md) for comprehensive documentation
- Explore the API endpoints in the browser at `http://localhost:3000`
- Check out the Icecast admin UI at `http://localhost:8000/admin/` (username: `admin`, password: the value you set for `ICECAST_ADMIN_PASSWORD` in your `.env` file)
- Review the scheduler code in `services/scheduler/index.ts` to see where AI integration will happen

## Stopping Everything

```bash
# Stop the dev server (Ctrl+C in the terminal)

# Stop Docker services
docker-compose down

# To completely remove data volumes:
docker-compose down -v
```

## Getting Help

- Check the [main README](../README.md)
- Review [architecture documentation](../docs/architecture.md)
- Read the comprehensive [BACKEND.md](../BACKEND.md)
- Open an issue on GitHub

---

*Happy coding! The station will be on the air soon.*
