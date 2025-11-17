import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ArchiveSegment } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startTimeParam = searchParams.get("start_time");
    const endTimeParam = searchParams.get("end_time");
    const showId = searchParams.get("show_id");
    const limit = parseInt(searchParams.get("limit") || "50");

    // Build query filters
    interface WhereClause {
      startTime?: { gte: Date };
      endTime?: { lte: Date };
      showId?: string;
    }
    
    const where: WhereClause = {};

    if (startTimeParam) {
      where.startTime = { gte: new Date(startTimeParam) };
    }

    if (endTimeParam) {
      where.endTime = { lte: new Date(endTimeParam) };
    }

    if (showId) {
      where.showId = showId;
    }

    // Fetch archived segments
    const segments = await prisma.segment.findMany({
      where,
      include: {
        show: true,
        track: true,
        playlogEntries: {
          take: 1,
          orderBy: { playedAt: "desc" },
        },
      },
      orderBy: {
        startTime: "desc",
      },
      take: limit,
    });

    // Filter to only include segments that have been played
    const playedSegments = segments.filter(
      (segment) => segment.playlogEntries.length > 0,
    );

    // Transform to archive format
    const archiveItems: ArchiveSegment[] = playedSegments.map((segment) => ({
      id: segment.id,
      showName: segment.show.name,
      startTime: segment.startTime.toISOString(),
      endTime: segment.endTime.toISOString(),
      type: segment.type,
      // In a real implementation, this would point to the actual audio file
      streamUrl: segment.filePath
        ? `/audio/${segment.filePath}`
        : undefined,
    }));

    return NextResponse.json({
      total: archiveItems.length,
      segments: archiveItems,
    });
  } catch (error) {
    console.error("Error fetching archive:", error);
    return NextResponse.json(
      { error: "Failed to fetch archive data" },
      { status: 500 },
    );
  }
}
