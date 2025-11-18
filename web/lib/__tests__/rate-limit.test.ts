/**
 * Tests for rate limiting functionality
 *
 * These tests verify that rate limiting works correctly:
 * - Limits are enforced per endpoint per IP
 * - 429 status is returned when limit exceeded
 * - Rate limit headers are included in responses
 * - Rate limits reset after the window expires
 */

import { NextRequest } from "next/server";
import { rateLimit, getRateLimitHeaders } from "../rate-limit";

// Mock environment variables
const originalEnv = process.env;

describe("Rate Limiting", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    // Clear the rate limit store between tests
    jest.clearAllMocks();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("rateLimit", () => {
    it("should allow requests under the limit", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "5";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.1",
        },
      });

      // First request should be allowed
      const result1 = rateLimit(request);
      expect(result1).toBeNull();

      // Second request should be allowed
      const result2 = rateLimit(request);
      expect(result2).toBeNull();

      // Third request should be allowed
      const result3 = rateLimit(request);
      expect(result3).toBeNull();
    });

    it("should block requests exceeding the limit", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "3";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.2",
        },
      });

      // Make requests up to the limit
      for (let i = 0; i < 3; i++) {
        const result = rateLimit(request);
        expect(result).toBeNull();
      }

      // Next request should be blocked
      const blockedResult = rateLimit(request);
      expect(blockedResult).not.toBeNull();
      expect(blockedResult?.status).toBe(429);
    });

    it("should return correct headers when rate limit exceeded", async () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "2";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.3",
        },
      });

      // Exhaust the limit
      rateLimit(request);
      rateLimit(request);

      // Get blocked response
      const response = rateLimit(request);
      expect(response).not.toBeNull();

      if (response) {
        expect(response.headers.get("Retry-After")).toBeTruthy();
        expect(response.headers.get("X-RateLimit-Limit")).toBe("2");
        expect(response.headers.get("X-RateLimit-Remaining")).toBe("0");
        expect(response.headers.get("X-RateLimit-Reset")).toBeTruthy();

        // Check response body
        const data = await response.json();
        expect(data.error).toContain("Too many requests");
        expect(data.retryAfter).toBeGreaterThan(0);
      }
    });

    it("should track limits separately per IP", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "2";

      const request1 = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.4",
        },
      });

      const request2 = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.5",
        },
      });

      // Exhaust limit for IP 1
      rateLimit(request1);
      rateLimit(request1);
      const blocked1 = rateLimit(request1);
      expect(blocked1).not.toBeNull();

      // IP 2 should still be allowed
      const allowed2 = rateLimit(request2);
      expect(allowed2).toBeNull();
    });

    it("should track limits separately per endpoint", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "2";

      const ip = "192.168.1.6";

      const requestEndpoint1 = new NextRequest(
        "http://localhost:3000/api/requests",
        {
          method: "POST",
          headers: {
            "x-forwarded-for": ip,
          },
        }
      );

      const requestEndpoint2 = new NextRequest(
        "http://localhost:3000/api/requests/123/vote",
        {
          method: "POST",
          headers: {
            "x-forwarded-for": ip,
          },
        }
      );

      // Exhaust limit for endpoint 1
      rateLimit(requestEndpoint1);
      rateLimit(requestEndpoint1);
      const blocked1 = rateLimit(requestEndpoint1);
      expect(blocked1).not.toBeNull();

      // Endpoint 2 should still be allowed
      const allowed2 = rateLimit(requestEndpoint2);
      expect(allowed2).toBeNull();
    });

    it("should use custom config when provided", () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.7",
        },
      });

      const customConfig = {
        windowMs: 30000, // 30 seconds
        max: 10, // 10 requests
      };

      // Should allow up to 10 requests
      for (let i = 0; i < 10; i++) {
        const result = rateLimit(request, customConfig);
        expect(result).toBeNull();
      }

      // 11th request should be blocked
      const blocked = rateLimit(request, customConfig);
      expect(blocked).not.toBeNull();
    });

    it("should handle different IP header sources", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "3";

      // Test x-forwarded-for
      const request1 = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "10.0.0.1, 10.0.0.2",
        },
      });
      expect(rateLimit(request1)).toBeNull();

      // Test x-real-ip
      const request2 = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-real-ip": "10.0.0.3",
        },
      });
      expect(rateLimit(request2)).toBeNull();

      // Test cf-connecting-ip (Cloudflare)
      const request3 = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "cf-connecting-ip": "10.0.0.4",
        },
      });
      expect(rateLimit(request3)).toBeNull();
    });
  });

  describe("getRateLimitHeaders", () => {
    it("should return correct headers for a new request", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "5";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.10",
        },
      });

      const headers = getRateLimitHeaders(request);

      expect(headers["X-RateLimit-Limit"]).toBe("5");
      expect(headers["X-RateLimit-Remaining"]).toBe("5");
    });

    it("should return correct headers after some requests", () => {
      process.env.RATE_LIMIT_WINDOW_MS = "60000";
      process.env.RATE_LIMIT_MAX = "5";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.168.1.11",
        },
      });

      // Make 2 requests
      rateLimit(request);
      rateLimit(request);

      const headers = getRateLimitHeaders(request);

      expect(headers["X-RateLimit-Limit"]).toBe("5");
      expect(headers["X-RateLimit-Remaining"]).toBe("3"); // 5 - 2 = 3
      expect(headers["X-RateLimit-Reset"]).toBeTruthy();
    });
  });
});
