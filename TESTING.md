# Backend Testing Guide

This guide provides test cases and validation steps for the Lofield FM backend implementation.

## Prerequisites

Make sure you've completed the setup from [QUICKSTART.md](QUICKSTART.md):
- Docker Compose running (PostgreSQL + Icecast)
- Database migrated and seeded
- API server running on port 3000

## API Endpoint Testing

### 1. Requests API

#### List All Requests
```bash
curl http://localhost:3000/api/requests
```

**Expected Response:**
- HTTP 200
- JSON array with 5 seeded requests
- Each request has: `id`, `type`, `rawText`, `votes`, `status`, `moderationStatus`, `createdAt`

#### Filter by Status
```bash
curl "http://localhost:3000/api/requests?status=pending"
```

**Expected Response:**
- Only requests with `status: "pending"`

#### Submit a New Request
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{
    "type": "music",
    "text": "Sunset coding session with smooth jazz"
  }'
```

**Expected Response:**
- HTTP 201
- New request object with:
  - Generated `id`
  - `votes: 0`
  - `status: "pending"`
  - `moderationStatus: "pending"`
  - Current timestamp in `createdAt`

#### Validation Testing

**Missing fields:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "music"}'
```
Expected: HTTP 400, error message

**Text too short:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "music", "text": "short"}'
```
Expected: HTTP 400, error about minimum length

**Invalid type:**
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "invalid", "text": "This should fail"}'
```
Expected: HTTP 400, error about invalid type

### 2. Voting API

First, get a request ID:
```bash
REQUEST_ID=$(curl -s http://localhost:3000/api/requests | jq -r '.[0].id')
echo $REQUEST_ID
```

#### Upvote a Request
```bash
curl -X POST http://localhost:3000/api/requests/$REQUEST_ID/vote
```

**Expected Response:**
- HTTP 200
- `{ "success": true, "id": "...", "votes": <incremented> }`

#### Verify Vote Increment
```bash
curl -s http://localhost:3000/api/requests | jq ".[] | select(.id==\"$REQUEST_ID\")"
```

**Expected:** Vote count should be +1 from previous value

#### Vote on Non-Existent Request
```bash
curl -X POST http://localhost:3000/api/requests/invalid-id-12345/vote
```

**Expected Response:**
- HTTP 404
- Error message "Request not found"

### 3. Now Playing API

```bash
curl http://localhost:3000/api/now-playing
```

**Expected Response (No Segments Yet):**
- HTTP 404
- Error: "No segment currently playing"

**Note:** This endpoint will return data once segments are created by the scheduler or manually added to the database.

### 4. Queue API

```bash
curl http://localhost:3000/api/queue
```

**Expected Response (Empty Queue):**
```json
{
  "queueLength": 0,
  "minutesAhead": 60,
  "items": []
}
```

**With Custom Look-Ahead:**
```bash
curl "http://localhost:3000/api/queue?minutes=30"
```

**Expected:** Same structure with `minutesAhead: 30`

### 5. Archive API

```bash
curl http://localhost:3000/api/archive
```

**Expected Response:**
```json
{
  "total": 0,
  "segments": []
}
```

**With Date Filter:**
```bash
curl "http://localhost:3000/api/archive?start_time=2024-01-01T00:00:00Z&end_time=2024-12-31T23:59:59Z"
```

### 6. Real-Time Events (Server-Sent Events)

**Using curl (will stream indefinitely):**
```bash
curl -N http://localhost:3000/api/events
```

**Expected Output:**
```
event: connected
data: {"type":"connected","timestamp":"2024-01-15T10:00:00.000Z"}

event: now-playing
data: {...}
```

Press Ctrl+C to stop.

**Using JavaScript in Browser Console:**
```javascript
const eventSource = new EventSource('http://localhost:3000/api/events');

eventSource.addEventListener('connected', (e) => {
  console.log('Connected:', JSON.parse(e.data));
});

eventSource.addEventListener('now-playing', (e) => {
  console.log('Now Playing:', JSON.parse(e.data));
});
```

## Database Validation

### View Database Contents

```bash
cd web
npx prisma studio
```

Opens at `http://localhost:5555`

**Check:**
- ✓ Request table has 5 seeded records
- ✓ Show table has 8 shows
- ✓ Presenter table has 16 presenters
- ✓ All relationships are intact

### Manual Database Queries

