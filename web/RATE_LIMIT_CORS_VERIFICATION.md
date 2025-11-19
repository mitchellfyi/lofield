# Rate Limiting and CORS - Manual Verification Guide

This guide provides instructions for manually verifying that rate limiting and CORS are working correctly.

## Prerequisites

1. Start the development server:

   ```bash
   cd web
   npm run dev
   ```

2. The server should be running at `http://localhost:3000`

## Testing Rate Limiting

### Test 1: Verify rate limiting on POST /api/requests

By default, the rate limit is 5 requests per minute per IP. You can test this using curl:

```bash
# Set custom rate limits for easier testing (optional)
export RATE_LIMIT_WINDOW_MS=60000  # 1 minute
export RATE_LIMIT_MAX=3            # 3 requests max

# Make several requests in quick succession
for i in {1..5}; do
  echo "Request $i:"
  curl -X POST http://localhost:3000/api/requests \
    -H "Content-Type: application/json" \
    -d '{"type": "music", "text": "Test rate limiting request number '$i'"}' \
    -w "\nStatus: %{http_code}\n" \
    -v 2>&1 | grep -E "Status:|X-RateLimit|Too many requests"
  echo "---"
done
```

**Expected behavior:**

- First 3 requests: Status 201 or 403 (depending on moderation)
- Requests 4-5: Status 429 with "Too many requests" error
- Response headers include:
  - `X-RateLimit-Limit: 3`
  - `X-RateLimit-Remaining: 2` (decreases with each request)
  - `Retry-After: <seconds>`

### Test 2: Verify rate limiting on POST /api/requests/{id}/vote

```bash
# Replace with an actual request ID from your database
REQUEST_ID="clh1234567890abcdefgh"

for i in {1..5}; do
  echo "Vote $i:"
  curl -X POST http://localhost:3000/api/requests/$REQUEST_ID/vote \
    -w "\nStatus: %{http_code}\n" \
    -v 2>&1 | grep -E "Status:|X-RateLimit|Too many requests"
  echo "---"
done
```

**Expected behavior:**

- First 3 requests: Status 200 (success) or 404 (not found)
- Requests 4-5: Status 429 with rate limit error

### Test 3: Verify rate limits are per-endpoint

```bash
# After hitting rate limit on /api/requests, try voting
# This should work because each endpoint has its own limit

# Hit the limit on /api/requests
for i in {1..4}; do
  curl -X POST http://localhost:3000/api/requests \
    -H "Content-Type: application/json" \
    -d '{"type": "music", "text": "Test request '$i'"}' \
    -s -o /dev/null
done

# Now try voting - this should still work
curl -X POST http://localhost:3000/api/requests/clh1234567890abcdefgh/vote \
  -w "\nStatus: %{http_code}\n"
```

**Expected behavior:**

- Vote request succeeds (status 200 or 404) even though /api/requests is rate limited

## Testing CORS

### Test 1: Verify CORS headers are returned

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -H "Origin: http://localhost:3000" \
  -d '{"type": "music", "text": "Test CORS"}' \
  -v 2>&1 | grep -i "access-control"
```

**Expected output:**

```
< Access-Control-Allow-Origin: http://localhost:3000
< Access-Control-Allow-Credentials: true
```

### Test 2: Verify preflight (OPTIONS) requests work

```bash
curl -X OPTIONS http://localhost:3000/api/requests \
  -H "Origin: http://localhost:3000" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type" \
  -v 2>&1 | grep -E "HTTP/|Access-Control"
```

**Expected output:**

```
< HTTP/1.1 204 No Content
< Access-Control-Allow-Origin: http://localhost:3000
< Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
< Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
< Access-Control-Max-Age: 86400
```

### Test 3: Verify disallowed origins are blocked (in preflight)

First, set a specific allowed origin:

```bash
export ALLOWED_ORIGINS=https://lofield.fm

# Restart your dev server to pick up the new env var
```

Then test with a disallowed origin:

```bash
curl -X OPTIONS http://localhost:3000/api/requests \
  -H "Origin: https://evil.com" \
  -w "\nStatus: %{http_code}\n" \
  -v 2>&1 | grep -E "Status:|Access-Control"
```

**Expected output:**

```
Status: 403
(No Access-Control headers)
```

## Viewing Rate Limit Information

All successful and rate-limited responses include rate limit headers:

```bash
curl -X POST http://localhost:3000/api/requests \
  -H "Content-Type: application/json" \
  -d '{"type": "music", "text": "Test"}' \
  -I | grep X-RateLimit
```

**Expected headers:**

```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 2024-11-18T18:30:00.000Z
```

## Environment Configuration

### Development (Lenient)

```bash
export RATE_LIMIT_WINDOW_MS=60000  # 1 minute
export RATE_LIMIT_MAX=100          # 100 requests
export ALLOWED_ORIGINS=http://localhost:3000
```

### Production (Strict)

```bash
export RATE_LIMIT_WINDOW_MS=60000  # 1 minute
export RATE_LIMIT_MAX=5            # 5 requests
export ALLOWED_ORIGINS=https://lofield.fm,https://www.lofield.fm
```

## Troubleshooting

### Rate limiting not working

- Check that environment variables are set correctly
- Verify the IP address is being detected (check `x-forwarded-for` header)
- Remember that rate limits are per-IP per-endpoint

### CORS headers not appearing

- Check that the `ALLOWED_ORIGINS` environment variable is set
- Verify the `Origin` header is being sent in the request
- Check server logs for any errors

### 429 errors happening too quickly

- Increase `RATE_LIMIT_MAX` for development
- Clear your browser cache or use a different IP address
- Wait for the rate limit window to expire (default: 1 minute)

## Summary

The rate limiting and CORS implementation provides:

- ✅ Protection against API abuse (5 requests/min default)
- ✅ Configurable limits per environment
- ✅ Per-IP, per-endpoint tracking
- ✅ Proper CORS headers for cross-origin requests
- ✅ Preflight request handling
- ✅ Clear error messages with retry information
- ✅ Rate limit information in response headers
