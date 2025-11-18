/**
 * Music Generation Module
 *
 * Generates lofi music tracks using text-to-music AI models.
 * Supports ElevenLabs Music API for text-to-music generation.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import { getAIConfig } from "./config";
import { createCache } from "./cache";
import { withRetry, isRetryableError } from "./retry";
import type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicMetadata,
} from "./types";
import { MusicGenerationError } from "./types";

const ELEVENLABS_MUSIC_URL = "https://api.elevenlabs.io/v1/music";
const MIN_TRACK_DURATION_MS = 3_000;
const MAX_TRACK_DURATION_MS = 300_000;
const DEFAULT_EXTENSION = "mp3";

// Cache for music generation results
const config = getAIConfig();
const musicCache = createCache<MusicGenerationResult>(
  "music",
  config.music.cacheTTL,
  config.music.cacheEnabled,
  config.storage.cacheDir
);

/**
 * Generate a lofi music track from a text prompt
 */
export async function generateMusic(
  request: MusicGenerationRequest
): Promise<MusicGenerationResult> {
  // Check cache first
  const cached = musicCache.get(request);
  if (cached) {
    console.log(
      `Music cache hit for prompt: "${request.prompt.substring(0, 50)}..."`
    );
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(() => generateMusicInternal(request), {
      maxAttempts: config.retry.maxAttempts,
      baseDelay: config.retry.baseDelay,
      maxDelay: config.retry.maxDelay,
      onRetry: (attempt, error) => {
        console.warn(
          `Music generation attempt ${attempt} failed: ${error.message}`
        );
      },
    });

    // Cache successful result
    if (result.success && result.filePath) {
      musicCache.set(request, result, {
        prompt: request.prompt,
        generatedAt: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error("Music generation failed after all retries:", error);
    return {
      success: false,
      error: (error as Error).message,
      cached: false,
    };
  }
}

/**
 * Internal music generation logic
 */
async function generateMusicInternal(
  request: MusicGenerationRequest
): Promise<MusicGenerationResult> {
  const config = getAIConfig();

  if (config.music.provider === "elevenlabs") {
    return await generateMusicWithElevenLabs(request);
  } else {
    throw new MusicGenerationError(
      `Unsupported music provider: ${config.music.provider}`,
      { provider: config.music.provider }
    );
  }
}

/**
 * Generate music using ElevenLabs Music Generation API
 */
async function generateMusicWithElevenLabs(
  request: MusicGenerationRequest
): Promise<MusicGenerationResult> {
  const config = getAIConfig();
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new MusicGenerationError(
      "ELEVENLABS_API_KEY environment variable is not set. Please add ELEVENLABS_API_KEY to your .env file. Get your API key from: https://elevenlabs.io",
      { provider: "elevenlabs" }
    );
  }

  const durationSeconds = request.duration || config.music.defaultDuration;
  const durationMs = clamp(
    Math.round(durationSeconds * 1000),
    MIN_TRACK_DURATION_MS,
    MAX_TRACK_DURATION_MS
  );

  // Enhance prompt with lofi-specific instructions
  const enhancedPrompt = enhancePromptForLofi(request.prompt, request);

  const payload = {
    model_id: config.music.model || "music_v1",
    prompt: enhancedPrompt,
    music_length_ms: durationMs,
    force_instrumental: true,
  };

  console.log(
    `Generating music with ElevenLabs (${durationSeconds}s): "${enhancedPrompt.substring(0, 100)}..."`
  );

  try {
    const response = await fetch(ELEVENLABS_MUSIC_URL, {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      const message = `ElevenLabs API error: ${response.status} ${response.statusText}`;
      throw new MusicGenerationError(message, {
        provider: "elevenlabs",
        status: response.status,
        body: errorText,
      });
    }

    const contentType = response.headers.get("content-type") || undefined;
    const buffer = Buffer.from(await response.arrayBuffer());
    const extension = getExtensionFromContentType(contentType);
    const filePath = await saveAudioFile(buffer, request, extension);

    const metadata: MusicMetadata = {
      title: generateTitle(request),
      artist: "Lofield FM",
      duration: Math.round(durationMs / 1000),
      bpm: request.bpm,
      mood: request.mood,
      tags: request.tags,
      generatedAt: new Date(),
      model: config.music.model,
      prompt: enhancedPrompt,
      provider: "elevenlabs",
      sourceId: response.headers.get("song-id") || undefined,
      fileFormat: extension,
      contentType,
    };

    return {
      success: true,
      filePath,
      metadata,
      cached: false,
    };
  } catch (error) {
    const err = error as Error;

    if (isRetryableError(err)) {
      throw err; // Let retry logic handle it
    }

    throw new MusicGenerationError(
      `ElevenLabs generation failed: ${err.message}`,
      { error: err.message, prompt: request.prompt }
    );
  }
}

/**
 * Enhance prompt with lofi-specific characteristics
 */
function enhancePromptForLofi(
  prompt: string,
  request: MusicGenerationRequest
): string {
  let enhanced = prompt;

  // Add lofi characteristics if not already present
  const lofiKeywords = ["lofi", "lo-fi", "chill", "hip-hop"];
  const hasLofiKeyword = lofiKeywords.some((kw) =>
    prompt.toLowerCase().includes(kw)
  );

  if (!hasLofiKeyword) {
    enhanced = `lofi hip-hop, ${enhanced}`;
  }

  // Add mood descriptors
  if (request.mood && request.mood.length > 0) {
    enhanced = `${enhanced}, ${request.mood.join(", ")}`;
  }

  // Add BPM if specified
  if (request.bpm) {
    enhanced = `${enhanced}, ${request.bpm} BPM`;
  }

  // Add seasonal bias if present in request
  if (request.seasonalBias) {
    enhanced = `${enhanced}, ${request.seasonalBias}`;
  }

  // Add lofi production characteristics
  enhanced = `${enhanced}, soft vinyl crackle, warm analog sound, gentle lo-fi texture`;

  return enhanced;
}

/**
 * Persist generated audio to the storage directory.
 */
async function saveAudioFile(
  buffer: Buffer,
  request: MusicGenerationRequest,
  extension = DEFAULT_EXTENSION
): Promise<string> {
  const config = getAIConfig();
  const fsPromises = fs.promises;

  // Ensure storage directory exists
  try {
    await fsPromises.mkdir(config.storage.audioPath, { recursive: true });
  } catch {
    // Directory may already exist, ignore error
  }

  // Generate filename
  const hash = crypto
    .createHash("md5")
    .update(request.prompt)
    .digest("hex")
    .substring(0, 8);
  const timestamp = Date.now();
  const safeExtension = extension.startsWith(".")
    ? extension
    : `.${extension}`;
  const filename = `music_${timestamp}_${hash}${safeExtension}`;
  const filePath = path.join(config.storage.audioPath, filename);

  try {
    await fsPromises.writeFile(filePath, buffer);
    console.log(`Audio saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    throw new MusicGenerationError(
      `Failed to save audio: ${(error as Error).message}`,
      { error: (error as Error).message }
    );
  }
}

function getExtensionFromContentType(contentType?: string | null): string {
  if (!contentType) {
    return DEFAULT_EXTENSION;
  }

  if (contentType.includes("wav")) {
    return "wav";
  }
  if (contentType.includes("flac")) {
    return "flac";
  }
  if (contentType.includes("ogg")) {
    return "ogg";
  }

  // Most ElevenLabs responses are MP3 encoded
  return DEFAULT_EXTENSION;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

/**
 * Generate a title for the track based on the prompt
 */
function generateTitle(request: MusicGenerationRequest): string {
  // Extract key words from prompt
  const words = request.prompt
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);

  // Capitalize first letter of each word
  const titleWords = words.map(
    (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
  );

  return titleWords.join(" ") || "Lofi Track";
}

/**
 * Get cache statistics
 */
export function getMusicCacheStats() {
  return musicCache.getStats();
}

/**
 * Clear music cache
 */
export function clearMusicCache() {
  musicCache.clear();
}
