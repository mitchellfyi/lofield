/**
 * Scheduler Service for Lofield FM
 * 
 * Main entry point for the scheduler service.
 * Initializes and runs the scheduler with all modules.
 */

import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import { SchedulerService } from "./src/scheduler";
import type { SchedulerConfig } from "./src/types";

// Load environment variables from .env file
config();

const prisma = new PrismaClient();

// Main entry point
async function main() {
  // Load configuration from environment variables with defaults
  const config: SchedulerConfig = {
    bufferMinutes: parseInt(process.env.SCHEDULER_BUFFER_MINUTES || "45", 10),
    checkIntervalSeconds: parseInt(process.env.SCHEDULER_CHECK_INTERVAL || "60", 10),
    audioStoragePath: process.env.AUDIO_STORAGE_PATH || "/tmp/lofield/audio",
    archivePath: process.env.ARCHIVE_PATH || "/tmp/lofield/archive",
    minQueueDepthMinutes: parseInt(
      process.env.MIN_QUEUE_DEPTH_MINUTES || "15",
      10
    ),
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

  if (isNaN(config.minQueueDepthMinutes) || config.minQueueDepthMinutes < 1) {
    console.error("Invalid MIN_QUEUE_DEPTH_MINUTES: must be a positive number");
    process.exit(1);
  }

  // Ensure storage directories exist
  if (!fs.existsSync(config.audioStoragePath)) {
    fs.mkdirSync(config.audioStoragePath, { recursive: true });
  }
  if (!fs.existsSync(config.archivePath)) {
    fs.mkdirSync(config.archivePath, { recursive: true });
  }

  console.log("Configuration loaded:");
  console.log(`  Buffer minutes: ${config.bufferMinutes}`);
  console.log(`  Min queue depth: ${config.minQueueDepthMinutes}`);
  console.log(`  Check interval: ${config.checkIntervalSeconds}s`);
  console.log(`  Audio storage path: ${config.audioStoragePath}`);
  console.log(`  Archive path: ${config.archivePath}`);
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

export { SchedulerService };
export type { SchedulerConfig };
