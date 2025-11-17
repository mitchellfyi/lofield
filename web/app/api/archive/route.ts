import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { ArchiveSegment } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const startTimeParam = searchParams.get("start_time");
    const endTimeParam = searchParams.get("end_time");
    const showId = searchParams.get("show_id");

    // Parse and validate limit parameter
    const limitParam = searchParams.get("limit");
    let limit = 20; // default
    if (limitParam) {
      const parsedLimit = parseInt(limitParam, 10);
      if (isNaN(parsedLimit) || parsedLimit < 1) {
        return NextResponse.json(
          { error: "Invalid limit parameter: must be a positive number" },
          { status: 400 }
        );
      }
      if (parsedLimit > 100) {
        return NextResponse.json(
          { error: "Invalid limit parameter: maximum value is 100" },
          { status: 400 }
        );
      }
      limit = parsedLimit;
    }

    // Build query filters
    interface WhereClause {
      startTime?: { gte: Date };
      endTime?: { lte: Date };
      showId?: string;
    }

    const where: WhereClause = {};

    // Parse and validate start_time parameter
    if (startTimeParam) {
      const startTime = new Date(startTimeParam);
      if (isNaN(startTime.getTime())) {
        return NextResponse.json(
          {
            error:
              "Invalid start_time parameter: must be a valid ISO 8601 date",
          },
          { status: 400 }
        );
      }
      where.startTime = { gte: startTime };
    }

    // Parse and validate end_time parameter
    if (endTimeParam) {
      const endTime = new Date(endTimeParam);
      if (isNaN(endTime.getTime())) {
        return NextResponse.json(
          {
            error: "Invalid end_time parameter: must be a valid ISO 8601 date",
          },
          { status: 400 }
        );
      }
      where.endTime = { lte: endTime };
    }

    // Swap start_time and end_time if start_time > end_time
    if (where.startTime && where.endTime) {
      const startTime = where.startTime.gte;
      const endTime = where.endTime.lte;
      if (startTime > endTime) {
        where.startTime = { gte: endTime };
        where.endTime = { lte: startTime };
      }
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
      (segment: { playlogEntries: unknown[] }) =>
        segment.playlogEntries.length > 0
    );

    // Transform to archive format
    const archiveItems: ArchiveSegment[] = playedSegments.map(
      (segment: {
        id: string;
        show: { name: string };
        startTime: Date;
        endTime: Date;
        type: string;
        filePath: string | null;
      }) => ({
        id: segment.id,
        showName: segment.show.name,
        startTime: segment.startTime.toISOString(),
        endTime: segment.endTime.toISOString(),
        type: segment.type,
        // In a real implementation, this would point to the actual audio file
        streamUrl: segment.filePath ? `/audio/${segment.filePath}` : undefined,
      })
    );

    return NextResponse.json({
      total: archiveItems.length,
      segments: archiveItems,
    });
  } catch (error) {
    console.error("Error fetching archive:", error);
    return NextResponse.json(
      { error: "Failed to fetch archive data" },
      { status: 500 }
    );
  }
}