**Connect to PostgreSQL:**
```bash
docker compose exec postgres psql -U lofield -d lofield_fm
```

**List all tables:**
```sql
\dt
```

Expected tables: Request, Track, Segment, Show, Presenter, Playlog, _prisma_migrations

**Count requests:**
```sql
SELECT COUNT(*) FROM "Request";
```
Expected: 5

**Show requests with highest votes:**
```sql
SELECT "rawText", votes FROM "Request" ORDER BY votes DESC LIMIT 3;
```

**List all shows:**
```sql
SELECT id, name, "startHour", "durationHours" FROM "Show";
```
Expected: 8 shows

**Exit psql:**
```
\q
```

## Scheduler Service Testing

### Start the Scheduler

In a new terminal:
```bash
cd services/scheduler
npm install
npm start
```

**Expected Output:**
```
Starting Lofield FM Scheduler Service...
Buffer: 45 minutes
Check interval: 60 seconds
Queue status: 0.0/45 minutes
Queue running low, generating new content...
Generating content for show: ...
Found 5 top requests to process
[STUB] Would process request: "..."
```

The scheduler will log every 60 seconds.

**Verification:**
- ✓ No crashes
- ✓ Connects to database successfully
- ✓ Logs queue status
- ✓ Identifies top requests
- ✓ Logs stub messages for content generation

**Stop with Ctrl+C:**
Should see graceful shutdown message.

## Performance Testing

### Load Testing (Optional)

Install Apache Bench:
```bash
# Ubuntu/Debian
sudo apt-get install apache2-utils

# macOS
brew install ab
```

**Test GET requests:**
```bash
ab -n 1000 -c 10 http://localhost:3000/api/requests
```

**Expected:**
- All requests succeed (200 OK)
- Mean response time < 50ms for local DB

**Test POST requests:**
```bash
ab -n 100 -c 5 -p /tmp/request.json -T application/json http://localhost:3000/api/requests
```

First create `/tmp/request.json`:
```json
{"type":"music","text":"Load test request for performance"}
```

## Integration Testing

### Full Workflow Test

**1. Submit multiple requests:**
```bash
for i in {1..5}; do
  curl -X POST http://localhost:3000/api/requests \
    -H "Content-Type: application/json" \
    -d "{\"type\":\"music\",\"text\":\"Test request $i with enough characters\"}"
  echo ""
done
```

**2. List and verify:**
```bash
curl http://localhost:3000/api/requests | jq 'length'
```
Expected: 10 (5 seeded + 5 new)

**3. Vote on top 3:**
```bash
curl -s http://localhost:3000/api/requests | jq -r '.[0:3] | .[].id' | while read id; do
  curl -X POST http://localhost:3000/api/requests/$id/vote
  echo ""
done
```

**4. Verify vote counts:**
```bash
curl -s http://localhost:3000/api/requests | jq '.[] | {text: .rawText, votes: .votes}' | head -20
```

## Error Handling Testing

### Invalid JSON
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d 'invalid json{'
```
Expected: HTTP 400

### Missing Content-Type
```bash
curl -X POST http://localhost:3000/api/requests \
  -d '{"type":"music","text":"Should fail"}'
```
Expected: HTTP 400

### Very Long Request Text
```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d "{\"type\":\"music\",\"text\":\"$(printf 'a%.0s' {1..10000})\"}"
```
Expected: HTTP 201 (no length limit currently, which is acceptable)

## Troubleshooting Failed Tests

### Database Connection Errors

**Check PostgreSQL is running:**
```bash
docker compose ps postgres
```

**View logs:**
```bash
docker compose logs postgres
```

**Restart PostgreSQL:**
```bash
docker compose restart postgres
```

### API Returns 500 Errors

**Check Next.js logs in the terminal running `npm run dev`**

Common issues:
- Prisma client not generated: Run `npx prisma generate`
- Migration not applied: Run `npx prisma migrate dev`

### Port Conflicts

If port 3000 is in use:
```bash
PORT=3001 npm run dev
```

Then update test URLs to use port 3001.

## Success Criteria

✅ All request operations work (GET, POST, vote)
✅ Validation correctly rejects invalid inputs
✅ SSE connection establishes and sends events
✅ Database operations complete successfully
✅ Scheduler runs without crashes
✅ No security vulnerabilities found
✅ Build and lint pass

---

*Testing complete? You're ready to start integrating AI services!*
