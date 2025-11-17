import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { CreateRequestData } from "@/lib/types";
import { moderateRequest } from "@/lib/moderation";
import { classifyRequest } from "@/lib/classification";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const statusParam = searchParams.get("status");
    
    // Validate status parameter
    const validStatuses = ["pending", "approved", "rejected", "used"];
    if (statusParam && !validStatuses.includes(statusParam)) {
      return NextResponse.json(
        { error: `Invalid status parameter: must be one of ${validStatuses.join(", ")}` },
        { status: 400 }
      );
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
    
    // Parse and validate offset parameter
    const offsetParam = searchParams.get("offset");
    let offset = 0; // default
    if (offsetParam) {
      const parsedOffset = parseInt(offsetParam, 10);
      if (isNaN(parsedOffset) || parsedOffset < 0) {
        return NextResponse.json(
          { error: "Invalid offset parameter: must be a non-negative number" },
          { status: 400 }
        );
      }
      offset = parsedOffset;
    }

    // Build query filters
    const where = statusParam ? { status: statusParam } : {};

    // Fetch requests from database
    const requests = await prisma.request.findMany({
      where,
      orderBy: [
        { votes: "desc" }, // Sort by votes (highest first)
        { createdAt: "desc" }, // Then by creation date (newest first)
      ],
      take: limit,
      skip: offset,
    });

    return NextResponse.json(requests);
  } catch (error) {
    console.error("Error fetching requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch requests" },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateRequestData = await request.json();

    // Validate request
    if (!body.type || !body.text) {
      return NextResponse.json(
        { error: "Missing required fields: type and text" },
        { status: 400 },
      );
    }

    if (body.text.length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters" },
        { status: 400 },
      );
    }

    if (!["music", "talk"].includes(body.type)) {
      return NextResponse.json(
        { error: "Type must be either 'music' or 'talk'" },
        { status: 400 },
      );
    }

    // Step 1: Moderate the request
    const moderationResult = await moderateRequest(body.text);

    if (moderationResult.verdict === "rejected") {
      // Create request in database but mark as rejected
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
        { status: 403 },
      );
    }

    // Step 2: Classify the request (if moderation passed or needs rewrite)
    const classification = await classifyRequest(body.text, body.type);

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
          moderationResult.verdict === "needs_rewrite"
            ? "flagged"
            : "approved",
      },
    });

    return NextResponse.json(
      {
        ...newRequest,
        moderation: {
          verdict: moderationResult.verdict,
          reasons: moderationResult.reasons,
        },
        classification: normalizedData,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 },
    );
  }
}
