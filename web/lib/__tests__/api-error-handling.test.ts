/**
 * Tests for API error handling
 *
 * These tests verify that API routes properly handle edge cases and errors:
 * - Invalid input validation
 * - JSON parsing errors
 * - Database connection errors
 * - Proper HTTP status codes
 */

import { NextRequest } from "next/server";
import { GET, POST } from "../../app/api/requests/route";
import { GET as getQueue } from "../../app/api/queue/route";
import { POST as voteOnRequest } from "../../app/api/requests/[id]/vote/route";

// Mock the Prisma client
jest.mock("@/lib/db", () => ({
  prisma: {
    request: {
      findMany: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    segment: {
      findMany: jest.fn(),
    },
  },
}));

// Mock moderation and classification
jest.mock("@/lib/moderation", () => ({
  moderateRequest: jest.fn(),
}));

jest.mock("@/lib/classification", () => ({
  classifyRequest: jest.fn(),
}));

// Mock request events
jest.mock("@/lib/request-events", () => ({
  requestEventEmitter: {
    emitRequestCreated: jest.fn(),
    emitRequestVoted: jest.fn(),
    emitRequestStatusChanged: jest.fn(),
  },
}));

// Mock rate limiting - disable it for these tests
jest.mock("@/lib/rate-limit", () => ({
  rateLimit: jest.fn(() => null), // Always allow requests
  getRateLimitHeaders: jest.fn(() => ({
    "X-RateLimit-Limit": "5",
    "X-RateLimit-Remaining": "5",
  })),
}));

// Mock CORS - allow all origins for these tests
jest.mock("@/lib/cors", () => ({
  handleCorsPreflightRequest: jest.fn(() => null),
  addCorsHeaders: jest.fn((response) => response),
  getCorsHeaders: jest.fn(() => ({})),
}));

import { prisma } from "@/lib/db";
import { moderateRequest } from "@/lib/moderation";
import { classifyRequest } from "@/lib/classification";

describe("API Error Handling", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/requests", () => {
    beforeEach(() => {
      // Mock both count and findMany for all GET tests
      (prisma.request.count as jest.Mock).mockResolvedValue(0);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);
    });

    it("should return 400 for invalid status parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?status=invalid"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid status parameter");
    });

    it("should return 400 for invalid limit parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?limit=abc"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid limit parameter");
    });

    it("should return 400 for limit exceeding maximum", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?limit=150"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("maximum value is 100");
    });

    it("should return 400 for invalid page parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?page=0"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid page parameter");
    });

    it("should return 503 for database connection errors", async () => {
      (prisma.request.count as jest.Mock).mockRejectedValueOnce(
        new Error("connect ECONNREFUSED")
      );

      const request = new NextRequest("http://localhost:3000/api/requests");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Database connection failed");
    });

    it("should return 500 for other database errors", async () => {
      (prisma.request.count as jest.Mock).mockRejectedValueOnce(
        new Error("Some other database error")
      );

      const request = new NextRequest("http://localhost:3000/api/requests");

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe("Failed to fetch requests");
    });
  });

  describe("POST /api/requests", () => {
    beforeEach(() => {
      (moderateRequest as jest.Mock).mockResolvedValue({
        verdict: "allowed",
        reasons: [],
      });
      (classifyRequest as jest.Mock).mockResolvedValue({
        type: "music",
        normalized: "test prompt",
        metadata: {},
        confidence: 0.9,
      });
    });

    it("should return 400 for invalid JSON", async () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        body: "invalid json{",
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe("Invalid JSON in request body");
    });

    it("should return 400 for missing required fields", async () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "music" }), // missing text
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Missing required fields");
    });

    it("should return 400 for non-string type field", async () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: 123, text: "some text here" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be strings");
    });

    it("should return 400 for text that is too short", async () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "music", text: "short" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("at least 10 characters");
    });

    it("should return 400 for text that is too long", async () => {
      const longText = "a".repeat(501);
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "music", text: longText }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must not exceed 500 characters");
    });

    it("should return 400 for invalid type value", async () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "invalid", text: "some text here" }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("must be either 'music' or 'talk'");
    });

    it("should return 503 for moderation service errors", async () => {
      (moderateRequest as jest.Mock).mockRejectedValueOnce(
        new Error("Moderation API error")
      );

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "music",
          text: "some valid text here",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain("Moderation service");
    });

    it("should return 503 for classification service errors", async () => {
      (classifyRequest as jest.Mock).mockRejectedValueOnce(
        new Error("Classification API error")
      );

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "music",
          text: "some valid text here",
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toContain("Classification service");
    });
  });

  describe("GET /api/queue", () => {
    it("should return 400 for non-numeric minutes parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/queue?minutes=abc"
      );

      const response = await getQueue(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid minutes parameter");
    });

    it("should return 400 for minutes exceeding maximum", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/queue?minutes=2000"
      );

      const response = await getQueue(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("maximum value is 1440");
    });

    it("should return 503 for database connection errors", async () => {
      (prisma.segment.findMany as jest.Mock).mockRejectedValueOnce(
        new Error("connect ECONNREFUSED")
      );

      const request = new NextRequest("http://localhost:3000/api/queue");

      const response = await getQueue(request);
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Database connection failed");
    });
  });

  describe("POST /api/requests/[id]/vote", () => {
    it("should return 400 for invalid ID format", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests/123/vote",
        { method: "POST" }
      );

      const response = await voteOnRequest(request, {
        params: Promise.resolve({ id: "123" }),
      });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid request ID format");
    });

    it("should return 404 for non-existent request", async () => {
      (prisma.request.findUnique as jest.Mock).mockResolvedValueOnce(null);

      const request = new NextRequest(
        "http://localhost:3000/api/requests/clh1234567890abcdefgh/vote",
        { method: "POST" }
      );

      const response = await voteOnRequest(request, {
        params: Promise.resolve({ id: "clh1234567890abcdefgh" }),
      });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe("Request not found");
    });

    it("should return 503 for database connection errors", async () => {
      (prisma.request.findUnique as jest.Mock).mockRejectedValueOnce(
        new Error("connect ECONNREFUSED")
      );

      const request = new NextRequest(
        "http://localhost:3000/api/requests/clh1234567890abcdefgh/vote",
        { method: "POST" }
      );

      const response = await voteOnRequest(request, {
        params: Promise.resolve({ id: "clh1234567890abcdefgh" }),
      });
      const data = await response.json();

      expect(response.status).toBe(503);
      expect(data.error).toBe("Database connection failed");
    });
  });
});
