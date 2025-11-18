/**
 * Main Scheduler Service
 * 
 * Orchestrates all scheduler components:
 * - Show scheduling
 * - Queue management
 * - Content generation
 * - Archiving
 * - Broadcasting
 */

import type { SchedulerConfig, Show, QueuedSegment, ShowConfig } from "./types";
import {
  getCurrentShow,
  getNextShow,
  getShowEndTime,
  isNearShowTransition,
  getSeasonalContext,
} from "./show-scheduler";
import {
  needsReplenishment,
  getNextAvailableSlot,
  createSegment,
  createTrack,
  markRequestAsUsed,
  getTopRequests,
  getQueueStats,
  getQueuedSegments,
} from "./queue-manager";
import {
  generateMusicTrack,
  generateCommentary,
  generateHandoverSegment,
  generateIdent,
  generateFallbackContent,
} from "./content-generator";
import { recordSegmentToArchive } from "./archiver";
import {
  publishNowPlaying,
  publishQueueUpdate,
  publishRequestPlayed,
  publishShowChange,
} from "./broadcaster";

export class SchedulerService {
  private config: SchedulerConfig;
  private isRunning: boolean = false;
  private currentShowId: string | null = null;
  private lastHandoverCheck: Date | null = null;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler service
   */
  async start(): Promise<void> {
    console.log("Starting Lofield FM Scheduler Service...");
    console.log(`Buffer: ${this.config.bufferMinutes} minutes`);
    console.log(`Check interval: ${this.config.checkIntervalSeconds} seconds`);
    console.log(`Min queue depth: ${this.config.minQueueDepthMinutes} minutes`);

    this.isRunning = true;

    // Start the scheduling loop
    await this.scheduleLoop();
  }

  /**
   * Stop the scheduler service
   */
  async stop(): Promise<void> {
    console.log("Stopping scheduler service...");
    this.isRunning = false;
  }

