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
      return NextResponse.json(
        { error: "No segment currently playing" },
        { status: 404 },
      );
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
    return NextResponse.json(
      { error: "Failed to fetch now playing data" },
      { status: 500 },
    );
  }
}
