import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/stream/live.m3u8
 *
 * Serves the live HLS manifest for continuous streaming
 */
export async function GET() {
  try {
    const streamPath = process.env.STREAM_OUTPUT_PATH || "/var/lofield/stream";
    const manifestPath = path.join(streamPath, "live.m3u8");

    // Check if manifest exists
    try {
      await fs.access(manifestPath);
    } catch {
      return NextResponse.json(
        {
          error: "Live stream not available",
          message: "The playout service may not be running",
        },
        { status: 503 }
      );
    }

    // Read and serve the manifest
    const manifestContent = await fs.readFile(manifestPath, "utf-8");

    return new NextResponse(manifestContent, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error serving HLS manifest:", error);
    return NextResponse.json(
      { error: "Failed to serve live stream" },
      { status: 500 }
    );
  }
}
