import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { QueueItem } from "@/lib/types";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const minutesAhead = parseInt(searchParams.get("minutes") || "60");
    
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
    });

    // Transform to queue items
    const queueItems: QueueItem[] = upcomingSegments.map((segment) => {
      const duration = Math.floor(
        (segment.endTime.getTime() - segment.startTime.getTime()) / 1000,
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
    });

    return NextResponse.json({
      queueLength: queueItems.length,
      minutesAhead,
      items: queueItems,
    });
  } catch (error) {
    console.error("Error fetching queue:", error);
    return NextResponse.json(
      { error: "Failed to fetch queue data" },
      { status: 500 },
    );
  }
}
