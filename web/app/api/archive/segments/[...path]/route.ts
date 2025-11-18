import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/archive/segments/[...path]
 * 
 * Serves archived HLS segment files
 * Path format: YYYY/MM/DD/HH/filename.ts
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    const { path: pathSegments } = await params;

    if (!pathSegments || pathSegments.length < 5) {
      return NextResponse.json(
        { error: "Invalid path format. Expected: YYYY/MM/DD/HH/filename.ts" },
        { status: 400 }
      );
    }

    // Validate path components
    const [year, month, day, hour, filename] = pathSegments;

    // Basic validation
    if (
      !/^\d{4}$/.test(year) ||
      !/^\d{2}$/.test(month) ||
      !/^\d{2}$/.test(day) ||
      !/^\d{2}$/.test(hour) ||
      !filename.endsWith(".ts")
    ) {
      return NextResponse.json(
        { error: "Invalid path components" },
        { status: 400 }
      );
    }

    // Build file path
    const archivePath =
      process.env.ARCHIVE_OUTPUT_PATH || "/var/lofield/archive";
    const segmentPath = path.join(
      archivePath,
      year,
      month,
      day,
      hour,
      filename
    );

    // Security: Ensure the resolved path is within the archive directory
    const resolvedPath = path.resolve(segmentPath);
    const resolvedArchivePath = path.resolve(archivePath);
    if (!resolvedPath.startsWith(resolvedArchivePath)) {
      return NextResponse.json(
        { error: "Invalid path" },
        { status: 400 }
      );
    }

    // Check if segment exists
    try {
      await fs.access(segmentPath);
    } catch {
      return NextResponse.json(
        { error: "Segment not found" },
        { status: 404 }
      );
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
    console.error("Error serving archived segment:", error);
    return NextResponse.json(
      { error: "Failed to serve archived segment" },
      { status: 500 }
    );
  }
}
