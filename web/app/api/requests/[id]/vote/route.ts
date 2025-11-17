import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Validate ID format (CUID format check)
    if (!id || typeof id !== "string" || id.length < 20) {
      return NextResponse.json(
        { error: "Invalid request ID format" },
        { status: 400 }
      );
    }

    // Check if request exists
    const existingRequest = await prisma.request.findUnique({
      where: { id },
    });

    if (!existingRequest) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
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

    return NextResponse.json({
      success: true,
      id: updatedRequest.id,
      votes: updatedRequest.votes,
    });
  } catch (error) {
    console.error("Error upvoting request:", error);
    
    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to upvote request" },
      { status: 500 }
    );
  }
}
