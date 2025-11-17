import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// This endpoint provides Server-Sent Events for real-time updates
// Clients can subscribe to get notified when the now-playing data changes
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      let interval: NodeJS.Timeout | null = null;

      try {
        // Helper function to send an SSE message
        const sendEvent = (data: unknown, event: string = "message") => {
          try {
            const message = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(encoder.encode(message));
          } catch (error) {
            console.error("Error encoding SSE message:", error);
          }
        };

        // Send initial connection confirmation
        sendEvent(
          { type: "connected", timestamp: new Date().toISOString() },
          "connected"
        );

        // Function to fetch and send current now-playing data
        const sendNowPlaying = async () => {
          try {
            const now = new Date();

            const currentSegment = await prisma.segment.findFirst({
              where: {
                startTime: { lte: now },
                endTime: { gte: now },
              },
              include: {
                show: true,
                track: true,
                request: true,
              },
            });

            if (currentSegment) {
              const nowPlaying = {
                segmentId: currentSegment.id,
                type: currentSegment.type,
                startTime: currentSegment.startTime.toISOString(),
                endTime: currentSegment.endTime.toISOString(),
                showName: currentSegment.show.name,
                title: currentSegment.track?.title,
                artist: currentSegment.track?.artist,
                requestText: currentSegment.request?.rawText,
              };

              sendEvent(nowPlaying, "now-playing");
            } else {
              // Send consistent structure with null values when no segment is playing
              const nowPlaying = {
                segmentId: null,
                type: null,
                startTime: null,
                endTime: null,
                showName: null,
                title: null,
                artist: null,
                requestText: null,
              };

              sendEvent(nowPlaying, "now-playing");
            }
          } catch (error) {
            console.error("Error fetching now-playing in SSE:", error);
            sendEvent(
              {
                error: "Failed to fetch now-playing data",
                timestamp: new Date().toISOString(),
              },
              "error"
            );
          }
        };

        // Send initial now-playing data
        await sendNowPlaying();

        // Set up interval to check for updates every 10 seconds
        interval = setInterval(async () => {
          await sendNowPlaying();
        }, 10000);

        // Clean up when the connection is closed
        request.signal.addEventListener("abort", () => {
          if (interval) {
            clearInterval(interval);
          }
          try {
            controller.close();
          } catch (error) {
            // Controller may already be closed
            console.error("Error closing SSE controller:", error);
          }
        });
      } catch (error) {
        console.error("Error initializing SSE stream:", error);
        if (interval) {
          clearInterval(interval);
        }
        try {
          controller.error(error);
        } catch {
          // Controller may already be closed
        }
      }
    },
  });

  return new Response(customReadable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
