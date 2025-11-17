/**
 * Scheduler Service for Lofield FM
 * 
 * This service is responsible for:
 * 1. Monitoring the queue length and ensuring sufficient buffer
 * 2. Generating new segments by invoking AI modules
 * 3. Writing audio files to storage
 * 4. Inserting metadata into the database
 * 5. Recording the playlog
 * 
 * This is a skeleton implementation with stubbed AI integration points.
 * Actual AI service calls will be implemented in future iterations.
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

// Load environment variables from .env file
config();

const prisma = new PrismaClient();

interface SchedulerConfig {
  bufferMinutes: number;
  checkIntervalSeconds: number;
  audioStoragePath: string;
}

class SchedulerService {
  private config: SchedulerConfig;
  private isRunning: boolean = false;

  constructor(config: SchedulerConfig) {
    this.config = config;
  }

  /**
   * Start the scheduler service
   */
  async start() {
    console.log("Starting Lofield FM Scheduler Service...");
    console.log(`Buffer: ${this.config.bufferMinutes} minutes`);
    console.log(`Check interval: ${this.config.checkIntervalSeconds} seconds`);
    
    this.isRunning = true;

    // Ensure audio storage directory exists
    if (!fs.existsSync(this.config.audioStoragePath)) {
      fs.mkdirSync(this.config.audioStoragePath, { recursive: true });
    }

    // Start the scheduling loop
    await this.scheduleLoop();
  }

  /**
   * Stop the scheduler service
   */
  async stop() {
    console.log("Stopping scheduler service...");
    this.isRunning = false;
  }

  /**
   * Main scheduling loop
   */
  private async scheduleLoop() {
    while (this.isRunning) {
      try {
        await this.checkAndGenerateContent();
      } catch (error) {
        console.error("Error in scheduling loop:", error);
      }

      // Wait for the next check
      await new Promise((resolve) =>
        setTimeout(resolve, this.config.checkIntervalSeconds * 1000),
      );
    }
  }

  /**
   * Check queue length and generate content if needed
   */
  private async checkAndGenerateContent() {
    const now = new Date();
    const bufferTime = new Date(now.getTime() + this.config.bufferMinutes * 60000);

    // Check how many segments we have queued
    const queuedSegments = await prisma.segment.findMany({
      where: {
        startTime: {
          gte: now,
          lte: bufferTime,
        },
      },
      orderBy: {
        startTime: "asc",
      },
    });

    const queuedMinutes = queuedSegments.reduce((total, segment) => {
      const duration = (segment.endTime.getTime() - segment.startTime.getTime()) / 60000;
      return total + duration;
    }, 0);

    console.log(
      `Queue status: ${queuedMinutes.toFixed(1)}/${this.config.bufferMinutes} minutes`,
    );

    // If we're running low on content (less than 50% of buffer), generate more
    const bufferThreshold = this.config.bufferMinutes * 0.5;
    if (queuedMinutes < bufferThreshold) {
      console.log(`Queue running low (${queuedMinutes.toFixed(1)} < ${bufferThreshold} minutes), generating new content...`);
      await this.generateNextSegments();
    }
  }

  /**
   * Generate the next batch of segments
   * STUB: This is where AI integration will happen
   */
  private async generateNextSegments() {
    try {
      // Determine which show is currently active
      const currentShow = await this.getCurrentShow();
      
      if (!currentShow) {
        console.log("No active show found, skipping content generation");
        return;
      }

      console.log(`Generating content for show: ${currentShow.name}`);

      // Calculate how many minutes of content we need to generate
      const now = new Date();
      const bufferTime = new Date(now.getTime() + this.config.bufferMinutes * 60000);
      
      const queuedSegments = await prisma.segment.findMany({
        where: {
          startTime: {
            gte: now,
            lte: bufferTime,
          },
        },
      });

      const queuedMinutes = queuedSegments.reduce((total, segment) => {
        const duration = (segment.endTime.getTime() - segment.startTime.getTime()) / 60000;
        return total + duration;
      }, 0);

      let minutesNeeded = this.config.bufferMinutes * 0.5 - queuedMinutes;
      
      if (minutesNeeded <= 0) {
        console.log("Buffer is sufficient, no generation needed");
        return;
      }

      console.log(`Need to generate ${minutesNeeded.toFixed(1)} minutes of content`);

      // STUB: Get top-voted requests
      const topRequests = await this.getTopRequests(5);
      console.log(`Found ${topRequests.length} top requests to process`);

      // STUB: For each request, we would:
      // 1. Normalize the request using LLM
      // 2. Generate music using text-to-music AI
      // 3. Generate presenter commentary using LLM + TTS
      // 4. Create segments in the database

      let generatedMinutes = 0;
      for (const request of topRequests) {
        if (generatedMinutes >= minutesNeeded) {
          console.log(`Generated sufficient content (${generatedMinutes.toFixed(1)} minutes), stopping`);
          break;
        }
        
        console.log(`[STUB] Would process request: "${request.rawText}"`);
        // await this.processRequest(request, currentShow);
        
        // STUB: Assume each request generates ~3.5 minutes of content (3 min music + 0.5 min talk)
        const estimatedDuration = 3.5;
        generatedMinutes += estimatedDuration;
        console.log(`  [STUB] Would generate ~${estimatedDuration} minutes (total: ${generatedMinutes.toFixed(1)}/${minutesNeeded.toFixed(1)})`);
      }

      console.log(`[STUB] Content generation completed (stubbed, would have generated ${generatedMinutes.toFixed(1)} minutes)`);
    } catch (error) {
      console.error("Error in generateNextSegments:", error);
      throw error;
    }
  }

  /**
   * Get the currently active show based on current day and time
   */
  private async getCurrentShow() {
    try {
      const now = new Date();
      const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
      const currentHour = now.getUTCHours();
      const currentMinute = now.getUTCMinutes();
      const currentTimeMinutes = currentHour * 60 + currentMinute; // Convert to minutes since midnight

      const dayMap: { [key: number]: string } = {
        0: "sun",
        1: "mon",
        2: "tue",
        3: "wed",
        4: "thu",
        5: "fri",
        6: "sat",
      };
      const currentDayStr = dayMap[currentDay];

      console.log(`Looking for show active on ${currentDayStr} at ${String(currentHour).padStart(2, '0')}:${String(currentMinute).padStart(2, '0')} UTC`);

      // Get all shows
      const shows = await prisma.show.findMany();

      // Parse each show's config and find the one that matches current time
      for (const show of shows) {
        try {
          const config = JSON.parse(show.configJson);
          const schedule = config.schedule;

          // Check if current day is in the show's schedule
          if (!schedule.days.includes(currentDayStr)) {
            continue;
          }

          // Parse start and end times (format: "HH:MM")
          const [startHour, startMinute] = schedule.start_time_utc.split(":").map(Number);
          const [endHour, endMinute] = schedule.end_time_utc.split(":").map(Number);
          
          const startTimeMinutes = startHour * 60 + startMinute;
          const endTimeMinutes = endHour * 60 + endMinute;

          // Check if current time is within show time range
          // Handle case where show spans midnight (e.g., 21:00 to 03:00)
          const isInRange = endTimeMinutes > startTimeMinutes
            ? currentTimeMinutes >= startTimeMinutes && currentTimeMinutes < endTimeMinutes
            : currentTimeMinutes >= startTimeMinutes || currentTimeMinutes < endTimeMinutes;

          if (isInRange) {
            console.log(`Found active show: ${show.name} (${schedule.start_time_utc} - ${schedule.end_time_utc} UTC)`);
            return show;
          }
        } catch (error) {
          console.error(`Error parsing config for show ${show.id}:`, error);
        }
      }

      console.log("No show found for current time");
      return null;
    } catch (error) {
      console.error("Error in getCurrentShow:", error);
      throw error;
    }
  }

  /**
   * Get top-voted pending requests
   */
  private async getTopRequests(limit: number = 10) {
    return await prisma.request.findMany({
      where: {
        status: "pending",
        moderationStatus: "approved",
      },
      orderBy: {
        votes: "desc",
      },
      take: limit,
    });
  }

  /**
   * STUB: Process a request and generate content
   * This is where the actual AI calls would happen
   */
  private async processRequest(request: unknown, show: unknown) {
    try {
      // 1. Normalize request with LLM
      console.log("  [STUB] Normalizing request with LLM...");
      const normalizedPrompt = await this.normalizeRequestWithLLM(
        (request as { rawText: string }).rawText
      );

      // 2. Generate music
      console.log("  [STUB] Generating music with text-to-music AI...");
      const audioFile = await this.generateMusic(normalizedPrompt);

      // 3. Generate presenter commentary
      console.log("  [STUB] Generating presenter commentary...");
      const commentaryFile = await this.generateCommentary(request, show);

      // 4. Create segments in database
      console.log("  [STUB] Creating segments in database...");
      // await this.createSegments(audioFile, commentaryFile, request, show);
    } catch (error) {
      console.error("  [ERROR] Failed to process request:", error);
      throw error;
    }
  }

  /**
   * STUB: Normalize request using LLM
   */
  private async normalizeRequestWithLLM(rawText: string): Promise<string> {
    try {
      // This would call an LLM API (OpenAI, Anthropic, etc.)
      // For now, just return the raw text
      return rawText;
    } catch (error) {
      console.error("  [ERROR] LLM normalization failed:", error);
      throw error;
    }
  }

  /**
   * STUB: Generate music using text-to-music AI
   */
  private async generateMusic(prompt: string): Promise<string> {
    try {
      // This would call a text-to-music API (MusicGen, Stable Audio, etc.)
      // For now, return a placeholder path
      return "placeholder_music.mp3";
    } catch (error) {
      console.error("  [ERROR] Music generation failed:", error);
      throw error;
    }
  }

  /**
   * STUB: Generate presenter commentary using LLM + TTS
   */
  private async generateCommentary(request: unknown, show: unknown): Promise<string> {
    try {
      // This would:
      // 1. Use LLM to generate script
      // 2. Use TTS to convert to audio
      // For now, return a placeholder path
      return "placeholder_commentary.mp3";
    } catch (error) {
      console.error("  [ERROR] Commentary generation failed:", error);
      throw error;
    }
  }
}

