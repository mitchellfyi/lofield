/**
 * Text-to-Speech (TTS) Module
 *
 * Converts presenter scripts to audio using TTS services.
 * Supports OpenAI TTS and ElevenLabs.
 */

import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import OpenAI from "openai";
import { getAIConfig } from "./config";
import { createCache } from "./cache";
import { withRetry, isRetryableError } from "./retry";
import type { TTSRequest, TTSResult, TTSMetadata } from "./types";
import { TTSError } from "./types";

// OpenAI client (lazy-loaded)
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new TTSError(
      "OPENAI_API_KEY environment variable is not set. Please add OPENAI_API_KEY to your .env file. Get your API key from: https://platform.openai.com/api-keys",
      { provider: "openai" }
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

// Cache for TTS results (config captured at module load for cache settings)
const initialConfig = getAIConfig();
const ttsCache = createCache<TTSResult>(
  "tts",
  initialConfig.tts.cacheTTL,
  initialConfig.tts.cacheEnabled,
  initialConfig.storage.cacheDir
);

/**
 * Convert text to speech
 */
export async function generateTTS(request: TTSRequest): Promise<TTSResult> {
  const runtimeConfig = getAIConfig();
  // Check cache first
  // Cache key includes text, voiceId, and speed to avoid incorrect cache hits
  const cacheKey = {
    text: request.text,
    voiceId: request.voiceId,
    speed: request.speed || 1.0,
  };
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    console.log(`TTS cache hit for voice: ${request.voiceId}`);
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(() => generateTTSInternal(request), {
      maxAttempts: runtimeConfig.retry.maxAttempts,
      baseDelay: runtimeConfig.retry.baseDelay,
      maxDelay: runtimeConfig.retry.maxDelay,
      onRetry: (attempt, error) => {
        console.warn(`TTS attempt ${attempt} failed: ${error.message}`);
      },
    });

    // Cache successful result
    if (result.success && result.filePath) {
      ttsCache.set(cacheKey, result, {
        voiceId: request.voiceId,
        characterCount: request.text.length,
        generatedAt: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error("TTS generation failed after all retries:", error);
    return {
      success: false,
      error: (error as Error).message,
      cached: false,
    };
  }
}

/**
 * Internal TTS generation logic
 */
async function generateTTSInternal(request: TTSRequest): Promise<TTSResult> {
  const config = getAIConfig();

  if (config.tts.provider === "openai") {
    return await generateTTSWithOpenAI(request);
  } else if (config.tts.provider === "elevenlabs") {
    return await generateTTSWithElevenLabs(request);
  } else {
    throw new TTSError(`Unsupported TTS provider: ${config.tts.provider}`, {
      provider: config.tts.provider,
    });
  }
}

/**
 * Generate TTS using OpenAI
 */
async function generateTTSWithOpenAI(request: TTSRequest): Promise<TTSResult> {
  const config = getAIConfig();
  const openai = getOpenAIClient();

  // Map voice IDs to OpenAI voices
  // Supports both generic voice IDs and presenter-specific voice IDs
  const openaiVoiceMap: Record<
    string,
    "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"
  > = {
    // Generic voice IDs (backwards compatibility)
    voice_1: "alloy",
    voice_2: "echo",
    voice_3: "fable",
    voice_4: "onyx",
    voice_5: "nova",
    voice_6: "shimmer",
    // Presenter-specific voice IDs mapped to OpenAI voices
    // These can be customized based on presenter personalities
    voice_alex_contemplative: "onyx",
    voice_sam_quiet: "echo",
    voice_jordan_gentle: "nova",
    voice_casey_calm: "shimmer",
    voice_morgan_resigned: "fable",
    voice_riley_practical: "alloy",
    voice_taylor_focused: "onyx",
    voice_drew_quiet: "echo",
    voice_avery_conversational: "nova",
    voice_reese_friendly: "shimmer",
    voice_quinn_determined: "fable",
    voice_sage_steady: "alloy",
    voice_rowan_relaxed: "echo",
    voice_finley_easygoing: "nova",
    voice_harper_calm: "shimmer",
    voice_river_thoughtful: "onyx",
  };

  const openaiVoice = openaiVoiceMap[request.voiceId] || "alloy";
  const ttsModel = config.tts.model || "tts-1";

  console.log(
    `Generating TTS with OpenAI (model: ${ttsModel}, voice: ${openaiVoice} [${request.voiceId}], ${request.text.length} chars)`
  );

  try {
    const mp3 = await openai.audio.speech.create({
      model: ttsModel as "tts-1" | "tts-1-hd",
      voice: openaiVoice,
      input: request.text,
      speed: request.speed || 1.0,
    });

    // Save audio to file
    const filePath = await saveAudioBuffer(
      await mp3.arrayBuffer(),
      request,
      "mp3"
    );

    // Estimate duration (rough: ~150 words per minute)
    const wordCount = request.text.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);

    const metadata: TTSMetadata = {
      voiceId: request.voiceId,
      presenterName: request.presenterName,
      duration: estimatedDuration,
      text: request.text,
      generatedAt: new Date(),
      provider: "openai",
      characterCount: request.text.length,
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
      throw err;
    }

    throw new TTSError(`OpenAI TTS failed: ${err.message}`, {
      error: err.message,
      voiceId: request.voiceId,
    });
  }
}

/**
 * Generate TTS using ElevenLabs
 */
async function generateTTSWithElevenLabs(
  request: TTSRequest
): Promise<TTSResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new TTSError(
      "ELEVENLABS_API_KEY environment variable is not set. Please add ELEVENLABS_API_KEY to your .env file. Get your API key from: https://elevenlabs.io",
      { provider: "elevenlabs" }
    );
  }

  console.log(
    `Generating TTS with ElevenLabs (voice: ${request.voiceId}, ${request.text.length} chars)`
  );

  try {
    const config = getAIConfig();
    const modelId = config.tts.model || "eleven_multilingual_v2";
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`,
      {
        method: "POST",
        headers: {
          Accept: "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: modelId,
          voice_settings: {
            stability: request.stability ?? config.tts.stability ?? 0.5,
            similarity_boost:
              request.similarityBoost ?? config.tts.similarityBoost ?? 0.75,
          },
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
    }

    // Save audio to file
    const arrayBuffer = await response.arrayBuffer();
    const filePath = await saveAudioBuffer(arrayBuffer, request, "mp3");

    // Estimate duration
    const wordCount = request.text.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);

    const metadata: TTSMetadata = {
      voiceId: request.voiceId,
      presenterName: request.presenterName,
      duration: estimatedDuration,
      text: request.text,
      generatedAt: new Date(),
      provider: "elevenlabs",
      characterCount: request.text.length,
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
      throw err;
    }

    throw new TTSError(`ElevenLabs TTS failed: ${err.message}`, {
      error: err.message,
      voiceId: request.voiceId,
    });
  }
}

/**
 * Save audio buffer to file
 */
async function saveAudioBuffer(
  arrayBuffer: ArrayBuffer,
  request: TTSRequest,
  extension: string
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
    .update(request.text + request.voiceId)
    .digest("hex")
    .substring(0, 8);
  const timestamp = Date.now();
  const filename = `tts_${request.voiceId}_${timestamp}_${hash}.${extension}`;
  const filePath = path.join(config.storage.audioPath, filename);

  try {
    const buffer = Buffer.from(arrayBuffer);
    await fsPromises.writeFile(filePath, buffer);

    console.log(`TTS audio saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    throw new TTSError(`Failed to save audio: ${(error as Error).message}`, {
      error: (error as Error).message,
    });
  }
}

/**
 * Get cache statistics
 */
export function getTTSCacheStats() {
  return ttsCache.getStats();
}

/**
 * Clear TTS cache
 */
export function clearTTSCache() {
  ttsCache.clear();
}
