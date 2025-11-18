import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { requestEventEmitter } from "@/lib/request-events";
import type { Request } from "@prisma/client";

// Server-Sent Events endpoint for real-time request updates
// Clients subscribe to get notifications when:
// - New requests are created
// - Requests receive votes
// - Request statuses change (pending -> used/rejected)
export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();

  const customReadable = new ReadableStream({
    async start(controller) {
      let pollInterval: NodeJS.Timeout | null = null;

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

        // Function to fetch and send current pending requests
        const sendRequestsUpdate = async () => {
          try {
            const requests = await prisma.request.findMany({
              where: { status: "pending" },
              orderBy: [{ votes: "desc" }, { createdAt: "desc" }],
              take: 50, // Limit to 50 most recent/popular
            });

            sendEvent(
              {
                requests: requests.map((req: Request) => ({
                  id: req.id,
                  type: req.type,
                  text: req.rawText,
                  upvotes: req.votes,
                  status: req.status,
                  createdAt: req.createdAt.toISOString(),
                })),
                timestamp: new Date().toISOString(),
              },
              "requests-update"
            );
          } catch (error) {
            console.error("Error fetching requests in SSE:", error);
            sendEvent(
              {
                error: "Failed to fetch requests",
                timestamp: new Date().toISOString(),
              },
              "error"
            );
          }
        };

        // Send initial data
        await sendRequestsUpdate();

        // Event handlers for request changes
        const handleRequestCreated = (requestData: {
          id: string;
          type: string;
          text: string;
          upvotes: number;
          status: string;
          createdAt: string;
        }) => {
          sendEvent(requestData, "request-created");
        };

        const handleRequestVoted = (data: { id: string; votes: number }) => {
          sendEvent(data, "request-voted");
        };

        const handleRequestStatusChanged = (data: {
          id: string;
          status: string;
        }) => {
          sendEvent(data, "request-status-changed");
        };

        // Subscribe to request events
        requestEventEmitter.on("request:created", handleRequestCreated);
        requestEventEmitter.on("request:voted", handleRequestVoted);
        requestEventEmitter.on(
          "request:status-changed",
          handleRequestStatusChanged
        );

        // Fallback: Poll for updates every 30 seconds in case events are missed
        pollInterval = setInterval(async () => {
          await sendRequestsUpdate();
        }, 30000);

        // Clean up when the connection is closed
        request.signal.addEventListener("abort", () => {
          // Remove event listeners
          requestEventEmitter.off("request:created", handleRequestCreated);
          requestEventEmitter.off("request:voted", handleRequestVoted);
          requestEventEmitter.off(
            "request:status-changed",
            handleRequestStatusChanged
          );

          if (pollInterval) {
            clearInterval(pollInterval);
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
        if (pollInterval) {
          clearInterval(pollInterval);
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
