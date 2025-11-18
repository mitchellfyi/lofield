/**
 * Tests for request feed pagination and filtering
 */

import { NextRequest } from "next/server";
import { GET } from "../../app/api/requests/route";

// Mock the Prisma client
jest.mock("@/lib/db", () => ({
  prisma: {
    request: {
      findMany: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

// Mock request events
jest.mock("@/lib/request-events", () => ({
  requestEventEmitter: {
    emitRequestCreated: jest.fn(),
    emitRequestVoted: jest.fn(),
    emitRequestStatusChanged: jest.fn(),
    on: jest.fn(),
    off: jest.fn(),
  },
}));

import { prisma } from "@/lib/db";

describe("Request Feed Pagination and Filtering", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("Pagination", () => {
    it("should support page-based pagination", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(50);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([
        { id: "1", type: "music", rawText: "test", votes: 10, status: "pending", createdAt: new Date() },
      ]);

      const request = new NextRequest(
        "http://localhost:3000/api/requests?page=2&limit=20"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty("data");
      expect(data).toHaveProperty("pagination");
      expect(data.pagination.currentPage).toBe(2);
      expect(data.pagination.pageSize).toBe(20);
      expect(data.pagination.total).toBe(50);
      expect(data.pagination.totalPages).toBe(3);
      expect(data.pagination.hasNextPage).toBe(true);
      expect(data.pagination.hasPrevPage).toBe(true);

      // Verify the offset calculation (page 2, limit 20 = skip 20)
      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20,
          take: 20,
        })
      );
    });

    it("should default to page 1 if not specified", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(10);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest("http://localhost:3000/api/requests");

      const response = await GET(request);
      const data = await response.json();

      expect(data.pagination.currentPage).toBe(1);
      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 0,
        })
      );
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
  });

  describe("Type Filtering", () => {
    it("should filter by music type", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(5);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/requests?type=music"
      );

      await GET(request);

      expect(prisma.request.count).toHaveBeenCalledWith({
        where: { type: "music" },
      });
      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "music" },
        })
      );
    });

    it("should filter by talk type", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(3);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/requests?type=talk"
      );

      await GET(request);

      expect(prisma.request.count).toHaveBeenCalledWith({
        where: { type: "talk" },
      });
    });

    it("should return 400 for invalid type parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?type=invalid"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid type parameter");
    });
  });

  describe("Sorting", () => {
    it("should sort by votes by default", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(5);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest("http://localhost:3000/api/requests");

      await GET(request);

      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
        })
      );
    });

    it("should sort by created_at when specified", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(5);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/requests?sort=created_at"
      );

      await GET(request);

      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: [{ createdAt: "desc" }],
        })
      );
    });

    it("should return 400 for invalid sort parameter", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/requests?sort=invalid"
      );

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain("Invalid sort parameter");
    });
  });

  describe("Combined Filters", () => {
    it("should support multiple filters simultaneously", async () => {
      (prisma.request.count as jest.Mock).mockResolvedValue(2);
      (prisma.request.findMany as jest.Mock).mockResolvedValue([]);

      const request = new NextRequest(
        "http://localhost:3000/api/requests?type=music&status=pending&page=1&limit=10&sort=created_at"
      );

      await GET(request);

      expect(prisma.request.count).toHaveBeenCalledWith({
        where: { type: "music", status: "pending" },
      });
      expect(prisma.request.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { type: "music", status: "pending" },
          orderBy: [{ createdAt: "desc" }],
          skip: 0,
          take: 10,
        })
      );
    });
  });
});
