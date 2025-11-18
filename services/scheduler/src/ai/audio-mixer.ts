/**
 * Audio Mixing Utility
 * 
 * Concatenates multiple audio files into a single file using ffmpeg.
 * Handles duo presenter segments by joining their audio sequentially.
 */

import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs/promises";
import * as path from "path";
import logger from "../logger";

const execAsync = promisify(exec);

/**
 * Check if ffmpeg is available
 */
export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execAsync("ffmpeg -version");
    return true;
  } catch {
    return false;
  }
}

/**
 * Concatenate multiple audio files into one using ffmpeg
 * 
 * @param audioFiles Array of audio file paths to concatenate
 * @param outputPath Output file path
 * @param gapSeconds Optional gap between files in seconds (default: 0.5)
 * @returns Duration of the concatenated audio in seconds
 */
export async function concatenateAudioFiles(
  audioFiles: string[],
  outputPath: string,
  gapSeconds: number = 0.5
): Promise<number> {
  if (audioFiles.length === 0) {
    throw new Error("No audio files to concatenate");
  }

  // If only one file, just copy it
  if (audioFiles.length === 1) {
    await fs.copyFile(audioFiles[0], outputPath);
    const duration = await getAudioDuration(audioFiles[0]);
    return duration;
  }

  const ffmpegAvailable = await checkFfmpegAvailable();
  
  if (!ffmpegAvailable) {
    logger.warn("  [WARN] ffmpeg not available, falling back to simple concatenation");
    return await fallbackConcatenate(audioFiles, outputPath);
  }

  try {
    // Create a temporary file list for ffmpeg concat demuxer
    const fileListPath = path.join(
      path.dirname(outputPath),
      `concat_list_${Date.now()}.txt`
    );

    // Build file list content
    // Format: file 'path/to/file.mp3'
    const fileListContent = audioFiles
      .map((file) => `file '${file.replace(/'/g, "'\\''")}'`) // Escape single quotes
      .join("\n");

    await fs.writeFile(fileListPath, fileListContent);

    // Run ffmpeg concat
    // Using concat demuxer which is faster and doesn't re-encode
    const command = `ffmpeg -f concat -safe 0 -i "${fileListPath}" -c copy "${outputPath}" -y`;

    logger.debug(`  [AUDIO] Concatenating ${audioFiles.length} files with ffmpeg`);
    await execAsync(command);

    // Clean up temp file list
    await fs.unlink(fileListPath);

    // Get total duration
    const duration = await getAudioDuration(outputPath);
    
    logger.debug(`  [AUDIO] Concatenated audio saved to ${outputPath} (${duration}s)`);
    return duration;
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Audio concatenation failed");
    
    // Fallback to simple concatenation
    logger.warn("  [WARN] Falling back to simple concatenation");
    return await fallbackConcatenate(audioFiles, outputPath);
  }
}

/**
 * Simple fallback concatenation (just append buffers)
 * This doesn't add gaps or handle audio encoding properly,
 * but works as a last resort
 */
async function fallbackConcatenate(
  audioFiles: string[],
  outputPath: string
): Promise<number> {
  logger.debug(`  [AUDIO] Using fallback concatenation for ${audioFiles.length} files`);
  
  const buffers: Buffer[] = [];
  let totalEstimatedDuration = 0;

  for (const file of audioFiles) {
    try {
      const buffer = await fs.readFile(file);
      buffers.push(buffer);
      
      // Rough duration estimate: ~1KB per second for MP3
      totalEstimatedDuration += buffer.length / 1024;
    } catch (error) {
      logger.warn({ err: error, file }, `  [WARN] Failed to read audio file ${file}`);
    }
  }

  const combined = Buffer.concat(buffers);
  await fs.writeFile(outputPath, combined);

  logger.debug(`  [AUDIO] Fallback concatenation complete (~${Math.ceil(totalEstimatedDuration)}s estimated)`);
  return Math.ceil(totalEstimatedDuration);
}

/**
 * Get audio duration using ffprobe
 * Falls back to estimation if ffprobe is not available
 */
async function getAudioDuration(filePath: string): Promise<number> {
  try {
    const command = `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`;
    const { stdout } = await execAsync(command);
    const duration = parseFloat(stdout.trim());
    
    if (isNaN(duration)) {
      throw new Error("Invalid duration from ffprobe");
    }
    
    return Math.ceil(duration);
  } catch {
    // Fallback: estimate from file size
    const stats = await fs.stat(filePath);
    const estimatedDuration = Math.ceil(stats.size / 1024); // Rough estimate: ~1KB per second
    logger.debug(`  [AUDIO] Estimated duration: ${estimatedDuration}s (ffprobe not available)`);
    return estimatedDuration;
  }
}

/**
 * Mix/concatenate audio files for duo presenter segments
 * This is a convenience wrapper around concatenateAudioFiles
 */
export async function mixDuoAudio(
  audioSegments: { presenterId: string; filePath: string }[],
  outputPath: string
): Promise<number> {
  const audioFiles = audioSegments.map((segment) => segment.filePath);
  
  logger.debug(
    `  [AUDIO] Mixing ${audioSegments.length} duo segments: ${audioSegments.map((s) => s.presenterId).join(", ")}`
  );
  
  return await concatenateAudioFiles(audioFiles, outputPath, 0.3); // Small gap between presenters
}
