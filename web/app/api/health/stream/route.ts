import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { prisma } from "@/lib/db";

/**
 * GET /api/health/stream
 * 
 * Returns health status of the streaming infrastructure
 */
export async function GET(request: NextRequest) {
  try {
    const streamPath =
      process.env.STREAM_OUTPUT_PATH || "/var/lofield/stream";
    const archivePath =
      process.env.ARCHIVE_OUTPUT_PATH || "/var/lofield/archive";

    // Check if live manifest exists
    let liveStreamAge = -1;
    let playoutService = "stopped";

    try {
      const manifestPath = path.join(streamPath, "live.m3u8");
      const stats = await fs.stat(manifestPath);
      const ageMs = Date.now() - stats.mtimeMs;
      liveStreamAge = Math.floor(ageMs / 1000);
      playoutService = liveStreamAge < 60 ? "running" : "stale";
    } catch {
      playoutService = "stopped";
    }

    // Get queue depth
    const now = new Date();
    const futureTime = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour ahead

    const queuedSegments = await prisma.segment.count({
      where: {
        startTime: {
          gte: now,
          lte: futureTime,
        },
      },
    });

    // Get last segment time
    const lastSegment = await prisma.segment.findFirst({
      where: {
        endTime: {
          lte: now,
        },
      },
      orderBy: {
        endTime: "desc",
      },
      select: {
        endTime: true,
      },
    });

    // Check archive storage
    let archiveStorage = {
      available: "unknown",
      used: "unknown",
    };

    try {
      const indexPath = path.join(archivePath, "archive-index.json");
      const indexData = await fs.readFile(indexPath, "utf-8");
      const archiveIndex = JSON.parse(indexData);
      
      let totalSize = 0;
      for (const entry of archiveIndex.slice(0, 100)) {
        // Sample first 100
        try {
          const stats = await fs.stat(entry.segmentPath);
          totalSize += stats.size;
        } catch {
          // Skip missing files
        }
      }

      // Estimate total size based on sample
      const estimatedTotal = Math.floor(
        (totalSize / Math.min(100, archiveIndex.length)) * archiveIndex.length
      );
      archiveStorage.used = formatBytes(estimatedTotal);
    } catch {
      // Archive not initialized yet
    }

    // Determine overall status
    let status = "healthy";
    if (playoutService === "stopped" || queuedSegments < 5) {
      status = "degraded";
    }
    if (playoutService === "stopped" && queuedSegments === 0) {
      status = "unhealthy";
    }

    return NextResponse.json({
      status,
      playoutService,
      liveStreamAge,
      queueDepth: queuedSegments,
      lastSegmentAt: lastSegment?.endTime.toISOString() || null,
      archiveStorage,
    });
  } catch (error) {
    console.error("Error checking stream health:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to check stream health",
      },
      { status: 500 }
    );
  }
}

/**
 * Format bytes to human-readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";

  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
}