// Main entry point
async function main() {
  // Load configuration from environment variables with defaults
  const config: SchedulerConfig = {
    bufferMinutes: parseInt(process.env.SCHEDULER_BUFFER_MINUTES || "45", 10),
    checkIntervalSeconds: parseInt(process.env.SCHEDULER_CHECK_INTERVAL || "60", 10),
    audioStoragePath: process.env.AUDIO_STORAGE_PATH || "/tmp/lofield/audio",
  };

  // Validate configuration
  if (isNaN(config.bufferMinutes) || config.bufferMinutes < 1) {
    console.error("Invalid SCHEDULER_BUFFER_MINUTES: must be a positive number");
    process.exit(1);
  }

  if (isNaN(config.checkIntervalSeconds) || config.checkIntervalSeconds < 1) {
    console.error("Invalid SCHEDULER_CHECK_INTERVAL: must be a positive number");
    process.exit(1);
  }

  console.log("Configuration loaded:");
  console.log(`  Buffer minutes: ${config.bufferMinutes}`);
  console.log(`  Check interval: ${config.checkIntervalSeconds}s`);
  console.log(`  Audio storage path: ${config.audioStoragePath}`);
  console.log("");

  const scheduler = new SchedulerService(config);

  // Handle shutdown gracefully
  process.on("SIGINT", async () => {
    console.log("\nReceived SIGINT, shutting down...");
    await scheduler.stop();
    await prisma.$disconnect();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nReceived SIGTERM, shutting down...");
    await scheduler.stop();
    await prisma.$disconnect();
    process.exit(0);
  });

  await scheduler.start();
}

// Only run if this file is executed directly
if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}

export { SchedulerService, SchedulerConfig };
