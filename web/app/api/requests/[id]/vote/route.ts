export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requestEventEmitter } from "@/lib/request-events";
import { rateLimit, getRateLimitHeaders } from "@/lib/rate-limit";
import {
  handleCorsPreflightRequest,
  addCorsHeaders,
} from "@/lib/cors";

// Handle CORS preflight requests
export async function OPTIONS(request: NextRequest) {
  const preflightResponse = handleCorsPreflightRequest(request);
  if (preflightResponse) {
    return preflightResponse;
  }
  return new NextResponse(null, { status: 204 });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Apply rate limiting
  const rateLimitResponse = rateLimit(request);
  if (rateLimitResponse) {
    return addCorsHeaders(rateLimitResponse, request);
  }

  try {
    const { id } = await params;

    // Validate ID format (CUID format check)
    if (!id || typeof id !== "string" || id.length < 20) {
      const response = NextResponse.json(
        { error: "Invalid request ID format" },
        { status: 400 }
      );
      return addCorsHeaders(response, request);
    }

    // Check if request exists
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      const response = NextResponse.json(
        { error: "Request not found" },
        { status: 404 }
      );
      return addCorsHeaders(response, request);
    }

    // Increment the vote count
    const updatedRequest = await prisma.request.update({
      where: { id },
      data: {
        votes: {
          increment: 1,
        },
      },
    });

    // Emit event for real-time updates
    requestEventEmitter.emitRequestVoted({
      id: updatedRequest.id,
      votes: updatedRequest.votes,
    });

    const response = NextResponse.json(
      {
        success: true,
        id: updatedRequest.id,
        votes: updatedRequest.votes,
      },
      {
        headers: getRateLimitHeaders(request),
      }
    );

    return addCorsHeaders(response, request);
  } catch (error) {
    console.error("Error upvoting request:", error);

    let response: NextResponse;

    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      response = NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    } else {
      response = NextResponse.json(
        { error: "Failed to upvote request" },
        { status: 500 }
      );
    }

    return addCorsHeaders(response, request);
  }
}
