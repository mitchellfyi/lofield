import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { id } = params;

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
    return NextResponse.json(
      { error: "Failed to upvote request" },
      { status: 500 },
    );
  }
}
