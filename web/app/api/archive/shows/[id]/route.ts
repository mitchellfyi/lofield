export const dynamic = "force-dynamic";
export const revalidate = 0;

import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

/**
 * GET /api/archive/shows/:id?date=2024-01-15
 *
 * Generates an HLS playlist for a complete show episode on a specific date
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: showId } = await params;
    const searchParams = request.nextUrl.searchParams;
    const dateParam = searchParams.get("date");

    if (!dateParam) {
      return NextResponse.json(
        { error: "Missing 'date' parameter (YYYY-MM-DD format required)" },
        { status: 400 }
      );
    }

    // Parse date
    const date = new Date(dateParam);
    if (isNaN(date.getTime())) {
      return NextResponse.json(
        { error: "Invalid date format (use YYYY-MM-DD)" },
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

    // Find all segments for this show on this date
    const segments = archiveIndex.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return (
        entry.showId === showId &&
        entryDate.getUTCFullYear() === date.getUTCFullYear() &&
        entryDate.getUTCMonth() === date.getUTCMonth() &&
        entryDate.getUTCDate() === date.getUTCDate()
      );
    });

    if (segments.length === 0) {
      return NextResponse.json(
        {
          error: "No archived segments found for this show and date",
          showId,
          date: dateParam,
        },
        { status: 404 }
      );
    }

    // Sort segments by timestamp
    segments.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Generate HLS playlist
    const playlist = generateHLSPlaylist(segments);

    return new NextResponse(playlist, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.mpegurl",
        "Cache-Control": "public, max-age=86400",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    });
  } catch (error) {
    console.error("Error generating show episode playlist:", error);
    return NextResponse.json(
      { error: "Failed to generate show episode playlist" },
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
    "#EXT-X-PLAYLIST-TYPE:VOD",
    `#EXT-X-PROGRAM-DATE-TIME:${segments[0].timestamp}`,
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

  lines.push("#EXT-X-ENDLIST");

  return lines.join("\n");
}
