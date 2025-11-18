/**
 * Archiving Module
 * 
 * Records segments into hour-long archive files and maintains
 * an index for time-shifted listening and show episode assembly.
 */

import * as fs from "fs/promises";
import * as fsSync from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import logger from "./logger";
import type { ArchiveIndex, QueuedSegment } from "./types";

// Allow prisma to be undefined for testing
let prisma: PrismaClient | undefined;

try {
  prisma = new PrismaClient();
} catch (error) {
  // Prisma not initialized (e.g., in test environment without database)
  logger.warn("Prisma client not initialized - database operations will fail");
}

// In-memory index (in production, this would be persisted to database or file)
const archiveIndex: ArchiveIndex[] = [];

/**
 * Get the archive file path for a given hour
 */
async function getArchiveFilePath(date: Date, archivePath: string): Promise<string> {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hour = String(date.getUTCHours()).padStart(2, "0");

  const filename = `lofield_${year}${month}${day}_${hour}00.mp3`;
  const dirPath = path.join(archivePath, year.toString(), month);

  // Ensure directory exists
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }

  return path.join(dirPath, filename);
}

/**
 * Record a segment into the archive
 */
export async function recordSegmentToArchive(
  segment: QueuedSegment,
  archivePath: string
): Promise<void> {
  try {
    const archiveFile = await getArchiveFilePath(segment.startTime, archivePath);

    // Read the segment audio file
    try {
      await fs.access(segment.filePath);
    } catch {
      logger.warn(
        `Segment file not found: ${segment.filePath}, skipping archive`
      );
      return;
    }

    const segmentData = await fs.readFile(segment.filePath);

    // Get current archive file size to calculate offset
    let offset = 0;
    try {
      const stats = await fs.stat(archiveFile);
      offset = stats.size;
    } catch {
      // File doesn't exist yet, offset is 0
    }

    // Append segment to archive file
    await fs.appendFile(archiveFile, segmentData);

    // Calculate duration in seconds
    const duration =
      (segment.endTime.getTime() - segment.startTime.getTime()) / 1000;

    // Add to index
    const indexEntry: ArchiveIndex = {
      segmentId: segment.id,
      filePath: archiveFile,
      offset,
      duration,
      startTime: segment.startTime,
      endTime: segment.endTime,
      showId: segment.showId,
      type: segment.type,
    };

    archiveIndex.push(indexEntry);

    logger.debug(
      `Archived segment ${segment.id} to ${archiveFile} at offset ${offset}`
    );
  } catch (error) {
    logger.error({ err: error, segmentId: segment.id }, `Error archiving segment ${segment.id}`);
    throw error;
  }
}

/**
 * Get archived segments for a time range
 */
export function getArchivedSegments(
  startTime: Date,
  endTime: Date
): ArchiveIndex[] {
  return archiveIndex.filter(
    (entry) => entry.startTime >= startTime && entry.endTime <= endTime
  );
}

/**
 * Assemble an on-demand episode for a specific show
 */
export async function assembleShowEpisode(
  showId: string,
  date: Date,
  outputPath: string
): Promise<string> {
  if (!prisma) {
    throw new Error("Prisma client not initialized");
  }

  try {
    logger.info(`Assembling episode for show ${showId} on ${date.toISOString()}`);

    // Get show from database
    const show = await prisma.show.findUnique({
      where: { id: showId },
    });

    if (!show) {
      throw new Error(`Show ${showId} not found`);
    }

    // Calculate show time range for the given date
    const startTime = new Date(date);
    startTime.setUTCHours(show.startHour, 0, 0, 0);

    const endTime = new Date(startTime);
    endTime.setUTCHours(endTime.getUTCHours() + show.durationHours);

    // Get all archived segments for this show and time range
    const segments = getArchivedSegments(startTime, endTime).filter(
      (entry) => entry.showId === showId
    );

    if (segments.length === 0) {
      throw new Error(`No archived segments found for show ${showId} on ${date.toISOString()}`);
    }

    // Create output filename
    const dateStr = date.toISOString().split("T")[0];
    const filename = `${showId}_${dateStr}.mp3`;
    const outputFile = path.join(outputPath, filename);

    // Ensure output directory exists
    const dir = path.dirname(outputFile);
    try {
      await fs.access(dir);
    } catch {
      await fs.mkdir(dir, { recursive: true });
    }

    // Assemble episode by streaming segment data
    const { createWriteStream, createReadStream } = await import("fs");
    const writeStream = createWriteStream(outputFile);

    for (const segment of segments) {
      // Use streaming to read only the segment portion we need
      const archiveFile = await fs.open(segment.filePath, "r");
      
      try {
        // Calculate estimated segment size in bytes
        // MP3 bitrate is typically ~128kbps = 16KB/s
        const estimatedBytes = Math.ceil(segment.duration * 16 * 1024);
        
        // Create a buffer for the segment
        const buffer = Buffer.allocUnsafe(estimatedBytes);
        const { bytesRead } = await archiveFile.read(
          buffer,
          0,
          estimatedBytes,
          segment.offset
        );
        
        // Write the actual bytes read to the output stream
        await new Promise<void>((resolve, reject) => {
          writeStream.write(buffer.slice(0, bytesRead), (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      } finally {
        await archiveFile.close();
      }
    }

    // Close the write stream
    await new Promise<void>((resolve, reject) => {
      writeStream.end((err?: Error) => {
        if (err) reject(err);
        else resolve();
      });
    });

    logger.info(`Episode assembled: ${outputFile}`);
    return outputFile;
  } catch (error) {
    logger.error({ err: error, showId }, `Error assembling episode for show ${showId}`);
    throw error;
  }
}

/**
 * Get segment at a specific timestamp
 */
export function getSegmentAtTime(timestamp: Date): ArchiveIndex | null {
  return (
    archiveIndex.find(
      (entry) => timestamp >= entry.startTime && timestamp < entry.endTime
    ) || null
  );
}

/**
 * Clean up old archive files
 */
export async function cleanupOldArchives(
  archivePath: string,
  retentionDays: number
): Promise<number> {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

  let deletedCount = 0;

  // Remove old entries from index
  const indicesToRemove: number[] = [];
  archiveIndex.forEach((entry, index) => {
    if (entry.startTime < cutoffDate) {
      indicesToRemove.push(index);
    }
  });

  // Remove in reverse order to maintain indices
  indicesToRemove.reverse().forEach((index) => {
    archiveIndex.splice(index, 1);
    deletedCount++;
  });

  logger.info(
    `Cleaned up ${deletedCount} archive entries older than ${retentionDays} days`
  );

  // In production, you would also delete the actual archive files
  // This requires careful logic to avoid deleting files still in use

  return deletedCount;
}

/**
 * Get archive statistics
 */
export function getArchiveStats(): {
  totalSegments: number;
  totalDurationHours: number;
  oldestSegment?: Date;
  newestSegment?: Date;
  sizeByShow: Record<string, number>;
} {
  const stats = {
    totalSegments: archiveIndex.length,
    totalDurationHours: 0,
    oldestSegment: archiveIndex[0]?.startTime,
    newestSegment: archiveIndex[archiveIndex.length - 1]?.endTime,
    sizeByShow: {} as Record<string, number>,
  };

  archiveIndex.forEach((entry) => {
    stats.totalDurationHours += entry.duration / 3600;
    stats.sizeByShow[entry.showId] = (stats.sizeByShow[entry.showId] || 0) + 1;
  });

  return stats;
}

export { archiveIndex };
