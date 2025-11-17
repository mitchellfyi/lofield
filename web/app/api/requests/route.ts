import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { CreateRequestData } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get("status");
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build query filters
    const where = status ? { status } : {};

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

    // Create new request in database
    const newRequest = await prisma.request.create({
      data: {
        type: body.type,
        rawText: body.text,
        votes: 0,
        status: "pending",
        moderationStatus: "pending",
      },
    });

    return NextResponse.json(newRequest, { status: 201 });
  } catch (error) {
    console.error("Error creating request:", error);
    return NextResponse.json(
      { error: "Failed to create request" },
      { status: 500 },
    );
  }
}
