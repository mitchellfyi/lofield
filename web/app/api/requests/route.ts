export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { CreateRequestData } from "@/lib/types";
import { moderateRequest } from "@/lib/moderation";
import { classifyRequest } from "@/lib/classification";
import { requestEventEmitter } from "@/lib/request-events";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    const typeParam = searchParams.get("type");
    const sortParam = searchParams.get("sort");

    // Validate status parameter
    const validStatuses = ["pending", "approved", "rejected", "used"];
    if (statusParam && !validStatuses.includes(statusParam)) {
      return NextResponse.json(
        {
          error: `Invalid status parameter: must be one of ${validStatuses.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate type parameter
    const validTypes = ["music", "talk"];
    if (typeParam && !validTypes.includes(typeParam)) {
      return NextResponse.json(
        {
          error: `Invalid type parameter: must be one of ${validTypes.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Validate sort parameter
    const validSorts = ["created_at", "votes"];
    if (sortParam && !validSorts.includes(sortParam)) {
      return NextResponse.json(
        {
          error: `Invalid sort parameter: must be one of ${validSorts.join(", ")}`,
        },
        { status: 400 }
      );
    }

    // Parse and validate page parameter (1-based)
    const pageParam = searchParams.get("page");
    let page = 1; // default
    if (pageParam) {
      const parsedPage = parseInt(pageParam, 10);
      if (isNaN(parsedPage) || parsedPage < 1) {
        return NextResponse.json(
          { error: "Invalid page parameter: must be a positive number" },
          { status: 400 }
        );
      }
      page = parsedPage;
    }

    // Parse and validate limit parameter
    const limitParam = searchParams.get("limit");
    let limit = 20; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: "Invalid limit parameter: must be a positive number" },
          { status: 400 }
        );
      }
      if (parsedLimit > 100) {
        return NextResponse.json(
          { error: "Invalid limit parameter: maximum value is 100" },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Calculate offset from page and limit
    const offset = (page - 1) * limit;

    // Build query filters
    const where: {
      status?: string;
      type?: string;
    } = {};
    if (statusParam) {
      where.status = statusParam;
    }
    if (typeParam) {
      where.type = typeParam;
    }

    // Determine sort order
    const orderBy =
      sortParam === "created_at"
        ? [{ createdAt: "desc" as const }]
        : [
            { votes: "desc" as const }, // Sort by votes (highest first)
            { createdAt: "desc" as const }, // Then by creation date (newest first)
          ];

    // Get total count for pagination metadata
    const total = await prisma.request.count({ where });

    // Fetch requests from database
    const requests = await prisma.request.findMany({
      where,
      orderBy,
      take: limit,
      skip: offset,
    });

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      data: requests,
      pagination: {
        total,
        totalPages,
        currentPage: page,
        pageSize: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1,
      },
    });
  } catch (error) {
    console.error("Error fetching requests:", error);

    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    let body: CreateRequestData;

    // Parse JSON body with error handling
    try {
      body = await request.json();
    } catch {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    // Validate request
    if (!body.type || !body.text) {
      return NextResponse.json(
        { error: "Missing required fields: type and text" },
        { status: 400 }
      );
    }

    if (typeof body.text !== "string" || typeof body.type !== "string") {
      return NextResponse.json(
        { error: "Fields 'type' and 'text' must be strings" },
        { status: 400 }
      );
    }

    if (body.text.length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters" },
        { status: 400 }
      );
    }

    if (body.text.length > 500) {
      return NextResponse.json(
        { error: "Text must not exceed 500 characters" },
        { status: 400 }
      );
    }

    if (!["music", "talk"].includes(body.type)) {
      return NextResponse.json(
        { error: "Type must be either 'music' or 'talk'" },
        { status: 400 }
      );
    }

    // Step 1: Moderate the request
    let moderationResult;
    try {
      moderationResult = await moderateRequest(body.text);
    } catch (moderationError) {
      console.error("Moderation service error:", moderationError);
      return NextResponse.json(
        { error: "Moderation service temporarily unavailable" },
        { status: 503 }
      );
    }

    if (moderationResult.verdict === "rejected") {
      // Create request in database but mark as rejected
      try {
        const rejectedRequest = await prisma.request.create({
          data: {
            type: body.type,
            rawText: body.text,
            votes: 0,
            status: "rejected",
            moderationStatus: "rejected",
          },
        });

        return NextResponse.json(
          {
            error: "Request rejected by moderation",
            reasons: moderationResult.reasons,
            id: rejectedRequest.id,
          },
          { status: 403 }
        );
      } catch (dbError) {
        console.error("Database error while saving rejected request:", dbError);
        // Still return moderation rejection even if we couldn't save it
        return NextResponse.json(
          {
            error: "Request rejected by moderation",
            reasons: moderationResult.reasons,
          },
          { status: 403 }
        );
      }
    }

    // Step 2: Classify the request (if moderation passed or needs rewrite)
    let classification;
    try {
      classification = await classifyRequest(body.text, body.type);
    } catch (classificationError) {
      console.error("Classification service error:", classificationError);
      return NextResponse.json(
        { error: "Classification service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Store normalized metadata as JSON string
    const normalizedData = {
      type: classification.type,
      normalized: classification.normalized,
      metadata: classification.metadata,
      confidence: classification.confidence,
    };

    // Step 3: Create request in database with classification data
    const newRequest = await prisma.request.create({
      data: {
        type: body.type,
        rawText: body.text,
        normalized: JSON.stringify(normalizedData),
        votes: 0,
        status: "pending",
        moderationStatus:
          moderationResult.verdict === "needs_rewrite" ? "flagged" : "approved",
      },
    });

    // Emit event for real-time updates (only for non-rejected requests)
    if (newRequest.status === "pending") {
      requestEventEmitter.emitRequestCreated({
        id: newRequest.id,
        type: newRequest.type,
        text: newRequest.rawText,
        upvotes: newRequest.votes,
        status: newRequest.status,
        createdAt: newRequest.createdAt.toISOString(),
      });
    }

    return NextResponse.json(
      {
        ...newRequest,
        moderation: {
          verdict: moderationResult.verdict,
          reasons: moderationResult.reasons,
        },
        classification: normalizedData,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating request:", error);

    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 }
    );
  }
}
