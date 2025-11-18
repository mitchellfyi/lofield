/**
 * Tests for HLS Manager
 */

import { HLSStreamManager } from '../hls-manager';
import type { PlayoutConfig, SegmentInfo } from '../types';
import { promises as fs } from 'fs';
import path from 'path';

// Mock logger to suppress output during tests
jest.mock('../logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock fluent-ffmpeg
jest.mock('fluent-ffmpeg', () => {
  return jest.fn().mockImplementation(() => ({
    input: jest.fn().mockReturnThis(),
    inputOptions: jest.fn().mockReturnThis(),
    audioCodec: jest.fn().mockReturnThis(),
    audioBitrate: jest.fn().mockReturnThis(),
    audioFrequency: jest.fn().mockReturnThis(),
    audioChannels: jest.fn().mockReturnThis(),
    outputOptions: jest.fn().mockReturnThis(),
    complexFilter: jest.fn().mockReturnThis(),
    output: jest.fn().mockReturnThis(),
    on: jest.fn().mockReturnThis(),
    run: jest.fn(),
    kill: jest.fn(),
  }));
});

describe('HLSStreamManager', () => {
  let hlsManager: HLSStreamManager;
  let testStreamPath: string;
  let config: PlayoutConfig;

  beforeEach(async () => {
    // Create a temporary test directory
    testStreamPath = path.join('/tmp', `stream-test-${Date.now()}`);
    
    config = {
      streamOutputPath: testStreamPath,
      archiveOutputPath: '/tmp/archive-test',
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

    hlsManager = new HLSStreamManager(config);
    await hlsManager.initialize();
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await hlsManager.stopStream();
      await fs.rm(testStreamPath, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('getCrossfadeDuration', () => {
    it('should return correct duration for music-to-music transition', () => {
      // Access private method through type assertion
      const duration = (hlsManager as any).getCrossfadeDuration('music', 'music');
      expect(duration).toBe(2.0);
    });

    it('should return correct duration for music-to-talk transition', () => {
      const duration = (hlsManager as any).getCrossfadeDuration('music', 'talk');
      expect(duration).toBe(1.0);
    });

    it('should return correct duration for talk-to-music transition', () => {
      const duration = (hlsManager as any).getCrossfadeDuration('talk', 'music');
      expect(duration).toBe(0.5);
    });

    it('should return default duration for other transitions', () => {
      const duration = (hlsManager as any).getCrossfadeDuration('ident', 'handover');
      expect(duration).toBe(1.0);
    });
  });

  describe('buildCrossfadeFilter', () => {
    it('should return null for single segment', () => {
      const segments: SegmentInfo[] = [
        {
          id: 'seg-1',
          filePath: '/tmp/segment1.ts',
          type: 'music',
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:03:00Z'),
          showId: 'test-show',
        },
      ];

      const filter = (hlsManager as any).buildCrossfadeFilter(segments);
      expect(filter).toBeNull();
    });

    it('should return filter complex for multiple segments', () => {
      const segments: SegmentInfo[] = [
        {
          id: 'seg-1',
          filePath: '/tmp/segment1.ts',
          type: 'music',
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:03:00Z'),
          showId: 'test-show',
        },
        {
          id: 'seg-2',
          filePath: '/tmp/segment2.ts',
          type: 'talk',
          startTime: new Date('2024-01-15T14:03:00Z'),
          endTime: new Date('2024-01-15T14:05:00Z'),
          showId: 'test-show',
        },
      ];

      const filter = (hlsManager as any).buildCrossfadeFilter(segments);
      
      // Filter should not be null for multiple segments
      expect(filter).toBeTruthy();
      
      // Filter should contain fade operations
      if (filter) {
        expect(filter).toContain('afade');
        expect(filter).toContain('concat');
        expect(filter).toContain('loudnorm');
      }
    });

    it('should include all segments in concat operation', () => {
      const segments: SegmentInfo[] = [
        {
          id: 'seg-1',
          filePath: '/tmp/segment1.ts',
          type: 'music',
          startTime: new Date('2024-01-15T14:00:00Z'),
          endTime: new Date('2024-01-15T14:02:00Z'),
          showId: 'test-show',
        },
        {
          id: 'seg-2',
          filePath: '/tmp/segment2.ts',
          type: 'music',
          startTime: new Date('2024-01-15T14:02:00Z'),
          endTime: new Date('2024-01-15T14:04:00Z'),
          showId: 'test-show',
        },
        {
          id: 'seg-3',
          filePath: '/tmp/segment3.ts',
          type: 'talk',
          startTime: new Date('2024-01-15T14:04:00Z'),
          endTime: new Date('2024-01-15T14:06:00Z'),
          showId: 'test-show',
        },
      ];

      const filter = (hlsManager as any).buildCrossfadeFilter(segments);
      
      if (filter) {
        // Should concatenate 3 segments
        expect(filter).toContain('concat=n=3');
      }
    });
  });

  describe('initialize', () => {
    it('should create stream output directory', async () => {
      const stats = await fs.stat(testStreamPath);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('isStreaming', () => {
    it('should return false when not streaming', () => {
      expect(hlsManager.isStreaming()).toBe(false);
    });
  });

  describe('getManifestPath', () => {
    it('should return correct manifest path', () => {
      const manifestPath = hlsManager.getManifestPath();
      expect(manifestPath).toBe(path.join(testStreamPath, 'live.m3u8'));
    });
  });
});
