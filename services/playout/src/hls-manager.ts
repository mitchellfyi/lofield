/**
 * HLS Stream Manager
 * 
 * Manages HLS streaming output using FFmpeg
 */

import ffmpeg from 'fluent-ffmpeg';
import { promises as fs } from 'fs';
import path from 'path';
import logger from './logger';
import type { PlayoutConfig, SegmentInfo } from './types';

export class HLSStreamManager {
  private config: PlayoutConfig;
  private ffmpegProcess: ffmpeg.FfmpegCommand | null = null;
  private currentSegmentIndex = 0;
  private manifestPath: string;
  private segmentPattern: string;

  constructor(config: PlayoutConfig) {
    this.config = config;
    this.manifestPath = path.join(config.streamOutputPath, 'live.m3u8');
    this.segmentPattern = path.join(config.streamOutputPath, 'live%03d.ts');
  }

  /**
   * Initialize the HLS streaming directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.streamOutputPath, { recursive: true });
      logger.info('HLS stream directory initialized', {
        path: this.config.streamOutputPath,
      });

      // Clean up any existing segments
      await this.cleanup();
    } catch (error) {
      logger.error('Failed to initialize HLS stream directory', { error });
      throw error;
    }
  }

  /**
   * Start streaming with a list of segments
   * Uses FFmpeg to concatenate segments with crossfading
   */
  async startStream(segments: SegmentInfo[]): Promise<void> {
    if (segments.length === 0) {
      logger.warn('No segments to stream');
      return;
    }

    try {
      logger.info('Starting HLS stream', {
        segmentCount: segments.length,
      });

      // Build FFmpeg filter chain for crossfading
      const filterComplex = this.buildCrossfadeFilter(segments);

      // Create concat file for segments
      const concatFile = await this.createConcatFile(segments);

      this.ffmpegProcess = ffmpeg()
        .input(concatFile)
        .inputOptions(['-f', 'concat', '-safe', '0'])
        .audioCodec('aac')
        .audioBitrate(this.config.audioBitrate)
        .audioFrequency(this.config.audioSampleRate)
        .audioChannels(2)
        .outputOptions([
          '-f', 'hls',
          `-hls_time`, String(this.config.hlsSegmentDuration),
          `-hls_list_size`, String(this.config.hlsListSize),
          '-hls_flags', 'delete_segments',
          '-hls_segment_filename', this.segmentPattern,
        ]);

      if (filterComplex) {
        this.ffmpegProcess.complexFilter(filterComplex);
      }

      this.ffmpegProcess
        .output(this.manifestPath)
        .on('start', (commandLine) => {
          logger.info('FFmpeg started', { command: commandLine });
        })
        .on('progress', (progress) => {
          logger.debug('FFmpeg progress', { 
            timemark: progress.timemark,
          });
        })
        .on('error', (err, stdout, stderr) => {
          logger.error('FFmpeg error', { 
            error: err.message,
            stderr: stderr?.substring(0, 500),
          });
        })
        .on('end', () => {
          logger.info('FFmpeg process ended');
          this.ffmpegProcess = null;
        })
        .run();

      // Clean up concat file after a delay
      setTimeout(async () => {
        try {
          await fs.unlink(concatFile);
        } catch (error) {
          logger.warn('Failed to clean up concat file', { error });
        }
      }, 5000);
    } catch (error) {
      logger.error('Failed to start HLS stream', { error });
      throw error;
    }
  }

  /**
   * Build FFmpeg filter complex for crossfading between segments
   */
  private buildCrossfadeFilter(segments: SegmentInfo[]): string | null {
    if (segments.length < 2) {
      // No crossfading needed for single segment
      return null;
    }

    // For now, we'll skip crossfading and just concatenate
    // Crossfading with filter_complex is complex when using concat demuxer
    // This would require reading all files as separate inputs and building
    // a complex acrossfade chain. For initial implementation, we'll use
    // simple concatenation. Crossfading can be added in a future enhancement.
    
    return null;
  }

  /**
   * Create a concat file for FFmpeg
   */
  private async createConcatFile(segments: SegmentInfo[]): Promise<string> {
    const concatPath = path.join(
      this.config.streamOutputPath,
      `concat_${Date.now()}.txt`
    );

    const lines = segments.map((seg) => `file '${seg.filePath}'`).join('\n');

    await fs.writeFile(concatPath, lines, 'utf-8');

    return concatPath;
  }

  /**
   * Stop the current stream
   */
  async stopStream(): Promise<void> {
    if (this.ffmpegProcess) {
      logger.info('Stopping HLS stream');
      this.ffmpegProcess.kill('SIGINT');
      this.ffmpegProcess = null;
    }
  }

  /**
   * Clean up old HLS segments
   */
  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.streamOutputPath);
      const tsFiles = files.filter((f) => f.endsWith('.ts'));
      const m3u8Files = files.filter((f) => f.endsWith('.m3u8'));

      for (const file of [...tsFiles, ...m3u8Files]) {
        await fs.unlink(path.join(this.config.streamOutputPath, file));
      }

      logger.info('Cleaned up old HLS segments', {
        tsFiles: tsFiles.length,
        m3u8Files: m3u8Files.length,
      });
    } catch (error) {
      logger.warn('Failed to cleanup HLS segments', { error });
    }
  }

  /**
   * Get the path to the live manifest
   */
  getManifestPath(): string {
    return this.manifestPath;
  }

  /**
   * Check if stream is currently active
   */
  isStreaming(): boolean {
    return this.ffmpegProcess !== null;
  }
}
