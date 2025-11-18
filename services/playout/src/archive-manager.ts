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
      // Verify source file exists before attempting to archive
      try {
        await fs.access(segmentPath);
      } catch (error) {
        logger.warn('Segment file does not exist, skipping archive', { 
          segmentPath,
          segmentId 
        });
        return;
      }

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
      logger.error('Failed to archive segment', { 
        error: error instanceof Error ? error.message : String(error),
        segmentPath,
        segmentId 
      });
      // Don't re-throw - archiving is not critical for live streaming
    }
  }

  /**
   * Get archived segments for a time range
   * Returns segments sorted by timestamp in ascending order
   * 
   * @param startTime - Start of time range
   * @param endTime - End of time range
   * @param limit - Optional maximum number of segments to return
   * @param offset - Optional number of segments to skip
   */
  async getSegmentsForTimeRange(
    startTime: Date,
    endTime: Date,
    limit?: number,
    offset?: number
  ): Promise<ArchiveIndex[]> {
    try {
      // Filter segments by time range
      let filtered = this.index.filter((entry) => {
        const entryTime = new Date(entry.timestamp);
        return entryTime >= startTime && entryTime <= endTime;
      });

      // Sort by timestamp in ascending order
      filtered.sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // Apply pagination if specified
      if (offset !== undefined && offset > 0) {
        filtered = filtered.slice(offset);
      }

      if (limit !== undefined && limit > 0) {
        filtered = filtered.slice(0, limit);
      }

      return filtered;
    } catch (error) {
      logger.error('Failed to get segments for time range', { 
        error, 
        startTime: startTime.toISOString(), 
        endTime: endTime.toISOString() 
      });
      return [];
    }
  }

  /**
   * Get archived segments starting at a specific timestamp
   * Returns segments sorted by timestamp in ascending order
   * 
   * @param timestamp - Start timestamp
   * @param durationMinutes - Duration in minutes (default: 60)
   * @param limit - Optional maximum number of segments to return
   * @param offset - Optional number of segments to skip
   */
  async getSegmentsFromTimestamp(
    timestamp: Date,
    durationMinutes: number = 60,
    limit?: number,
    offset?: number
  ): Promise<ArchiveIndex[]> {
    const endTime = new Date(timestamp.getTime() + durationMinutes * 60 * 1000);
    return this.getSegmentsForTimeRange(timestamp, endTime, limit, offset);
  }

  /**
   * Get archived segments for a specific show on a date
   * Returns segments sorted by timestamp in ascending order
   * 
   * @param showId - Show identifier
   * @param date - Date to filter by
   * @param limit - Optional maximum number of segments to return
   * @param offset - Optional number of segments to skip
   */
  async getSegmentsForShow(
    showId: string,
    date: Date,
    limit?: number,
    offset?: number
  ): Promise<ArchiveIndex[]> {
    try {
      let filtered = this.index.filter((entry) => {
        const entryDate = new Date(entry.timestamp);
        return (
          entry.showId === showId &&
          entryDate.getUTCFullYear() === date.getUTCFullYear() &&
          entryDate.getUTCMonth() === date.getUTCMonth() &&
          entryDate.getUTCDate() === date.getUTCDate()
        );
      });

      // Sort by timestamp in ascending order
      filtered.sort((a, b) => {
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });

      // Apply pagination if specified
      if (offset !== undefined && offset > 0) {
        filtered = filtered.slice(offset);
      }

      if (limit !== undefined && limit > 0) {
        filtered = filtered.slice(0, limit);
      }

      return filtered;
    } catch (error) {
      logger.error('Failed to get segments for show', { 
        error, 
        showId, 
        date: date.toISOString() 
      });
      return [];
    }
  }

  /**
   * Clean up old archived segments based on retention policy
   * Uses parallel deletion with concurrency control for efficiency
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

      if (toDelete.length === 0) {
        logger.info('No archived segments to delete');
        return;
      }

      // Delete old segments in parallel with concurrency control
      const CONCURRENCY_LIMIT = 10; // Process 10 deletions at a time
      let deletedCount = 0;
      let failedCount = 0;

      // Process deletions in batches
      for (let i = 0; i < toDelete.length; i += CONCURRENCY_LIMIT) {
        const batch = toDelete.slice(i, i + CONCURRENCY_LIMIT);
        
        const results = await Promise.allSettled(
          batch.map(async (entry) => {
            try {
              await fs.unlink(entry.segmentPath);
              return { success: true, entry };
            } catch (error) {
              logger.warn('Failed to delete archived segment', {
                path: entry.segmentPath,
                error: error instanceof Error ? error.message : String(error),
              });
              return { success: false, entry };
            }
          })
        );

        // Count successes and failures
        for (const result of results) {
          if (result.status === 'fulfilled' && result.value.success) {
            deletedCount++;
          } else {
            failedCount++;
          }
        }
      }

      // Update index with segments that were successfully deleted
      // Keep segments that failed to delete so we can retry later
      const deletedPaths = new Set(
        toDelete.slice(0, deletedCount).map(entry => entry.segmentPath)
      );
      
      this.index = this.index.filter(
        entry => !deletedPaths.has(entry.segmentPath)
      );

      await this.saveIndex();

      logger.info('Archive cleanup completed', {
        deletedCount,
        failedCount,
        remainingCount: this.index.length,
      });

      // Clean up empty directories
      await this.cleanupEmptyDirectories();
    } catch (error) {
      logger.error('Failed to cleanup old archives', { 
        error: error instanceof Error ? error.message : String(error) 
      });
    }
  }

  /**
   * Clean up empty archive directories after deletion
   */
  private async cleanupEmptyDirectories(): Promise<void> {
    try {
      // Get all unique directory paths from the archive
      const years = await fs.readdir(this.config.archiveOutputPath);
      
      for (const year of years) {
        if (year === 'archive-index.json') continue;
        
        const yearPath = path.join(this.config.archiveOutputPath, year);
        const yearStat = await fs.stat(yearPath);
        
        if (!yearStat.isDirectory()) continue;
        
        const months = await fs.readdir(yearPath);
        
        for (const month of months) {
          const monthPath = path.join(yearPath, month);
          const monthStat = await fs.stat(monthPath);
          
          if (!monthStat.isDirectory()) continue;
          
          const days = await fs.readdir(monthPath);
          
          for (const day of days) {
            const dayPath = path.join(monthPath, day);
            const dayStat = await fs.stat(dayPath);
            
            if (!dayStat.isDirectory()) continue;
            
            const hours = await fs.readdir(dayPath);
            
            for (const hour of hours) {
              const hourPath = path.join(dayPath, hour);
              const hourStat = await fs.stat(hourPath);
              
              if (!hourStat.isDirectory()) continue;
              
              // Check if hour directory is empty
              const hourFiles = await fs.readdir(hourPath);
              if (hourFiles.length === 0) {
                await fs.rmdir(hourPath);
                logger.debug('Removed empty directory', { path: hourPath });
              }
            }
            
            // Check if day directory is empty
            const dayFiles = await fs.readdir(dayPath);
            if (dayFiles.length === 0) {
              await fs.rmdir(dayPath);
              logger.debug('Removed empty directory', { path: dayPath });
            }
          }
          
          // Check if month directory is empty
          const monthFiles = await fs.readdir(monthPath);
          if (monthFiles.length === 0) {
            await fs.rmdir(monthPath);
            logger.debug('Removed empty directory', { path: monthPath });
          }
        }
        
        // Check if year directory is empty
        const yearFiles = await fs.readdir(yearPath);
        if (yearFiles.length === 0) {
          await fs.rmdir(yearPath);
          logger.debug('Removed empty directory', { path: yearPath });
        }
      }
    } catch (error) {
      logger.warn('Failed to cleanup empty directories', { 
        error: error instanceof Error ? error.message : String(error) 
      });
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
      logger.error('Failed to save archive index', { 
        error: error instanceof Error ? error.message : String(error),
        path: this.archiveIndexPath 
      });
      // Don't re-throw - we can try to save again on next update
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

    // Process stats in parallel with concurrency control
    const CONCURRENCY_LIMIT = 20;
    const statResults = new Map<string, number>();

    for (let i = 0; i < this.index.length; i += CONCURRENCY_LIMIT) {
      const batch = this.index.slice(i, i + CONCURRENCY_LIMIT);
      
      const results = await Promise.allSettled(
        batch.map(async (entry) => {
          try {
            const stats = await fs.stat(entry.segmentPath);
            return { path: entry.segmentPath, size: stats.size };
          } catch (error) {
            // Segment file may have been deleted or moved
            logger.debug('Failed to stat archived segment', { 
              path: entry.segmentPath 
            });
            return { path: entry.segmentPath, size: 0 };
          }
        })
      );

      for (const result of results) {
        if (result.status === 'fulfilled') {
          statResults.set(result.value.path, result.value.size);
        }
      }
    }

    // Sum up all sizes
    for (const size of statResults.values()) {
      totalSize += size;
    }

    // Sort index by timestamp to find oldest and newest
    const sortedIndex = [...this.index].sort((a, b) => {
      return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
    });

    return {
      totalSegments: this.index.length,
      oldestSegment:
        sortedIndex.length > 0
          ? sortedIndex[0].timestamp
          : null,
      newestSegment:
        sortedIndex.length > 0
          ? sortedIndex[sortedIndex.length - 1].timestamp
          : null,
      totalSizeBytes: totalSize,
    };
  }
}