  /**
   * Main scheduling loop
   */
  private async scheduleLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.scheduleTick();
      } catch (error) {
        console.error("Error in scheduling loop:", error);
      }

      // Wait for the next check
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.checkIntervalSeconds * 1000)
      );
    }
  }

  /**
   * Single scheduling tick - checks and performs all necessary actions
   */
  private async scheduleTick(): Promise<void> {
    // 1. Get current show
    const currentShow = await getCurrentShow();
    if (!currentShow) {
      console.warn("No active show found, waiting for next check");
      return;
    }

    // 2. Check for show transition
    await this.checkShowTransition(currentShow);

    // 3. Check queue and generate content if needed
    await this.checkAndGenerateContent(currentShow);

    // 4. Publish queue updates
    await this.publishUpdates(currentShow);

    // 5. Cleanup old segments
    await this.cleanup();
  }

  /**
   * Check if we need to generate a handover segment
   */
  private async checkShowTransition(currentShow: Show): Promise<void> {
    // Track show changes
    if (this.currentShowId !== currentShow.id) {
      if (this.currentShowId) {
        publishShowChange(this.currentShowId, currentShow.id, currentShow.name);
      }
      this.currentShowId = currentShow.id;
    }

    // Check if we're near show transition
    if (isNearShowTransition(currentShow, 10)) {
      // Only generate handover once per transition
      const now = new Date();
      if (
        !this.lastHandoverCheck ||
        now.getTime() - this.lastHandoverCheck.getTime() > 600000 // 10 minutes
      ) {
        this.lastHandoverCheck = now;
        await this.generateHandover(currentShow);
      }
    }
  }

  /**
   * Generate handover segment at show boundary
   */
  private async generateHandover(currentShow: Show): Promise<void> {
    try {
      const nextShow = await getNextShow(currentShow);
      if (!nextShow) {
        console.log("No next show found, skipping handover");
        return;
      }

      console.log(
        `Generating handover from ${currentShow.name} to ${nextShow.name}`
      );

      // Generate handover audio
      const handoverResult = await generateHandoverSegment(
        currentShow,
        nextShow,
        this.config.audioStoragePath
      );

      if (!handoverResult.success || !handoverResult.filePath) {
        console.error("Handover generation failed, using fallback");
        const fallback = await generateFallbackContent(
          "talk",
          this.config.audioStoragePath
        );
        handoverResult.filePath = fallback.filePath;
        handoverResult.metadata = { duration: fallback.duration };
      }

      // Schedule handover at show boundary
      const showEndTime = getShowEndTime(currentShow);
      const handoverStart = new Date(
        showEndTime.getTime() - 5 * 60 * 1000 // 5 minutes before show end
      );
      const handoverEnd = new Date(handoverStart.getTime() + 5 * 60 * 1000);

      await createSegment({
        showId: currentShow.id,
        type: "handover",
        filePath: handoverResult.filePath!,
        startTime: handoverStart,
        endTime: handoverEnd,
        metadata: {
          nextShow: nextShow.id,
          nextShowName: nextShow.name,
        },
      });

      console.log(`Handover segment scheduled at ${handoverStart.toISOString()}`);
    } catch (error) {
      console.error("Error generating handover:", error);
    }
  }

  /**
   * Check queue and generate content if needed
   */
  private async checkAndGenerateContent(currentShow: Show): Promise<void> {
    const replenishment = await needsReplenishment(this.config);

    console.log(
      `Queue status: ${replenishment.currentMinutes.toFixed(1)}/${replenishment.targetMinutes} minutes`
    );

    if (!replenishment.needed) {
      return;
    }

    console.log(
      `Queue running low, generating ${replenishment.minutesNeeded.toFixed(1)} minutes of content...`
    );

    await this.generateContent(currentShow, replenishment.minutesNeeded);
  }

  /**
   * Generate content to fill the queue
   */
  private async generateContent(
    show: Show,
    minutesNeeded: number
  ): Promise<void> {
    try {
      const config: ShowConfig = JSON.parse(show.configJson);
      const musicRatio = config.ratios.music_fraction;
      const talkRatio = config.ratios.talk_fraction;

      // Get top requests
      const requests = await getTopRequests(10);
      console.log(`Found ${requests.length} requests to process`);

      let generatedMinutes = 0;
      let nextSlot = await getNextAvailableSlot();

      // Generate content mix based on ratios
      for (const request of requests) {
        if (generatedMinutes >= minutesNeeded) {
          break;
        }

        try {
          // Generate music track
          const musicResult = await generateMusicTrack(
            request,
            show,
            this.config.audioStoragePath
          );

          if (!musicResult.success || !musicResult.filePath) {
            console.error("Music generation failed, using fallback");
            const fallback = await generateFallbackContent(
              "music",
              this.config.audioStoragePath
            );
            musicResult.filePath = fallback.filePath;
            musicResult.metadata = {
              title: "Fallback Track",
              duration: fallback.duration,
            };
          }

          // Create track record
          const trackId = await createTrack({
            requestId: request.id,
            filePath: musicResult.filePath!,
            title: musicResult.metadata?.title || request.rawText,
            artist: "Lofield FM",
            lengthSeconds: musicResult.metadata?.duration || 180,
          });

          // Generate commentary
          const commentaryResult = await generateCommentary(
            request,
            show,
            musicResult.metadata?.title || request.rawText,
            this.config.audioStoragePath
          );

          if (!commentaryResult.success || !commentaryResult.filePath) {
            console.warn("Commentary generation failed, skipping");
          }

          // Schedule commentary segment (if successful)
          if (commentaryResult.success && commentaryResult.filePath) {
            const commentaryEnd = new Date(
              nextSlot.getTime() + (commentaryResult.metadata?.duration || 30) * 1000
            );

            await createSegment({
              showId: show.id,
              type: "talk",
              filePath: commentaryResult.filePath,
              startTime: nextSlot,
              endTime: commentaryEnd,
              requestId: request.id,
            });

            generatedMinutes += (commentaryResult.metadata?.duration || 30) / 60;
            nextSlot = commentaryEnd;
          }

          // Schedule music segment
          const musicEnd = new Date(
            nextSlot.getTime() + (musicResult.metadata?.duration || 180) * 1000
          );

          await createSegment({
            showId: show.id,
            type: "music",
            filePath: musicResult.filePath!,
            startTime: nextSlot,
            endTime: musicEnd,
            requestId: request.id,
            trackId: trackId,
          });

          generatedMinutes += (musicResult.metadata?.duration || 180) / 60;
          nextSlot = musicEnd;

          // Mark request as used
          await markRequestAsUsed(request.id);

          // Publish request played notification
          publishRequestPlayed(request.id, musicResult.metadata?.title || "Track");

          console.log(
            `Generated content for request "${request.rawText}" (${generatedMinutes.toFixed(1)}/${minutesNeeded.toFixed(1)} min)`
          );
        } catch (error) {
          console.error(`Error processing request ${request.id}:`, error);
          continue;
        }
      }

      // Generate filler idents if we still need more content
      while (generatedMinutes < minutesNeeded) {
        const identResult = await generateIdent(show, this.config.audioStoragePath);

        if (identResult.success && identResult.filePath) {
          const identEnd = new Date(
            nextSlot.getTime() + (identResult.metadata?.duration || 10) * 1000
          );

          await createSegment({
            showId: show.id,
            type: "ident",
            filePath: identResult.filePath,
            startTime: nextSlot,
            endTime: identEnd,
          });

          generatedMinutes += (identResult.metadata?.duration || 10) / 60;
          nextSlot = identEnd;
        } else {
          break; // Can't generate more, exit
        }
      }

      console.log(
        `Content generation complete: ${generatedMinutes.toFixed(1)} minutes generated`
      );
    } catch (error) {
      console.error("Error in generateContent:", error);
      throw error;
    }
  }

  /**
   * Publish real-time updates
   */
  private async publishUpdates(currentShow: Show): Promise<void> {
    try {
      const now = new Date();
      const bufferTime = new Date(
        now.getTime() + this.config.bufferMinutes * 60000
      );

      // Get upcoming segments
      const upcomingSegments = await getQueuedSegments(now, bufferTime);

      // Publish queue update
      publishQueueUpdate(upcomingSegments);

      // Get and publish now playing
      if (upcomingSegments.length > 0) {
        const currentSegment = upcomingSegments.find(
          (seg) => seg.startTime <= now && seg.endTime > now
        );

        if (currentSegment) {
          publishNowPlaying({
            segmentId: currentSegment.id,
            type: currentSegment.type,
            showId: currentSegment.showId,
            showName: currentShow.name,
            startTime: currentSegment.startTime,
            endTime: currentSegment.endTime,
            trackId: currentSegment.trackId,
            requestId: currentSegment.requestId,
          });
        }
      }
    } catch (error) {
      console.error("Error publishing updates:", error);
    }
  }

  /**
   * Cleanup old data
   */
  private async cleanup(): Promise<void> {
    // Only cleanup once per hour
    const now = new Date();
    if (now.getMinutes() !== 0) {
      return;
    }

    try {
      // Clean up segments older than 1 hour
      const cutoff = new Date(now.getTime() - 3600000);
      // await cleanupOldSegments(cutoff);

      console.log("Cleanup completed");
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }

  /**
   * Get scheduler statistics
   */
  async getStats(): Promise<object> {
    const queueStats = await getQueueStats(this.config.bufferMinutes);
    const currentShow = await getCurrentShow();

    return {
      isRunning: this.isRunning,
      currentShow: currentShow?.name,
      currentShowId: this.currentShowId,
      queue: queueStats,
      config: {
        bufferMinutes: this.config.bufferMinutes,
        minQueueDepth: this.config.minQueueDepthMinutes,
        checkInterval: this.config.checkIntervalSeconds,
      },
    };
  }
}
