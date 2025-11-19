/**
 * Tests for Audio Mixer Module
 */

import * as fs from "fs/promises";
import * as path from "path";
import { concatenateAudioFiles, checkFfmpegAvailable } from "../ai/audio-mixer";

jest.setTimeout(20000);

describe("Audio Mixer", () => {
  const testDir = "/tmp/lofield-test-audio";
  const testFiles: string[] = [];

  beforeAll(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });

    // Create dummy audio files
    for (let i = 1; i <= 3; i++) {
      const filePath = path.join(testDir, `test${i}.mp3`);
      await fs.writeFile(filePath, Buffer.from(`dummy audio content ${i}`));
      testFiles.push(filePath);
    }
  });

  afterAll(async () => {
    // Clean up test files
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe("checkFfmpegAvailable", () => {
    it("should check if ffmpeg is available", async () => {
      const available = await checkFfmpegAvailable();
      expect(typeof available).toBe("boolean");
    });
  });

  describe("concatenateAudioFiles", () => {
    it("should handle empty array", async () => {
      await expect(
        concatenateAudioFiles([], path.join(testDir, "output.mp3"))
      ).rejects.toThrow("No audio files to concatenate");
    });

    it("should handle single file", async () => {
      const outputPath = path.join(testDir, "single-output.mp3");
      const duration = await concatenateAudioFiles([testFiles[0]], outputPath);

      expect(duration).toBeGreaterThan(0);
      const outputExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(outputExists).toBe(true);
    });

    it("should concatenate multiple files", async () => {
      const outputPath = path.join(testDir, "multi-output.mp3");
      const duration = await concatenateAudioFiles(testFiles, outputPath);

      expect(duration).toBeGreaterThan(0);
      const outputExists = await fs
        .access(outputPath)
        .then(() => true)
        .catch(() => false);
      expect(outputExists).toBe(true);
    });

    it("should handle custom gap duration", async () => {
      const outputPath = path.join(testDir, "gap-output.mp3");
      const duration = await concatenateAudioFiles(
        [testFiles[0], testFiles[1]],
        outputPath,
        1.0 // 1 second gap
      );

      expect(duration).toBeGreaterThan(0);
    });
  });
});
