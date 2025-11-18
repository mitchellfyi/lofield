/**
 * Integration test for rate limiting and CORS
 *
 * This test demonstrates how rate limiting and CORS work in the API routes.
 * Run this manually to verify the implementation.
 */

import { NextRequest } from "next/server";
import { POST } from "../../app/api/requests/route";
import { POST as voteOnRequest } from "../../app/api/requests/[id]/vote/route";

// This is a manual integration test - run with: npm test -- lib/__tests__/integration-rate-limit-cors.test.ts

describe("Rate Limiting and CORS Integration", () => {
  // Note: These tests use the actual rate limiting implementation (not mocked)

  it("should demonstrate rate limiting behavior", async () => {
    // Set strict rate limit for testing
    process.env.RATE_LIMIT_WINDOW_MS = "10000"; // 10 seconds
    process.env.RATE_LIMIT_MAX = "2"; // 2 requests max

    const requests: NextRequest[] = [];
    for (let i = 0; i < 3; i++) {
      requests.push(
        new NextRequest("http://localhost:3000/api/requests", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-forwarded-for": `192.168.1.100`, // Same IP
          },
          body: JSON.stringify({
            type: "music",
            text: "Test request for rate limiting",
          }),
        })
      );
    }

    // First request should succeed (or fail for other reasons, but not rate limit)
    const response1 = await POST(requests[0]);
    expect(response1.status).not.toBe(429);

    // Second request should succeed
    const response2 = await POST(requests[1]);
    expect(response2.status).not.toBe(429);

    // Third request should be rate limited
    const response3 = await POST(requests[2]);
    expect(response3.status).toBe(429);

    const data3 = await response3.json();
    expect(data3.error).toBe("Too many requests");
    expect(data3.retryAfter).toBeGreaterThan(0);
    expect(response3.headers.get("Retry-After")).toBeTruthy();
    expect(response3.headers.get("X-RateLimit-Limit")).toBe("2");
    expect(response3.headers.get("X-RateLimit-Remaining")).toBe("0");
  });

  it("should demonstrate CORS headers are added", async () => {
    process.env.ALLOWED_ORIGINS = "https://example.com";

    const request = new NextRequest("http://localhost:3000/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        origin: "https://example.com",
        "x-forwarded-for": "192.168.1.101", // Different IP from previous test
      },
      body: JSON.stringify({
        type: "music",
        text: "Test request for CORS",
      }),
    });

    const response = await POST(request);

    // Should have CORS headers (regardless of other errors)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
      "https://example.com"
    );
    expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
      "true"
    );
  });

  it("should demonstrate rate limits are per-endpoint", async () => {
    process.env.RATE_LIMIT_WINDOW_MS = "10000";
    process.env.RATE_LIMIT_MAX = "2";

    const ip = "192.168.1.102";

    // Make 2 requests to /api/requests endpoint
    const req1 = new NextRequest("http://localhost:3000/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ type: "music", text: "Test request 1 for endpoint isolation" }),
    });

    const req2 = new NextRequest("http://localhost:3000/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ type: "music", text: "Test request 2 for endpoint isolation" }),
    });

    await POST(req1);
    await POST(req2);

    // Third request to same endpoint should be rate limited
    const req3 = new NextRequest("http://localhost:3000/api/requests", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-forwarded-for": ip,
      },
      body: JSON.stringify({ type: "music", text: "Test request 3 for endpoint isolation" }),
    });

    const response3 = await POST(req3);
    expect(response3.status).toBe(429);

    // But request to different endpoint should work (it has its own limit)
    const voteReq = new NextRequest(
      "http://localhost:3000/api/requests/clh1234567890abcdefgh/vote",
      {
        method: "POST",
        headers: {
          "x-forwarded-for": ip,
        },
      }
    );

    const voteResponse = await voteOnRequest(voteReq, {
      params: Promise.resolve({ id: "clh1234567890abcdefgh" }),
    });

    // Should not be rate limited (different endpoint)
    expect(voteResponse.status).not.toBe(429);
  });
});
