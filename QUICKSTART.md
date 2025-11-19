# Lofield FM Quick Start

Spin up the full stack (web app, scheduler, playout, Icecast, and PostgreSQL) entirely through Docker Compose and the repo’s Makefile helpers.

## TL;DR
```bash
git clone https://github.com/mitchellfyi/lofield.git
cd lofield
make setup          # copies .env.docker -> .env and syncs service env files
# edit .env with real passwords + API keys
make dev            # start every container
make migrate        # run Prisma migrations
make seed           # seed the database
```

## 0. Prerequisites
- Docker Desktop 4.7+ (or Docker Engine 20.10+) with Compose v2
- GNU Make 3.8+
- Git
- API keys for OpenAI + Replicate (optional: ElevenLabs, Stability)

## 1. Clone the repo
```bash
git clone https://github.com/mitchellfyi/lofield.git
cd lofield
```

## 2. Configure environment variables
```bash
make setup
```

`make setup` copies `.env.docker → .env` (if needed) and duplicates the root `.env` into `web/.env`, `web/.env.local`, `services/scheduler/.env`, and `services/playout/.env`. Edit `.env` once and set at least:

| Variable | Why it matters |
| --- | --- |
| `POSTGRES_PASSWORD` | Database password shared by all services |
| `ICECAST_SOURCE_PASSWORD`, `ICECAST_ADMIN_PASSWORD`, `ICECAST_RELAY_PASSWORD` | Icecast authentication (source + admin + relays) |
| `OPENAI_API_KEY` | Script/TTS generation + moderation |
| `REPLICATE_API_TOKEN` | Music generation via MusicGen |

Whenever you update `.env`, run `make env-sync` so every service picks up the change.

## 3. Start the Docker stack
```bash
make dev
```

This command builds (if necessary) and runs:
- PostgreSQL (`localhost:5432`)
- Icecast (`localhost:8000`)
- Next.js web app (`localhost:3000`)
- Scheduler and playout services

Need live reload + local volume mounts? Use `make dev-hot` to include `docker-compose.dev.yml`.

## 4. Initialize the database
```bash
make migrate
make seed
```

Both commands execute inside the `web` container, so you never need a local Node/Prisma toolchain.

## 5. Verify everything

| Component | URL | Notes |
| --- | --- | --- |
| Web UI & API | http://localhost:3000 | Frontend, Prisma-backed API routes |
| Health check | http://localhost:3000/api/health | Should return `{ "status": "ok" }` |
| SSE stream | http://localhost:3000/api/events | Firehose of queue + request events |
| Live audio | http://localhost:8000/lofield | Icecast MP3 mount |
| Icecast admin | http://localhost:8000/admin/ | User `admin`, password from `ICECAST_ADMIN_PASSWORD` |

## 6. Smoke-test the API
```bash
# list requests
curl http://localhost:3000/api/requests

# submit a request
curl -X POST http://localhost:3000/api/requests \
  -H 'Content-Type: application/json' \
  -d '{"type":"music","text":"Calm evening vibes with gentle piano"}'

# vote on a request (replace <id>)
curl -X POST http://localhost:3000/api/requests/<id>/vote

# check queue + now playing
curl http://localhost:3000/api/queue
curl http://localhost:3000/api/now-playing
```

## 7. Helpful Makefile targets

| Target | Description |
| --- | --- |
| `make setup` | Copy `.env.docker → .env` + sync service env files |
| `make env-sync` | Re-copy the root `.env` without rebuilding containers |
| `make dev` / `make dev-hot` | Run the full stack (optionally with hot reload mounts) |
| `make stop` | Stop containers but keep volumes |
| `make clean` | Stop containers and remove volumes (wipes DB/audio/cache) |
| `make logs` | Follow all container logs (`docker compose logs -f`) |
| `make status` | Show container status and port mappings |
| `make migrate` | Run `npx prisma migrate deploy` inside the web container |
| `make seed` | Run `npx tsx prisma/seed/seed.ts` inside the web container |
| `make studio` | Launch Prisma Studio inside the web container |
| `make db-shell` | Open `psql` inside the postgres container |

## 8. Stopping & cleanup
```bash
# stop containers, keep volumes
make stop

# stop containers and remove postgres/audio/cache volumes
make clean
```

## Troubleshooting

### “Missing environment variable” on startup
- Ensure `.env` exists and contains the required values
- Run `make env-sync` so every service sees the same `.env`

### Database connection errors (`PrismaClientInitializationError`)
```bash
make status             # postgres should be "running"
docker compose logs postgres
```
Verify that `POSTGRES_PASSWORD` in `.env` matches the auto-generated `DATABASE_URL` used inside Docker.

### Ports already in use
- Change the published port in `docker-compose.yml` (e.g., `3000:3000` → `3001:3000`)
- Or stop the conflicting local service

### Scheduler or playout logs missing
```bash
make logs | grep scheduler
make logs | grep playout
```

### Prisma client not found (when running `npm` outside Docker)
All migrations/seeds run inside containers. If you *must* run Prisma locally, execute `npm install && npx prisma generate` inside `web/` first.

## Optional: manual service hacking
Prefer raw Node processes for debugging?
1. Keep Docker running for stateful dependencies: `docker compose up -d postgres icecast`
2. Sync env files after editing `.env`: `make env-sync`
3. Start the service you care about, e.g.:
   ```bash
   cd web && npm run dev
   # or
   cd services/scheduler && npm run dev
   ```

## Getting help
- Main [README](README.md) for the big picture
- [BACKEND.md](BACKEND.md) for architecture details
- [DOCKER.md](DOCKER.md) for advanced Compose usage
- Open an issue on GitHub if you’re stuck

---
*Happy coding! The station is almost on air.*
