import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/archive/time?ts=2024-01-15T14:00:00Z
 *
 * Generates an HLS playlist for time-shifted playback starting at a specific timestamp
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const timestampParam = searchParams.get("ts");

    if (!timestampParam) {
      return NextResponse.json(
        { error: "Missing 'ts' parameter (ISO 8601 timestamp required)" },
        { status: 400 }
      );
    }

    // Parse timestamp
    const timestamp = new Date(timestampParam);
    if (isNaN(timestamp.getTime())) {
      return NextResponse.json(
        { error: "Invalid timestamp format (use ISO 8601)" },
        { status: 400 }
      );
    }

    // Load archive index
    const archivePath =
      process.env.ARCHIVE_OUTPUT_PATH || "/var/lofield/archive";
    const indexPath = path.join(archivePath, "archive-index.json");

    let archiveIndex: Array<{
      timestamp: string;
      segmentPath: string;
      duration: number;
      showId: string;
      segmentType: string;
      segmentId: string;
      trackId?: string;
    }>;

    try {
      const indexData = await fs.readFile(indexPath, "utf-8");
      archiveIndex = JSON.parse(indexData);
    } catch {
      return NextResponse.json(
        {
          error: "Archive index not available",
          message: "No archived content found",
        },
        { status: 404 }
      );
    }

    // Find segments starting from the requested timestamp
    // Look ahead 1 hour by default
    const durationMinutes = parseInt(searchParams.get("duration") || "60", 10);
    const endTime = new Date(timestamp.getTime() + durationMinutes * 60 * 1000);

    const segments = archiveIndex.filter((entry) => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= timestamp && entryTime <= endTime;
    });

    if (segments.length === 0) {
      return NextResponse.json(
        {
          error: "No archived segments found for the specified time range",
          requestedTime: timestamp.toISOString(),
        },
        { status: 404 }
      );
    }

    // Generate HLS playlist
    const playlist = generateHLSPlaylist(segments);

    return new NextResponse(playlist, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=3600",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error generating time-shift playlist:", error);
    return NextResponse.json(
      { error: "Failed to generate playlist" },
      { status: 500 }
    );
  }
}

/**
 * Generate HLS playlist content from archive segments
 */
function generateHLSPlaylist(
  segments: Array<{
    timestamp: string;
    segmentPath: string;
    duration: number;
    showId: string;
    segmentType: string;
    segmentId: string;
  }>
): string {
  const lines = [
    "#EXTM3U",
    "#EXT-X-VERSION:3",
    "#EXT-X-TARGETDURATION:10",
    "#EXT-X-MEDIA-SEQUENCE:0",
    "#EXT-X-PLAYLIST-TYPE:EVENT",
  ];

  for (const segment of segments) {
    lines.push(`#EXTINF:${segment.duration.toFixed(1)},`);

    // Convert file system path to API path
    const filename = path.basename(segment.segmentPath);
    const dir = path.dirname(segment.segmentPath);
    const parts = dir.split(path.sep);
    const year = parts[parts.length - 4];
    const month = parts[parts.length - 3];
    const day = parts[parts.length - 2];
    const hour = parts[parts.length - 1];

    lines.push(
      `/api/archive/segments/${year}/${month}/${day}/${hour}/${filename}`
    );
  }

  return lines.join("\n");
}
