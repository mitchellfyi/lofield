/**
 * Tests for Archive Manager
 */

import { ArchiveManager } from '../archive-manager';
import type { PlayoutConfig } from '../types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock logger to suppress output during tests
jest.mock('../logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

describe('ArchiveManager', () => {
  let archiveManager: ArchiveManager;
  let testArchivePath: string;
  let config: PlayoutConfig;

  beforeEach(async () => {
    // Create a temporary test directory
    testArchivePath = path.join('/tmp', `archive-test-${Date.now()}`);
    
    config = {
      streamOutputPath: '/tmp/stream-test',
      archiveOutputPath: testArchivePath,
      hlsSegmentDuration: 6,
      hlsListSize: 10,
      crossfadeMusicToMusic: 2.0,
      crossfadeMusicToTalk: 1.0,
      crossfadeTalkToMusic: 0.5,
      audioBitrate: '128k',
      audioSampleRate: 48000,
      pollInterval: 5,
      archiveRetentionDays: 30,
    };

    archiveManager = new ArchiveManager(config);
    await archiveManager.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testArchivePath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getSegmentsForTimeRange', () => {
    it('should return segments sorted by timestamp', async () => {
      // Add segments in random order
      const now = new Date('2024-01-15T14:00:00Z');
      
      // Create actual test files
      const seg1Path = path.join(testArchivePath, 'segment-1.ts');
      const seg2Path = path.join(testArchivePath, 'segment-2.ts');
      const seg3Path = path.join(testArchivePath, 'segment-3.ts');
      
      await fs.writeFile(seg1Path, 'test data 1');
      await fs.writeFile(seg2Path, 'test data 2');
      await fs.writeFile(seg3Path, 'test data 3');
      
      await archiveManager.archiveSegment(
        seg3Path,
        new Date(now.getTime() + 120000), // +2 minutes
        6,
        'test-show',
        'music',
        'seg-3'
      );

      await archiveManager.archiveSegment(
        seg1Path,
        new Date(now.getTime()), // base time
        6,
        'test-show',
        'music',
        'seg-1'
      );

      await archiveManager.archiveSegment(
        seg2Path,
        new Date(now.getTime() + 60000), // +1 minute
        6,
        'test-show',
        'talk',
        'seg-2'
      );

      const segments = await archiveManager.getSegmentsForTimeRange(
        new Date(now.getTime() - 60000),
        new Date(now.getTime() + 180000)
      );

      // Should return 3 segments in chronological order
      expect(segments).toHaveLength(3);
      expect(segments[0].segmentId).toBe('seg-1');
      expect(segments[1].segmentId).toBe('seg-2');
      expect(segments[2].segmentId).toBe('seg-3');

      // Verify timestamps are in ascending order
      for (let i = 1; i < segments.length; i++) {
        const prevTime = new Date(segments[i - 1].timestamp).getTime();
        const currTime = new Date(segments[i].timestamp).getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should support pagination with limit', async () => {
      const now = new Date('2024-01-15T14:00:00Z');

      // Add 5 segments
      for (let i = 0; i < 5; i++) {
        const segPath = path.join(testArchivePath, `segment-${i}.ts`);
        await fs.writeFile(segPath, `test data ${i}`);
        
        await archiveManager.archiveSegment(
          segPath,
          new Date(now.getTime() + i * 60000),
          6,
          'test-show',
          'music',
          `seg-${i}`
        );
      }

      const segments = await archiveManager.getSegmentsForTimeRange(
        new Date(now.getTime() - 60000),
        new Date(now.getTime() + 600000),
        2 // limit to 2 segments
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].segmentId).toBe('seg-0');
      expect(segments[1].segmentId).toBe('seg-1');
    });

    it('should support pagination with offset', async () => {
      const now = new Date('2024-01-15T14:00:00Z');

      // Add 5 segments
      for (let i = 0; i < 5; i++) {
        const segPath = path.join(testArchivePath, `segment-offset-${i}.ts`);
        await fs.writeFile(segPath, `test data ${i}`);
        
        await archiveManager.archiveSegment(
          segPath,
          new Date(now.getTime() + i * 60000),
          6,
          'test-show',
          'music',
          `seg-${i}`
        );
      }

      const segments = await archiveManager.getSegmentsForTimeRange(
        new Date(now.getTime() - 60000),
        new Date(now.getTime() + 600000),
        3, // limit
        2  // offset - skip first 2
      );

      expect(segments).toHaveLength(3);
      expect(segments[0].segmentId).toBe('seg-2');
      expect(segments[1].segmentId).toBe('seg-3');
      expect(segments[2].segmentId).toBe('seg-4');
    });
  });

  describe('getSegmentsFromTimestamp', () => {
    it('should return segments sorted by timestamp', async () => {
      const now = new Date('2024-01-15T14:00:00Z');

      const seg1Path = path.join(testArchivePath, 'segment-ts-1.ts');
      const seg2Path = path.join(testArchivePath, 'segment-ts-2.ts');
      
      await fs.writeFile(seg1Path, 'test data 1');
      await fs.writeFile(seg2Path, 'test data 2');

      await archiveManager.archiveSegment(
        seg2Path,
        new Date(now.getTime() + 30 * 60000), // +30 min
        6,
        'test-show',
        'music',
        'seg-2'
      );

      await archiveManager.archiveSegment(
        seg1Path,
        new Date(now.getTime() + 10 * 60000), // +10 min
        6,
        'test-show',
        'talk',
        'seg-1'
      );

      const segments = await archiveManager.getSegmentsFromTimestamp(
        now,
        60 // 60 minutes
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].segmentId).toBe('seg-1');
      expect(segments[1].segmentId).toBe('seg-2');
    });
  });

  describe('getSegmentsForShow', () => {
    it('should return segments for specific show sorted by timestamp', async () => {
      const date = new Date('2024-01-15T14:00:00Z');

      const seg1Path = path.join(testArchivePath, 'show-segment-1.ts');
      const seg2Path = path.join(testArchivePath, 'show-segment-2.ts');
      const seg3Path = path.join(testArchivePath, 'show-segment-3.ts');
      
      await fs.writeFile(seg1Path, 'test data 1');
      await fs.writeFile(seg2Path, 'test data 2');
      await fs.writeFile(seg3Path, 'test data 3');

      await archiveManager.archiveSegment(
        seg1Path,
        new Date(date.getTime() + 120000),
        6,
        'show-a',
        'music',
        'seg-1'
      );

      await archiveManager.archiveSegment(
        seg2Path,
        new Date(date.getTime()),
        6,
        'show-a',
        'talk',
        'seg-2'
      );

      await archiveManager.archiveSegment(
        seg3Path,
        new Date(date.getTime() + 60000),
        6,
        'show-b',
        'music',
        'seg-3'
      );

      const segments = await archiveManager.getSegmentsForShow('show-a', date);

      expect(segments).toHaveLength(2);
      expect(segments[0].segmentId).toBe('seg-2');
      expect(segments[1].segmentId).toBe('seg-1');
    });

    it('should support pagination', async () => {
      const date = new Date('2024-01-15T14:00:00Z');

      for (let i = 0; i < 5; i++) {
        const segPath = path.join(testArchivePath, `show-page-${i}.ts`);
        await fs.writeFile(segPath, `test data ${i}`);
        
        await archiveManager.archiveSegment(
          segPath,
          new Date(date.getTime() + i * 60000),
          6,
          'test-show',
          'music',
          `seg-${i}`
        );
      }

      const segments = await archiveManager.getSegmentsForShow(
        'test-show',
        date,
        2, // limit
        1  // offset
      );

      expect(segments).toHaveLength(2);
      expect(segments[0].segmentId).toBe('seg-1');
      expect(segments[1].segmentId).toBe('seg-2');
    });
  });

  describe('cleanupOldArchives', () => {
    it('should delete segments older than retention period', async () => {
      const now = new Date();
      const oldDate = new Date(now.getTime() - 31 * 24 * 60 * 60 * 1000); // 31 days ago
      const recentDate = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago

      // Create actual test files
      const oldSegmentPath = path.join(testArchivePath, 'old-segment.ts');
      const recentSegmentPath = path.join(testArchivePath, 'recent-segment.ts');
      
      await fs.writeFile(oldSegmentPath, 'test data');
      await fs.writeFile(recentSegmentPath, 'test data');

      await archiveManager.archiveSegment(
        oldSegmentPath,
        oldDate,
        6,
        'test-show',
        'music',
        'seg-old'
      );

      await archiveManager.archiveSegment(
        recentSegmentPath,
        recentDate,
        6,
        'test-show',
        'music',
        'seg-recent'
      );

      // Verify both segments exist
      let stats = await archiveManager.getStats();
      expect(stats.totalSegments).toBe(2);

      // Run cleanup
      await archiveManager.cleanupOldArchives();

      // Verify only recent segment remains
      stats = await archiveManager.getStats();
      expect(stats.totalSegments).toBe(1);

      const segments = await archiveManager.getSegmentsForTimeRange(
        oldDate,
        now
      );
      expect(segments).toHaveLength(1);
      expect(segments[0].segmentId).toBe('seg-recent');
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      const now = new Date('2024-01-15T14:00:00Z');

      // Create actual test files
      const segment1Path = path.join(testArchivePath, 'segment-1.ts');
      const segment2Path = path.join(testArchivePath, 'segment-2.ts');
      
      await fs.writeFile(segment1Path, 'test data 1');
      await fs.writeFile(segment2Path, 'test data 2');

      await archiveManager.archiveSegment(
        segment1Path,
        now,
        6,
        'test-show',
        'music',
        'seg-1'
      );

      await archiveManager.archiveSegment(
        segment2Path,
        new Date(now.getTime() + 60000),
        6,
        'test-show',
        'talk',
        'seg-2'
      );

      const stats = await archiveManager.getStats();

      expect(stats.totalSegments).toBe(2);
      expect(stats.oldestSegment).toBe(now.toISOString());
      expect(stats.newestSegment).toBe(new Date(now.getTime() + 60000).toISOString());
      expect(stats.totalSizeBytes).toBeGreaterThan(0);
    });
  });
});
