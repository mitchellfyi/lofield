/**
 * Archive Manager
 * 
 * Handles archiving of HLS segments for time-shift playback
 */

import { promises as fs } from 'fs';
import path from 'path';
import logger from './logger';
import type { PlayoutConfig, ArchiveIndex } from './types';

export class ArchiveManager {
  private config: PlayoutConfig;
  private archiveIndexPath: string;
  private index: ArchiveIndex[] = [];

  constructor(config: PlayoutConfig) {
    this.config = config;
    this.archiveIndexPath = path.join(
      config.archiveOutputPath,
      'archive-index.json'
    );
  }

  /**
   * Initialize archive directory and load index
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.archiveOutputPath, { recursive: true });
      logger.info('Archive directory initialized', {
        path: this.config.archiveOutputPath,
      });

      // Load existing index if it exists
      try {
        const indexData = await fs.readFile(this.archiveIndexPath, 'utf-8');
        this.index = JSON.parse(indexData);
        logger.info('Loaded archive index', { entries: this.index.length });
      } catch (error) {
        // Index doesn't exist yet, start fresh
        this.index = [];
        await this.saveIndex();
        logger.info('Created new archive index');
      }
    } catch (error) {
      logger.error('Failed to initialize archive directory', { error });
      throw error;
    }
  }

  /**
   * Archive an HLS segment
   * Copies the segment to archive storage and updates the index
   */
  async archiveSegment(
    segmentPath: string,
    timestamp: Date,
    duration: number,
    showId: string,
    segmentType: string,
    segmentId: string,
    trackId?: string
  ): Promise<void> {
    try {
      // Create archive path based on timestamp: YYYY/MM/DD/HH/
      const date = new Date(timestamp);
      const year = date.getUTCFullYear();
      const month = String(date.getUTCMonth() + 1).padStart(2, '0');
      const day = String(date.getUTCDate()).padStart(2, '0');
      const hour = String(date.getUTCHours()).padStart(2, '0');

      const archiveDir = path.join(
        this.config.archiveOutputPath,
        String(year),
        month,
        day,
        hour
      );

      await fs.mkdir(archiveDir, { recursive: true });

      // Create unique filename based on timestamp
      const filename = `${segmentType}_${timestamp.getTime()}.ts`;
      const archivePath = path.join(archiveDir, filename);

      // Copy segment to archive
      await fs.copyFile(segmentPath, archivePath);

      // Add to index
      const indexEntry: ArchiveIndex = {
        timestamp: timestamp.toISOString(),
        segmentPath: archivePath,
        duration,
        showId,
        segmentType,
        segmentId,
        ...(trackId && { trackId }),
      };

      this.index.push(indexEntry);
      await this.saveIndex();

      logger.debug('Archived segment', {
        segmentId,
        archivePath,
        timestamp: timestamp.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to archive segment', { error, segmentPath });
    }
  }

  /**
   * Get archived segments for a time range
   */
  async getSegmentsForTimeRange(
    startTime: Date,
    endTime: Date
  ): Promise<ArchiveIndex[]> {
    return this.index.filter((entry) => {
      const entryTime = new Date(entry.timestamp);
      return entryTime >= startTime && entryTime <= endTime;
    });
  }

  /**
   * Get archived segments starting at a specific timestamp
   */
  async getSegmentsFromTimestamp(
    timestamp: Date,
    durationMinutes: number = 60
  ): Promise<ArchiveIndex[]> {
    const endTime = new Date(timestamp.getTime() + durationMinutes * 60 * 1000);
    return this.getSegmentsForTimeRange(timestamp, endTime);
  }

  /**
   * Get archived segments for a specific show on a date
   */
  async getSegmentsForShow(
    showId: string,
    date: Date
  ): Promise<ArchiveIndex[]> {
    return this.index.filter((entry) => {
      const entryDate = new Date(entry.timestamp);
      return (
        entry.showId === showId &&
        entryDate.getUTCFullYear() === date.getUTCFullYear() &&
        entryDate.getUTCMonth() === date.getUTCMonth() &&
        entryDate.getUTCDate() === date.getUTCDate()
      );
    });
  }

  /**
   * Clean up old archived segments based on retention policy
   */
  async cleanupOldArchives(): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.archiveRetentionDays);

      logger.info('Starting archive cleanup', {
        retentionDays: this.config.archiveRetentionDays,
        cutoffDate: cutoffDate.toISOString(),
      });

      const toDelete: ArchiveIndex[] = [];
      const toKeep: ArchiveIndex[] = [];

      for (const entry of this.index) {
        const entryDate = new Date(entry.timestamp);
        if (entryDate < cutoffDate) {
          toDelete.push(entry);
        } else {
          toKeep.push(entry);
        }
      }

      // Delete old segments
      let deletedCount = 0;
      for (const entry of toDelete) {
        try {
          await fs.unlink(entry.segmentPath);
          deletedCount++;
        } catch (error) {
          logger.warn('Failed to delete archived segment', {
            path: entry.segmentPath,
            error,
          });
        }
      }

      // Update index
      this.index = toKeep;
      await this.saveIndex();

      logger.info('Archive cleanup completed', {
        deletedCount,
        remainingCount: toKeep.length,
      });
    } catch (error) {
      logger.error('Failed to cleanup old archives', { error });
    }
  }

  /**
   * Save the archive index to disk
   */
  private async saveIndex(): Promise<void> {
    try {
      await fs.writeFile(
        this.archiveIndexPath,
        JSON.stringify(this.index, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to save archive index', { error });
    }
  }

  /**
   * Get archive statistics
   */
  async getStats(): Promise<{
    totalSegments: number;
    oldestSegment: string | null;
    newestSegment: string | null;
    totalSizeBytes: number;
  }> {
    let totalSize = 0;

    for (const entry of this.index) {
      try {
        const stats = await fs.stat(entry.segmentPath);
        totalSize += stats.size;
      } catch (error) {
        // Segment file may have been deleted
      }
    }

    return {
      totalSegments: this.index.length,
      oldestSegment:
        this.index.length > 0
          ? this.index[0].timestamp
          : null,
      newestSegment:
        this.index.length > 0
          ? this.index[this.index.length - 1].timestamp
          : null,
      totalSizeBytes: totalSize,
    };
  }
}
