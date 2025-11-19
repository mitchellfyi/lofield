/**
 * Tests for CORS functionality
 *
 * These tests verify that CORS policies work correctly:
 * - Allowed origins receive proper CORS headers
 * - Disallowed origins are blocked
 * - Preflight requests are handled correctly
 * - CORS headers can be added to responses
 */

import { NextRequest, NextResponse } from "next/server";
import {
  getCorsHeaders,
  handleCorsPreflightRequest,
  addCorsHeaders,
} from "../cors";

// Mock environment variables
const originalEnv = process.env;

describe("CORS", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe("getCorsHeaders", () => {
    it("should return CORS headers for allowed origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://example.com",
        },
      });

      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://example.com"
      );
      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
      expect(headers["Access-Control-Allow-Methods"]).toContain("GET");
      expect(headers["Access-Control-Allow-Methods"]).toContain("POST");
      expect(headers["Access-Control-Allow-Headers"]).toContain("Content-Type");
      expect(headers["Access-Control-Max-Age"]).toBe("86400");
    });

    it("should handle comma-separated allowed origins", () => {
      process.env.ALLOWED_ORIGINS =
        "https://example.com,https://example.org,http://localhost:3000";

      const request1 = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://example.com",
        },
      });

      const headers1 = getCorsHeaders(request1);
      expect(headers1["Access-Control-Allow-Origin"]).toBe(
        "https://example.com"
      );

      const request2 = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://example.org",
        },
      });

      const headers2 = getCorsHeaders(request2);
      expect(headers2["Access-Control-Allow-Origin"]).toBe(
        "https://example.org"
      );

      const request3 = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const headers3 = getCorsHeaders(request3);
      expect(headers3["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000"
      );
    });

    it("should not include CORS headers for disallowed origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://evil.com",
        },
      });

      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Origin"]).toBeUndefined();
    });

    it("should allow requests with no origin header", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests");

      const headers = getCorsHeaders(request);

      // Should set to first allowed origin
      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "https://example.com"
      );
    });

    it("should use default localhost when no ALLOWED_ORIGINS is set", () => {
      delete process.env.ALLOWED_ORIGINS;

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "http://localhost:3000",
        },
      });

      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Origin"]).toBe(
        "http://localhost:3000"
      );
    });

    it("should handle wildcard origin", () => {
      process.env.ALLOWED_ORIGINS = "*";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://any-origin.com",
        },
      });

      const headers = getCorsHeaders(request);

      expect(headers["Access-Control-Allow-Credentials"]).toBe("true");
    });
  });

  describe("handleCorsPreflightRequest", () => {
    it("should return null for non-OPTIONS requests", () => {
      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "POST",
      });

      const response = handleCorsPreflightRequest(request);

      expect(response).toBeNull();
    });

    it("should handle OPTIONS request for allowed origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "OPTIONS",
        headers: {
          origin: "https://example.com",
        },
      });

      const response = handleCorsPreflightRequest(request);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(204);
      expect(response?.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://example.com"
      );
    });

    it("should block OPTIONS request for disallowed origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "OPTIONS",
        headers: {
          origin: "https://evil.com",
        },
      });

      const response = handleCorsPreflightRequest(request);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(403);
    });

    it("should allow OPTIONS request with no origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        method: "OPTIONS",
      });

      const response = handleCorsPreflightRequest(request);

      expect(response).not.toBeNull();
      expect(response?.status).toBe(204);
    });
  });

  describe("addCorsHeaders", () => {
    it("should add CORS headers to a response", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://example.com",
        },
      });

      const originalResponse = NextResponse.json({ success: true });
      const response = addCorsHeaders(originalResponse, request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://example.com"
      );
      expect(response.headers.get("Access-Control-Allow-Credentials")).toBe(
        "true"
      );
    });

    it("should preserve existing response headers", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://example.com",
        },
      });

      const originalResponse = NextResponse.json(
        { success: true },
        {
          headers: {
            "X-Custom-Header": "custom-value",
          },
        }
      );

      const response = addCorsHeaders(originalResponse, request);

      expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe(
        "https://example.com"
      );
    });

    it("should not add CORS headers for disallowed origin", () => {
      process.env.ALLOWED_ORIGINS = "https://example.com";

      const request = new NextRequest("http://localhost:3000/api/requests", {
        headers: {
          origin: "https://evil.com",
        },
      });

      const originalResponse = NextResponse.json({ success: true });
      const response = addCorsHeaders(originalResponse, request);

      expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    });
  });
});
