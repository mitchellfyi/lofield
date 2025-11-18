/**
 * Playout Service Entry Point
 */

import * as dotenv from 'dotenv';
import path from 'path';
import logger from './src/logger';
import { PlayoutService } from './src/playout-service';
import type { PlayoutConfig } from './src/types';

// Load environment variables
dotenv.config();

// Build configuration from environment
const config: PlayoutConfig = {
  streamOutputPath:
    process.env.STREAM_OUTPUT_PATH || '/var/lofield/stream',
  archiveOutputPath:
    process.env.ARCHIVE_OUTPUT_PATH || '/var/lofield/archive',
  hlsSegmentDuration: parseInt(
    process.env.HLS_SEGMENT_DURATION || '6',
    10
  ),
  hlsListSize: parseInt(process.env.HLS_LIST_SIZE || '10', 10),
  crossfadeMusicToMusic: parseFloat(
    process.env.CROSSFADE_MUSIC_TO_MUSIC || '2.0'
  ),
  crossfadeMusicToTalk: parseFloat(
    process.env.CROSSFADE_MUSIC_TO_TALK || '1.0'
  ),
  crossfadeTalkToMusic: parseFloat(
    process.env.CROSSFADE_TALK_TO_MUSIC || '0.5'
  ),
  audioBitrate: process.env.AUDIO_BITRATE || '128k',
  audioSampleRate: parseInt(
    process.env.AUDIO_SAMPLE_RATE || '48000',
    10
  ),
  pollInterval: parseInt(process.env.POLL_INTERVAL || '5', 10),
  archiveRetentionDays: parseInt(
    process.env.ARCHIVE_RETENTION_DAYS || '30',
    10
  ),
};

// Create service instance
const service = new PlayoutService(config);

// Handle graceful shutdown
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  await service.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  await service.stop();
  process.exit(0);
});

// Start the service
async function main() {
  try {
    await service.start();
  } catch (error) {
    logger.error('Failed to start playout service', { error });
    process.exit(1);
  }
}

main();
