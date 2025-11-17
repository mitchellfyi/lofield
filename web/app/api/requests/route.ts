import { NextRequest, NextResponse } from "next/server";
import type { Request, CreateRequestData } from "@/lib/types";

// Dummy data store (in-memory, will reset on server restart)
const requests: Request[] = [
  {
    id: "1",
    type: "music",
    text: "Chill sunset vibes with jazzy piano and lo-fi beats",
    upvotes: 12,
    status: "pending",
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: "2",
    type: "talk",
    text: "Tips for staying productive while working from home",
    upvotes: 8,
    status: "pending",
    createdAt: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    id: "3",
    type: "music",
    text: "Rainy day coffee shop atmosphere with soft guitar",
    upvotes: 15,
    status: "pending",
    createdAt: new Date(Date.now() - 1800000).toISOString(),
  },
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const status = searchParams.get("status");

  let filteredRequests = requests;

  if (status) {
    filteredRequests = requests.filter((req) => req.status === status);
  }

  return NextResponse.json(filteredRequests);
}

export async function POST(request: NextRequest) {
  try {
    const body: CreateRequestData = await request.json();

    // Validate request
    if (!body.type || !body.text) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (body.text.length < 10) {
      return NextResponse.json(
        { error: "Text must be at least 10 characters" },
        { status: 400 },
      );
    }

    // Create new request
    const newRequest: Request = {
      id: Date.now().toString(),
      type: body.type,
      text: body.text,
      upvotes: 0,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    requests.push(newRequest);

    return NextResponse.json(newRequest, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }
}
