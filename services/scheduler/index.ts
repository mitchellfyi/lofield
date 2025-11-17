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

import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

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

    // If we're running low on content, generate more
    if (queuedMinutes < this.config.bufferMinutes * 0.5) {
      console.log("Queue running low, generating new content...");
      await this.generateNextSegments();
    }
  }

  /**
   * Generate the next batch of segments
   * STUB: This is where AI integration will happen
   */
  private async generateNextSegments() {
    // Determine which show is currently active
    const currentShow = await this.getCurrentShow();
    
    if (!currentShow) {
      console.log("No active show found, skipping content generation");
      return;
    }

    console.log(`Generating content for show: ${currentShow.name}`);

    // STUB: Get top-voted requests
    const topRequests = await this.getTopRequests(5);
    console.log(`Found ${topRequests.length} top requests to process`);

    // STUB: For each request, we would:
    // 1. Normalize the request using LLM
    // 2. Generate music using text-to-music AI
    // 3. Generate presenter commentary using LLM + TTS
    // 4. Create segments in the database

    for (const request of topRequests) {
      console.log(`[STUB] Would process request: "${request.rawText}"`);
      // await this.processRequest(request, currentShow);
    }

    console.log("[STUB] Content generation completed (stubbed)");
  }

  /**
   * Get the currently active show
   */
  private async getCurrentShow() {
    const now = new Date();
    const currentHour = now.getHours();

    const show = await prisma.show.findFirst({
      where: {
        startHour: {
          lte: currentHour,
        },
      },
      orderBy: {
        startHour: "desc",
      },
    });

    return show;
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
  private async processRequest(request: any, show: any) {
    // 1. Normalize request with LLM
    console.log("  [STUB] Normalizing request with LLM...");
    const normalizedPrompt = await this.normalizeRequestWithLLM(request.rawText);

    // 2. Generate music
    console.log("  [STUB] Generating music with text-to-music AI...");
    const audioFile = await this.generateMusic(normalizedPrompt);

    // 3. Generate presenter commentary
    console.log("  [STUB] Generating presenter commentary...");
    const commentaryFile = await this.generateCommentary(request, show);

    // 4. Create segments in database
    console.log("  [STUB] Creating segments in database...");
    // await this.createSegments(audioFile, commentaryFile, request, show);
  }

  /**
   * STUB: Normalize request using LLM
   */
  private async normalizeRequestWithLLM(rawText: string): Promise<string> {
    // This would call an LLM API (OpenAI, Anthropic, etc.)
    // For now, just return the raw text
    return rawText;
  }

  /**
   * STUB: Generate music using text-to-music AI
   */
  private async generateMusic(prompt: string): Promise<string> {
    // This would call a text-to-music API (MusicGen, Stable Audio, etc.)
    // For now, return a placeholder path
    return "placeholder_music.mp3";
  }

  /**
   * STUB: Generate presenter commentary using LLM + TTS
   */
  private async generateCommentary(request: any, show: any): Promise<string> {
    // This would:
    // 1. Use LLM to generate script
    // 2. Use TTS to convert to audio
    // For now, return a placeholder path
    return "placeholder_commentary.mp3";
  }
}

// Main entry point
async function main() {
  const config: SchedulerConfig = {
    bufferMinutes: parseInt(process.env.SCHEDULER_BUFFER_MINUTES || "45"),
    checkIntervalSeconds: parseInt(process.env.SCHEDULER_CHECK_INTERVAL || "60"),
    audioStoragePath: process.env.AUDIO_STORAGE_PATH || "/tmp/lofield/audio",
  };

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
