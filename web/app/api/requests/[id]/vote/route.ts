import { NextRequest, NextResponse } from "next/server";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  // In the stub implementation, we'll just return success
  // The actual upvote count will be managed by the parent requests array
  return NextResponse.json({ success: true, id });
}
