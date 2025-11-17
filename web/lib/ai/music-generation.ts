/**
 * Music Generation Module
 * 
 * Generates lofi music tracks using text-to-music AI models.
 * Supports Replicate API with MusicGen and other models.
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

// Replicate client (lazy-loaded)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let replicateClient: any = null;

/**
 * Get or initialize Replicate client
 */
function getReplicateClient() {
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new MusicGenerationError(
      "REPLICATE_API_TOKEN not set",
      { provider: "replicate" }
    );
  }

  if (!replicateClient) {
    try {
      // Dynamic import to avoid requiring Replicate if not used
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Replicate = require("replicate");
      replicateClient = new Replicate({
        auth: process.env.REPLICATE_API_TOKEN,
      });
    } catch (error) {
      throw new MusicGenerationError(
        "Failed to initialize Replicate client. Make sure 'replicate' package is installed.",
        { error: (error as Error).message }
      );
    }
  }

  return replicateClient;
}

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
    console.log(`Music cache hit for prompt: "${request.prompt.substring(0, 50)}..."`);
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(
      () => generateMusicInternal(request),
      {
        maxAttempts: config.retry.maxAttempts,
        baseDelay: config.retry.baseDelay,
        maxDelay: config.retry.maxDelay,
        onRetry: (attempt, error) => {
          console.warn(`Music generation attempt ${attempt} failed: ${error.message}`);
        },
      }
    );

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
  
  if (config.music.provider === "replicate") {
    return await generateMusicWithReplicate(request);
  } else {
    throw new MusicGenerationError(
      `Unsupported music provider: ${config.music.provider}`,
      { provider: config.music.provider }
    );
  }
}

/**
 * Generate music using Replicate API (MusicGen)
 */
async function generateMusicWithReplicate(
  request: MusicGenerationRequest
): Promise<MusicGenerationResult> {
  const config = getAIConfig();
  const replicate = getReplicateClient();

  const duration = request.duration || config.music.defaultDuration;
  
  // Enhance prompt with lofi-specific instructions
  const enhancedPrompt = enhancePromptForLofi(request.prompt, request);

  console.log(`Generating music with Replicate (${duration}s): "${enhancedPrompt.substring(0, 100)}..."`);

  try {
    // Run the model
    const output = await replicate.run(config.music.model, {
      input: {
        prompt: enhancedPrompt,
        duration: duration,
        temperature: 1.0,
        top_k: 250,
        top_p: 0.0,
        classifier_free_guidance: 3.0,
      },
    });

    // Download the generated audio
    if (!output) {
      throw new MusicGenerationError("No output from Replicate");
    }

    // Replicate returns a URL to the audio file
    const audioUrl = typeof output === "string" ? output : output[0];
    if (!audioUrl) {
      throw new MusicGenerationError("No audio URL in Replicate output");
    }

    // Download and save the audio file
    const filePath = await downloadAudio(audioUrl, request);

    // Get actual duration from the file (estimate for now)
    const actualDuration = duration; // TODO: Use ffprobe or similar to get actual duration

    const metadata: MusicMetadata = {
      title: generateTitle(request),
      artist: "Lofield FM",
      duration: actualDuration,
      bpm: request.bpm,
      mood: request.mood,
      tags: request.tags,
      generatedAt: new Date(),
      model: config.music.model,
      prompt: enhancedPrompt,
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
      `Replicate generation failed: ${err.message}`,
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

  // Add lofi production characteristics
  enhanced = `${enhanced}, soft vinyl crackle, warm analog sound, gentle lo-fi texture`;

  return enhanced;
}

/**
 * Download audio from URL and save to storage
 */
async function downloadAudio(
  url: string,
  request: MusicGenerationRequest
): Promise<string> {
  const config = getAIConfig();
  
  // Ensure storage directory exists
  if (!fs.existsSync(config.storage.audioPath)) {
    fs.mkdirSync(config.storage.audioPath, { recursive: true });
  }

  // Generate filename
  const hash = crypto.createHash("md5").update(request.prompt).digest("hex").substring(0, 8);
  const timestamp = Date.now();
  const filename = `music_${timestamp}_${hash}.wav`;
  const filePath = path.join(config.storage.audioPath, filename);

  try {
    // Download the file
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to download audio: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Save to disk
    fs.writeFileSync(filePath, buffer);

    console.log(`Audio saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    throw new MusicGenerationError(
      `Failed to download audio: ${(error as Error).message}`,
      { url, error: (error as Error).message }
    );
  }
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
  const titleWords = words.map((w) => 
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()
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
