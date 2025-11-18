# Rate Limiting and CORS Implementation Summary

## Overview

This implementation adds comprehensive rate limiting and CORS (Cross-Origin Resource Sharing) protection to the Lofield FM API endpoints. The solution is designed to prevent abuse while maintaining ease of use and configuration flexibility.

## Key Features

### Rate Limiting
- **Algorithm**: Sliding window with per-IP, per-endpoint tracking
- **Storage**: In-memory Map (suitable for single-instance deployments)
- **Default Limit**: 5 requests per minute per IP address
- **Configurable**: Via `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX` environment variables
- **Response**: 429 Too Many Requests with retry information
- **Headers**: Includes `X-RateLimit-Limit`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`, and `Retry-After`

### CORS
- **Default Origin**: `http://localhost:3000` (development)
- **Configurable**: Via `ALLOWED_ORIGINS` environment variable (comma-separated list)
- **Preflight Support**: Properly handles OPTIONS requests
- **Response Headers**: Includes all standard CORS headers
- **Security**: Blocks unauthorized origins with 403 status for preflight requests

## Implementation Details

### Files Created

1. **`web/lib/rate-limit.ts`** (150 lines)
   - `rateLimit()`: Main middleware function
   - `getRateLimitHeaders()`: Helper to add rate limit info to responses
   - Automatic cleanup of expired entries (every 60 seconds)
   - IP detection from multiple header sources (x-forwarded-for, x-real-ip, cf-connecting-ip)

2. **`web/lib/cors.ts`** (120 lines)
   - `getCorsHeaders()`: Get CORS headers for a request
   - `handleCorsPreflightRequest()`: Handle OPTIONS requests
   - `addCorsHeaders()`: Add CORS headers to any response
   - Origin validation and whitelist checking

3. **Test Files** (3 files, 340 lines total)
   - `web/lib/__tests__/rate-limit.test.ts`: 11 tests covering all rate limiting scenarios
   - `web/lib/__tests__/cors.test.ts`: 11 tests covering all CORS scenarios
   - `web/lib/__tests__/integration-rate-limit-cors.test.ts`: 3 integration tests

4. **Documentation**
   - `web/RATE_LIMIT_CORS_VERIFICATION.md`: Manual testing guide with curl examples
   - Updated `BACKEND.md`: Security section with configuration guides
   - Updated `.env.example`: New environment variables with examples

### Files Modified

1. **`web/app/api/requests/route.ts`**
   - Added rate limiting to POST endpoint
   - Added CORS headers to all responses (GET, POST, OPTIONS)
   - Added OPTIONS handler for preflight requests

2. **`web/app/api/requests/[id]/vote/route.ts`**
   - Added rate limiting to POST endpoint
   - Added CORS headers to all responses
   - Added OPTIONS handler for preflight requests

## Configuration Examples

### Development
```bash
RATE_LIMIT_WINDOW_MS=60000        # 1 minute
RATE_LIMIT_MAX=100                # 100 requests (lenient for testing)
ALLOWED_ORIGINS=http://localhost:3000
```

### Production
```bash
RATE_LIMIT_WINDOW_MS=60000        # 1 minute
RATE_LIMIT_MAX=5                  # 5 requests (strict)
ALLOWED_ORIGINS=https://lofield.fm,https://www.lofield.fm
```

### High-Traffic Production
```bash
RATE_LIMIT_WINDOW_MS=300000       # 5 minutes
RATE_LIMIT_MAX=25                 # 25 requests per 5 minutes
ALLOWED_ORIGINS=https://lofield.fm,https://www.lofield.fm,https://lofield-preview.vercel.app
```

## Testing

All tests pass successfully:
- **Unit Tests**: 22 new tests for rate limiting and CORS
- **Integration Tests**: 3 tests demonstrating real-world scenarios
- **Existing Tests**: Updated to mock rate limiting and CORS
- **Total**: 341 tests passing

## Security Considerations

### What This Implementation Provides
✅ Protection against spam and abuse  
✅ Per-IP rate limiting to prevent single-source attacks  
✅ Per-endpoint limits to isolate different API functions  
✅ CORS protection against unauthorized cross-origin requests  
✅ Clear error messages with retry guidance  
✅ Configurable limits for different environments  

### What This Implementation Does NOT Provide
❌ Distributed rate limiting (only works on single server)  
❌ User-based rate limiting (only IP-based)  
❌ DDoS protection (should be handled at infrastructure level)  
❌ Authentication/authorization (separate concern)  

### Production Recommendations

For production deployments:

1. **Consider Redis for Rate Limiting**
   - Current implementation uses in-memory storage
   - For multi-instance deployments, use Redis with `@upstash/ratelimit`
   - This ensures rate limits work across all server instances

2. **Use a CDN/WAF**
   - CloudFlare, AWS WAF, or similar for DDoS protection
   - These provide distributed rate limiting at the edge
   - Additional layer of security before requests reach your API

3. **Monitor Rate Limit Metrics**
   - Log 429 responses to detect potential attacks
   - Track rate limit headers to understand usage patterns
   - Alert on unusual rate limit violations

4. **Adjust Limits Based on Usage**
   - Start conservative (5 requests/min)
   - Monitor real user behavior
   - Adjust up if legitimate users are being blocked

## API Response Examples

### Successful Request with Rate Limit Headers
```json
HTTP/1.1 201 Created
Content-Type: application/json
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 4
X-RateLimit-Reset: 2024-11-18T18:30:00.000Z
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true

{
  "id": "clh1234567890abcdefgh",
  "type": "music",
  "rawText": "Chill lofi beats",
  "status": "pending",
  ...
}
```

### Rate Limit Exceeded
```json
HTTP/1.1 429 Too Many Requests
Content-Type: application/json
Retry-After: 45
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 2024-11-18T18:30:00.000Z
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Credentials: true

{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again in 45 seconds.",
  "retryAfter": 45
}
```

### CORS Preflight Response
```http
HTTP/1.1 204 No Content
Access-Control-Allow-Origin: http://localhost:3000
Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With
Access-Control-Max-Age: 86400
Access-Control-Allow-Credentials: true
```

## Future Enhancements

Potential improvements for future iterations:

1. **Redis Integration**
   - Replace in-memory storage with Redis
   - Enable distributed rate limiting across multiple servers
   - Add persistence for rate limit state

2. **User-Based Rate Limiting**
   - Add higher limits for authenticated users
   - Implement tiered rate limits (free vs. premium)
   - Track limits by user ID instead of just IP

3. **Dynamic Rate Limiting**
   - Adjust limits based on system load
   - Implement exponential backoff for repeat offenders
   - Whitelist trusted IPs or user agents

4. **Advanced CORS Configuration**
   - Per-endpoint CORS policies
   - Dynamic origin validation (regex patterns)
   - Credential-less mode for public endpoints

5. **Monitoring and Analytics**
   - Rate limit violation logging
   - Prometheus metrics integration
   - Dashboard for real-time monitoring

## Conclusion

This implementation provides a solid foundation for API security with:
- ✅ Simple configuration via environment variables
- ✅ Comprehensive test coverage
- ✅ Production-ready code with proper error handling
- ✅ Clear documentation for developers and operators
- ✅ Minimal performance impact (in-memory storage)
- ✅ Easy to extend for future needs

The rate limiting and CORS policies significantly improve the security posture of the Lofield FM API while maintaining a good developer experience.
