/**
 * HLS Stream Manager
 *
 * Manages HLS streaming output using FFmpeg
 */

import ffmpeg from "fluent-ffmpeg";
import { promises as fs } from "fs";
import path from "path";
import logger from "./logger";
import type { PlayoutConfig, SegmentInfo } from "./types";

export class HLSStreamManager {
  private config: PlayoutConfig;
  private ffmpegProcess: ffmpeg.FfmpegCommand | null = null;
  private currentSegmentIndex = 0;
  private manifestPath: string;
  private segmentPattern: string;

  constructor(config: PlayoutConfig) {
    this.config = config;
    this.manifestPath = path.join(config.streamOutputPath, "live.m3u8");
    this.segmentPattern = path.join(config.streamOutputPath, "live%03d.ts");
  }

  /**
   * Initialize the HLS streaming directory
   */
  async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.config.streamOutputPath, { recursive: true });
      logger.info("HLS stream directory initialized", {
        path: this.config.streamOutputPath,
      });

      // Clean up any existing segments
      await this.cleanup();
    } catch (error) {
      logger.error("Failed to initialize HLS stream directory", { error });
      throw error;
    }
  }

  /**
   * Start streaming with a list of segments
   * Uses FFmpeg to concatenate segments with crossfading
   */
  async startStream(segments: SegmentInfo[]): Promise<void> {
    if (segments.length === 0) {
      logger.warn("No segments to stream");
      return;
    }

    try {
      logger.info("Starting HLS stream", {
        segmentCount: segments.length,
      });

      // Build FFmpeg filter chain for crossfading
      const filterComplex = this.buildCrossfadeFilter(segments);

      // Create concat file for segments
      const concatFile = await this.createConcatFile(segments);

      this.ffmpegProcess = ffmpeg()
        .input(concatFile)
        .inputOptions(["-f", "concat", "-safe", "0"])
        .audioCodec("aac")
        .audioBitrate(this.config.audioBitrate)
        .audioFrequency(this.config.audioSampleRate)
        .audioChannels(2)
        .outputOptions([
          "-f",
          "hls",
          `-hls_time`,
          String(this.config.hlsSegmentDuration),
          `-hls_list_size`,
          String(this.config.hlsListSize),
          "-hls_flags",
          "delete_segments",
          "-hls_segment_filename",
          this.segmentPattern,
        ]);

      if (filterComplex) {
        this.ffmpegProcess.complexFilter(filterComplex);
      }

      this.ffmpegProcess
        .output(this.manifestPath)
        .on("start", (commandLine) => {
          logger.info("FFmpeg started", { command: commandLine });
        })
        .on("progress", (progress) => {
          logger.debug("FFmpeg progress", {
            timemark: progress.timemark,
          });
        })
        .on("error", (err, stdout, stderr) => {
          logger.error("FFmpeg error", {
            error: err.message,
            stderr: stderr?.substring(0, 500),
          });
          // Gracefully handle error - don't crash the service
          this.ffmpegProcess = null;
        })
        .on("end", () => {
          logger.info("FFmpeg process ended");
          this.ffmpegProcess = null;
        })
        .run();

      // Clean up concat file after a delay
      setTimeout(async () => {
        try {
          await fs.unlink(concatFile);
        } catch (error) {
          logger.warn("Failed to clean up concat file", { error });
        }
      }, 5000);
    } catch (error) {
      logger.error("Failed to start HLS stream", { error });
      // Don't re-throw - let the service continue with next iteration
      this.ffmpegProcess = null;
    }
  }

  /**
   * Build FFmpeg filter complex for crossfading between segments
   *
   * Applies crossfading between segments based on their types:
   * - Music-to-music: Uses acrossfade for smooth transitions
   * - Music-to-talk: Fade out music, immediate talk start
   * - Talk-to-music: Fade in music under final words
   * - Other transitions: Simple fade in/out
   */
  private buildCrossfadeFilter(segments: SegmentInfo[]): string | null {
    if (segments.length < 2) {
      // No crossfading needed for single segment
      return null;
    }

    try {
      // Build filter chain with crossfades between segments
      const filters: string[] = [];

      // For each segment, determine crossfade duration based on types
      for (let i = 0; i < segments.length; i++) {
        const current = segments[i];
        const next = segments[i + 1];

        if (i === 0) {
          // First segment: just fade in at the start (0.5s)
          filters.push(`[${i}:a]afade=t=in:st=0:d=0.5[a${i}]`);
        } else if (!next) {
          // Last segment: fade out at the end (1s)
          filters.push(
            `[${i}:a]afade=t=out:st=${segments[i].endTime.getTime() - segments[i].startTime.getTime() - 1}:d=1[a${i}]`
          );
        } else {
          // Middle segments: apply fades based on transition type
          const fadeOutDuration = this.getCrossfadeDuration(
            current.type,
            next.type
          );
          filters.push(
            `[${i}:a]afade=t=out:st=${segments[i].endTime.getTime() - segments[i].startTime.getTime() - fadeOutDuration}:d=${fadeOutDuration}[a${i}out]`
          );
          filters.push(`[a${i}out]afade=t=in:st=0:d=0.5[a${i}]`);
        }
      }

      // Concatenate all processed segments
      const inputLabels = segments.map((_, i) => `[a${i}]`).join("");
      filters.push(`${inputLabels}concat=n=${segments.length}:v=0:a=1[aout]`);

      // Add loudness normalization at the end
      filters.push("[aout]loudnorm=I=-16:TP=-1.5:LRA=11[anorm]");

      return filters.join(";");
    } catch (error) {
      logger.warn(
        "Failed to build crossfade filter, using simple concatenation",
        { error }
      );
      return null;
    }
  }

  /**
   * Get crossfade duration based on segment transition types
   */
  private getCrossfadeDuration(fromType: string, toType: string): number {
    if (fromType === "music" && toType === "music") {
      return this.config.crossfadeMusicToMusic;
    } else if (
      fromType === "music" &&
      (toType === "talk" || toType === "ident")
    ) {
      return this.config.crossfadeMusicToTalk;
    } else if (
      (fromType === "talk" || fromType === "ident") &&
      toType === "music"
    ) {
      return this.config.crossfadeTalkToMusic;
    } else {
      // Default fallback for other transitions
      return 1.0;
    }
  }

  /**
   * Create a concat file for FFmpeg
   */
  private async createConcatFile(segments: SegmentInfo[]): Promise<string> {
    const concatPath = path.join(
      this.config.streamOutputPath,
      `concat_${Date.now()}.txt`
    );

    const lines = segments.map((seg) => `file '${seg.filePath}'`).join("\n");

    await fs.writeFile(concatPath, lines, "utf-8");

    return concatPath;
  }

  /**
   * Stop the current stream
   */
  async stopStream(): Promise<void> {
    if (this.ffmpegProcess) {
      logger.info("Stopping HLS stream");
      this.ffmpegProcess.kill("SIGINT");
      this.ffmpegProcess = null;
    }
  }

  /**
   * Clean up old HLS segments
   */
  private async cleanup(): Promise<void> {
    try {
      const files = await fs.readdir(this.config.streamOutputPath);
      const tsFiles = files.filter((f) => f.endsWith(".ts"));
      const m3u8Files = files.filter((f) => f.endsWith(".m3u8"));

      for (const file of [...tsFiles, ...m3u8Files]) {
        await fs.unlink(path.join(this.config.streamOutputPath, file));
      }

      logger.info("Cleaned up old HLS segments", {
        tsFiles: tsFiles.length,
        m3u8Files: m3u8Files.length,
      });
    } catch (error) {
      logger.warn("Failed to cleanup HLS segments", { error });
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
