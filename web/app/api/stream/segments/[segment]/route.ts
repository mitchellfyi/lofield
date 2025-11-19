export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/stream/segments/[segment]
 *
 * Serves HLS segment files (.ts)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ segment: string }> }
) {
  try {
    const { segment } = await params;

    // Validate segment name (should be live###.ts format)
    if (!segment || !/^live\d{3}\.ts$/.test(segment)) {
      return NextResponse.json(
        { error: "Invalid segment name" },
        { status: 400 }
      );
    }

    const streamPath = process.env.STREAM_OUTPUT_PATH || "/var/lofield/stream";
    const segmentPath = path.join(streamPath, segment);

    // Check if segment exists
    try {
      await fs.access(segmentPath);
    } catch {
      return NextResponse.json({ error: "Segment not found" }, { status: 404 });
    }

    // Read and serve the segment
    const segmentData = await fs.readFile(segmentPath);

    return new NextResponse(segmentData, {
      status: 200,
      headers: {
        "Content-Type": "video/mp2t",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error serving HLS segment:", error);
    return NextResponse.json(
      { error: "Failed to serve segment" },
      { status: 500 }
    );
  }
}
