/**
 * Queue Management Module
 *
 * Manages the queue of upcoming segments with metadata tracking,
 * monitors queue depth, and triggers content generation when needed.
 */

import { PrismaClient } from "@prisma/client";
import type { QueuedSegment, SchedulerConfig } from "./types";

// Allow prisma to be undefined for testing
let prisma: PrismaClient | undefined;

try {
  prisma = new PrismaClient();
} catch (error) {
  // Prisma not initialized (e.g., in test environment without database)
  console.warn("Prisma client not initialized - database operations will fail");
}

/**
 * Get queued segments within a time window
 */
export async function getQueuedSegments(
  startTime: Date,
  endTime: Date
): Promise<QueuedSegment[]> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }
  const segments = await prisma.segment.findMany({
    where: {
      startTime: {
        gte: startTime,
        lte: endTime,
      },
    },
    orderBy: {
      startTime: "asc",
    },
  });

  return segments.map(
    (seg: any): QueuedSegment => ({
      id: seg.id,
      showId: seg.showId,
      type: seg.type as "music" | "talk" | "ident" | "handover",
      filePath: seg.filePath,
      startTime: seg.startTime,
      endTime: seg.endTime,
      requestId: seg.requestId ?? undefined,
      trackId: seg.trackId ?? undefined,
      metadata: seg.metadata ? JSON.parse(seg.metadata) : undefined,
    })
  );
}

/**
 * Calculate total duration of queued segments in minutes
 */
export function calculateQueuedMinutes(segments: QueuedSegment[]): number {
  return segments.reduce((total, segment) => {
    const duration =
      (segment.endTime.getTime() - segment.startTime.getTime()) / 60000;
    return total + duration;
  }, 0);
}

/**
 * Check if queue needs replenishment
 */
export async function needsReplenishment(config: SchedulerConfig): Promise<{
  needed: boolean;
  currentMinutes: number;
  targetMinutes: number;
  minutesNeeded: number;
}> {
  const now = new Date();
  const bufferTime = new Date(now.getTime() + config.bufferMinutes * 60000);

  const queuedSegments = await getQueuedSegments(now, bufferTime);
  const currentMinutes = calculateQueuedMinutes(queuedSegments);
  const targetMinutes = config.minQueueDepthMinutes;
  const minutesNeeded = Math.max(0, targetMinutes - currentMinutes);

  return {
    needed: currentMinutes < targetMinutes,
    currentMinutes,
    targetMinutes,
    minutesNeeded,
  };
}

/**
 * Get the next available slot time for a new segment
 */
export async function getNextAvailableSlot(): Promise<Date> {
  const now = new Date();

  // Get the last scheduled segment
  const lastSegment = await prisma.segment.findFirst({
    where: {
      startTime: {
        gte: now,
      },
    },
    orderBy: {
      endTime: "desc",
    },
  });

  if (!lastSegment) {
    // No segments in queue, start immediately
    return now;
  }

  // Return the end time of the last segment
  return lastSegment.endTime;
}

/**
 * Create a segment in the database
 */
export async function createSegment(segment: {
  showId: string;
  type: "music" | "talk" | "ident" | "handover";
  filePath: string;
  startTime: Date;
  endTime: Date;
  requestId?: string;
  trackId?: string;
  metadata?: Record<string, unknown>;
}): Promise<string> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  const created = await prisma.segment.create({
    data: {
      showId: segment.showId,
      type: segment.type,
      filePath: segment.filePath,
      startTime: segment.startTime,
      endTime: segment.endTime,
      requestId: segment.requestId ?? null,
      trackId: segment.trackId ?? null,
      metadata: segment.metadata ? JSON.stringify(segment.metadata) : null,
    },
  });

  return created.id;
}

/**
 * Create a track record in the database
 */
export async function createTrack(track: {
  requestId?: string;
  filePath: string;
  title: string;
  artist: string;
  lengthSeconds: number;
}): Promise<string> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  const created = await prisma.track.create({
    data: {
      requestId: track.requestId ?? null,
      filePath: track.filePath,
      title: track.title,
      artist: track.artist,
      lengthSeconds: track.lengthSeconds,
    },
  });

  return created.id;
}

/**
 * Mark a request as used
 */
export async function markRequestAsUsed(requestId: string): Promise<void> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  await prisma.request.update({
    where: { id: requestId },
    data: {
      status: "used",
      usedAt: new Date(),
    },
  });
}

/**
 * Get top-voted pending requests
 */
export async function getTopRequests(limit: number = 10) {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  return await prisma.request.findMany({
    where: {
      status: "pending",
      moderationStatus: "approved",
    },
    orderBy: {
      votes: "desc",
    },
    take: limit,
  });
}

/**
 * Get queue statistics
 */
export async function getQueueStats(bufferMinutes: number): Promise<{
  totalSegments: number;
  totalMinutes: number;
  segmentsByType: Record<string, number>;
  oldestSegmentTime?: Date;
  newestSegmentTime?: Date;
}> {
  const now = new Date();
  const bufferTime = new Date(now.getTime() + bufferMinutes * 60000);

  const segments = await getQueuedSegments(now, bufferTime);

  const stats = {
    totalSegments: segments.length,
    totalMinutes: calculateQueuedMinutes(segments),
    segmentsByType: {} as Record<string, number>,
    oldestSegmentTime: segments[0]?.startTime,
    newestSegmentTime: segments[segments.length - 1]?.endTime,
  };

  segments.forEach((seg) => {
    stats.segmentsByType[seg.type] = (stats.segmentsByType[seg.type] || 0) + 1;
  });

  return stats;
}

/**
 * Delete old segments from the queue (cleanup)
 */
export async function cleanupOldSegments(beforeDate: Date): Promise<number> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  const result = await prisma.segment.deleteMany({
    where: {
      endTime: {
        lt: beforeDate,
      },
    },
  });

  return result.count;
}

export { prisma };
