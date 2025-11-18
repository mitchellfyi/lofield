/**
 * Main Playout Service
 * 
 * Orchestrates HLS streaming and archiving
 */

import { PrismaClient } from '@prisma/client';
import logger from './logger';
import { HLSStreamManager } from './hls-manager';
import { ArchiveManager } from './archive-manager';
import type { PlayoutConfig, SegmentInfo } from './types';

const prisma = new PrismaClient();

export class PlayoutService {
  private config: PlayoutConfig;
  private hlsManager: HLSStreamManager;
  private archiveManager: ArchiveManager;
  private isRunning = false;
  private lastProcessedTime: Date | null = null;

  constructor(config: PlayoutConfig) {
    this.config = config;
    this.hlsManager = new HLSStreamManager(config);
    this.archiveManager = new ArchiveManager(config);
  }

  /**
   * Start the playout service
   */
  async start(): Promise<void> {
    logger.info('Starting Lofield FM Playout Service...');
    logger.info('Configuration', {
      streamPath: this.config.streamOutputPath,
      archivePath: this.config.archiveOutputPath,
      pollInterval: this.config.pollInterval,
    });

    // Initialize managers
    await this.hlsManager.initialize();
    await this.archiveManager.initialize();

    this.isRunning = true;
    this.lastProcessedTime = new Date();

    // Start main loop
    await this.mainLoop();
  }

  /**
   * Stop the playout service
   */
  async stop(): Promise<void> {
    logger.info('Stopping playout service...');
    this.isRunning = false;
    await this.hlsManager.stopStream();
    await prisma.$disconnect();
  }

  /**
   * Main processing loop
   */
  private async mainLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.processPendingSegments();
      } catch (error) {
        logger.error('Error in main loop', { error });
      }

      // Wait before next iteration
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.pollInterval * 1000)
      );
    }
  }

  /**
   * Process pending segments from the database
   */
  private async processPendingSegments(): Promise<void> {
    try {
      const now = new Date();
      
      // Query for segments that should be playing now or soon
      // We look ahead by the HLS list size * segment duration to ensure smooth playback
      const lookAheadMs =
        this.config.hlsListSize * this.config.hlsSegmentDuration * 1000;
      const endTime = new Date(now.getTime() + lookAheadMs);

      const segments = await prisma.segment.findMany({
        where: {
          startTime: {
            gte: this.lastProcessedTime || now,
            lte: endTime,
          },
          filePath: {
            not: null,
          },
        },
        include: {
          show: true,
          track: true,
        },
        orderBy: {
          startTime: 'asc',
        },
      });

      if (segments.length === 0) {
        logger.debug('No pending segments to process');
        return;
      }

      logger.info('Processing segments', { count: segments.length });

      // Convert to SegmentInfo format
      const segmentInfos: SegmentInfo[] = segments.map((seg: any) => ({
        id: seg.id,
        filePath: seg.filePath!,
        type: seg.type as 'music' | 'talk' | 'ident' | 'handover',
        startTime: seg.startTime,
        endTime: seg.endTime,
        showId: seg.showId,
        trackId: seg.trackId || undefined,
        requestId: seg.requestId || undefined,
      }));

      // Start/update HLS stream
      if (!this.hlsManager.isStreaming()) {
        await this.hlsManager.startStream(segmentInfos);
      }

      // Archive segments that are currently playing
      for (const segment of segmentInfos) {
        if (segment.startTime <= now && segment.endTime >= now) {
          try {
            // This segment is currently playing, archive it
            const duration =
              (segment.endTime.getTime() - segment.startTime.getTime()) / 1000;

            await this.archiveManager.archiveSegment(
              segment.filePath,
              segment.startTime,
              duration,
              segment.showId,
              segment.type,
              segment.id,
              segment.trackId
            );
          } catch (error) {
            logger.error('Failed to archive segment, continuing with next', { 
              error: error instanceof Error ? error.message : String(error),
              segmentId: segment.id 
            });
            // Continue with next segment - archiving failure shouldn't stop playback
          }
        }
      }

      // Update last processed time
      if (segments.length > 0) {
        this.lastProcessedTime = segments[segments.length - 1].endTime;
      }
    } catch (error) {
      logger.error('Failed to process pending segments', { 
        error: error instanceof Error ? error.message : String(error) 
      });
      // Don't re-throw - let the main loop continue
    }
  }

  /**
   * Get health status
   */
  async getHealth(): Promise<{
    status: string;
    isStreaming: boolean;
    lastProcessedTime: string | null;
    archiveStats: {
      totalSegments: number;
      oldestSegment: string | null;
      newestSegment: string | null;
      totalSizeBytes: number;
    };
  }> {
    const archiveStats = await this.archiveManager.getStats();

    return {
      status: this.isRunning ? 'running' : 'stopped',
      isStreaming: this.hlsManager.isStreaming(),
      lastProcessedTime: this.lastProcessedTime?.toISOString() || null,
      archiveStats,
    };
  }

  /**
   * Run archive cleanup
   */
  async runArchiveCleanup(): Promise<void> {
    logger.info('Running archive cleanup...');
    await this.archiveManager.cleanupOldArchives();
  }

  /**
   * Get archive manager (for API access)
   */
  getArchiveManager(): ArchiveManager {
    return this.archiveManager;
  }
}
