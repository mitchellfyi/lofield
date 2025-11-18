/**
 * CORS Middleware
 *
 * Provides CORS (Cross-Origin Resource Sharing) functionality for API routes.
 * Restricts API access to trusted origins only.
 */

import { NextRequest, NextResponse } from "next/server";

/**
 * Get allowed origins from environment variable
 * Returns an array of allowed origin URLs
 */
function getAllowedOrigins(): string[] {
  const allowedOriginsEnv = process.env.ALLOWED_ORIGINS || "";

  if (!allowedOriginsEnv) {
    // Default to localhost for development
    return ["http://localhost:3000"];
  }

  // Parse comma-separated list and trim whitespace
  return allowedOriginsEnv.split(",").map((origin) => origin.trim());
}

/**
 * Check if an origin is allowed
 */
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) {
    // Allow requests with no origin header (same-origin requests)
    return true;
  }

  const allowedOrigins = getAllowedOrigins();

  // Check for wildcard
  if (allowedOrigins.includes("*")) {
    return true;
  }

  // Check if origin matches any allowed origin
  return allowedOrigins.includes(origin);
}

/**
 * Get CORS headers for a response
 * This handles the actual CORS headers based on the request origin
 */
export function getCorsHeaders(request: NextRequest): Record<string, string> {
  const origin = request.headers.get("origin");
  const headers: Record<string, string> = {};

  if (isOriginAllowed(origin)) {
    // Set the origin to the requesting origin (more secure than *)
    if (origin) {
      headers["Access-Control-Allow-Origin"] = origin;
    } else {
      // For same-origin requests, we can skip this header
      // or set it to the first allowed origin
      const allowedOrigins = getAllowedOrigins();
      if (allowedOrigins.length > 0 && allowedOrigins[0] !== "*") {
        headers["Access-Control-Allow-Origin"] = allowedOrigins[0];
      }
    }

    headers["Access-Control-Allow-Credentials"] = "true";
    headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS";
    headers["Access-Control-Allow-Headers"] =
      "Content-Type, Authorization, X-Requested-With";
    headers["Access-Control-Max-Age"] = "86400"; // 24 hours
  }

  return headers;
}

/**
 * Handle CORS preflight (OPTIONS) requests
 * Returns a Response for OPTIONS requests, or null if not an OPTIONS request
 */
export function handleCorsPreflightRequest(
  request: NextRequest
): NextResponse | null {
  if (request.method !== "OPTIONS") {
    return null;
  }

  const origin = request.headers.get("origin");

  if (!isOriginAllowed(origin)) {
    return new NextResponse(null, {
      status: 403,
      statusText: "Forbidden",
    });
  }

  const headers = getCorsHeaders(request);

  return new NextResponse(null, {
    status: 204,
    headers,
  });
}

/**
 * Add CORS headers to an existing response
 */
export function addCorsHeaders(
  response: NextResponse,
  request: NextRequest
): NextResponse {
  const corsHeaders = getCorsHeaders(request);

  for (const [key, value] of Object.entries(corsHeaders)) {
    response.headers.set(key, value);
  }

  return response;
}
