/**
 * Rate Limiting Middleware
 *
 * Provides rate limiting functionality for API routes using an in-memory LRU cache.
 * This implementation uses a sliding window algorithm to track request counts.
 */

import { NextRequest, NextResponse } from "next/server";

interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  max: number; // Maximum number of requests per window
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

// In-memory store for rate limit tracking
// In production, consider using Redis or a distributed cache
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries periodically to prevent memory leaks
const CLEANUP_INTERVAL = 60000; // 1 minute
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetTime < now) {
      rateLimitStore.delete(key);
    }
  }
}, CLEANUP_INTERVAL);

// Allow cleanup interval to be stopped (useful for testing)
if (cleanupInterval.unref) {
  cleanupInterval.unref();
}

/**
 * Get client identifier from request
 * Uses IP address if available, otherwise falls back to a generic identifier
 */
function getClientIdentifier(request: NextRequest): string {
  // Try to get IP from various headers (in order of preference)
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (forwardedFor) {
    // x-forwarded-for can contain multiple IPs, take the first one
    return forwardedFor.split(",")[0].trim();
  }

  if (realIp) {
    return realIp;
  }

  if (cfConnectingIp) {
    return cfConnectingIp;
  }

  // Fallback to a generic identifier (not ideal for rate limiting)
  return "unknown";
}

/**
 * Apply rate limiting to a request
 * Returns null if the request is allowed, or a NextResponse with 429 status if rate limited
 */
export function rateLimit(
  request: NextRequest,
  config?: RateLimitConfig
): NextResponse | null {
  // Get configuration from environment variables or use defaults
  const windowMs =
    config?.windowMs ||
    parseInt(process.env.RATE_LIMIT_WINDOW_MS || "60000", 10);
  const max = config?.max || parseInt(process.env.RATE_LIMIT_MAX || "5", 10);

  const identifier = getClientIdentifier(request);
  const key = `${request.nextUrl.pathname}:${identifier}`;
  const now = Date.now();

  // Get or create rate limit entry
  let entry = rateLimitStore.get(key);

  if (!entry || entry.resetTime < now) {
    // Create new entry or reset expired entry
    entry = {
      count: 1,
      resetTime: now + windowMs,
    };
    rateLimitStore.set(key, entry);
    return null; // Request allowed
  }

  // Increment count
  entry.count += 1;

  // Check if limit exceeded
  if (entry.count > max) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000); // Convert to seconds

    return NextResponse.json(
      {
        error: "Too many requests",
        message: `Rate limit exceeded. Please try again in ${retryAfter} seconds.`,
        retryAfter,
      },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Limit": max.toString(),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
        },
      }
    );
  }

  // Request allowed, but update remaining count
  return null;
}

/**
 * Get rate limit headers for a successful request
 * This can be used to add rate limit information to successful responses
 */
export function getRateLimitHeaders(
  request: NextRequest,
  config?: RateLimitConfig
): Record<string, string> {
  const max = config?.max || parseInt(process.env.RATE_LIMIT_MAX || "5", 10);

  const identifier = getClientIdentifier(request);
  const key = `${request.nextUrl.pathname}:${identifier}`;
  const entry = rateLimitStore.get(key);

  if (!entry) {
    return {
      "X-RateLimit-Limit": max.toString(),
      "X-RateLimit-Remaining": max.toString(),
    };
  }

  const remaining = Math.max(0, max - entry.count);

  return {
    "X-RateLimit-Limit": max.toString(),
    "X-RateLimit-Remaining": remaining.toString(),
    "X-RateLimit-Reset": new Date(entry.resetTime).toISOString(),
  };
}
