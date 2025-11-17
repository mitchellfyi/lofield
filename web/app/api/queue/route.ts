import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { QueueItem } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    // Parse and validate minutes parameter
    const minutesParam = searchParams.get("minutes");
    let minutesAhead = 60; // default
    if (minutesParam) {
      const parsedMinutes = parseInt(minutesParam, 10);
      if (isNaN(parsedMinutes) || parsedMinutes < 1) {
        return NextResponse.json(
          { error: "Invalid minutes parameter: must be a positive number" },
          { status: 400 }
        );
      }
      if (parsedMinutes > 1440) {
        // max 24 hours
        return NextResponse.json(
          {
            error:
              "Invalid minutes parameter: maximum value is 1440 (24 hours)",
          },
          { status: 400 }
        );
      }
      minutesAhead = parsedMinutes;
    }

    // Parse and validate limit parameter (optional)
    const limitParam = searchParams.get("limit");
    let limit: number | undefined;
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

    const now = new Date();
    const futureTime = new Date(now.getTime() + minutesAhead * 60000);

    // Find upcoming segments
    const upcomingSegments = await prisma.segment.findMany({
      where: {
        startTime: {
          gte: now,
          lte: futureTime,
        },
      },
      include: {
        track: true,
        show: true,
      },
      orderBy: {
        startTime: "asc",
      },
      ...(limit && { take: limit }),
    });

    // Transform to queue items
    const queueItems: QueueItem[] = upcomingSegments.map(
      (segment: {
        id: string;
        type: string;
        startTime: Date;
        endTime: Date;
        track: { title: string } | null;
      }) => {
        const duration = Math.floor(
          (segment.endTime.getTime() - segment.startTime.getTime()) / 1000
        );

        const item: QueueItem = {
          segmentId: segment.id,
          type: segment.type as "music" | "talk" | "ident" | "handover",
          scheduledTime: segment.startTime.toISOString(),
          duration,
        };

        // Add track title if available
        if (segment.track) {
          item.title = segment.track.title;
        }

        return item;
      }
    );

    return NextResponse.json({
      queueLength: queueItems.length,
      minutesAhead,
      items: queueItems,
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    
    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }
    
    return NextResponse.json(
      { error: "Failed to fetch queue data" },
      { status: 500 }
    );
  }
}
