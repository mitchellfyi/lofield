import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { NowPlaying } from "@/lib/types";

export async function GET() {
  try {
    const now = new Date();

    // Find the segment currently playing
    const currentSegment = await prisma.segment.findFirst({
      where: {
        startTime: {
          lte: now,
        },
        endTime: {
          gte: now,
        },
      },
      include: {
        show: true,
        track: true,
        request: true,
      },
    });

    if (!currentSegment) {
      // Return consistent structure with null values instead of 404
      return NextResponse.json({
        segmentId: null,
        type: null,
        startTime: null,
        endTime: null,
        showName: null,
        title: null,
        artist: null,
        requestText: null,
        requesterName: null,
      });
    }

    // Build the response
    const nowPlaying: NowPlaying = {
      segmentId: currentSegment.id,
      type: currentSegment.type as "music" | "talk" | "ident" | "handover",
      startTime: currentSegment.startTime.toISOString(),
      endTime: currentSegment.endTime.toISOString(),
      showName: currentSegment.show.name,
    };

    // Add track information if available
    if (currentSegment.track) {
      nowPlaying.title = currentSegment.track.title;
      nowPlaying.artist = currentSegment.track.artist;
    }

    // Add request information if available
    if (currentSegment.request) {
      nowPlaying.requestText = currentSegment.request.rawText;
      nowPlaying.requesterName = currentSegment.request.userId || "Anonymous";
    }

    return NextResponse.json(nowPlaying);
  } catch (error) {
    console.error("Error fetching now playing:", error);

    // Check for database connection errors
    if (error instanceof Error && error.message.includes("connect")) {
      return NextResponse.json(
        { error: "Database connection failed" },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: "Failed to fetch now playing data" },
      { status: 500 }
    );
  }
}
