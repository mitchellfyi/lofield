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
import type {
  TTSRequest,
  TTSResult,
  TTSMetadata,
} from "./types";
import { TTSError } from "./types";

// OpenAI client (lazy-loaded)
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new TTSError(
      "OPENAI_API_KEY not set",
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

// Cache for TTS results
const config = getAIConfig();
const ttsCache = createCache<TTSResult>(
  "tts",
  config.tts.cacheTTL,
  config.tts.cacheEnabled,
  config.storage.cacheDir
);

/**
 * Convert text to speech
 */
export async function generateTTS(
  request: TTSRequest
): Promise<TTSResult> {
  // Check cache first
  const cacheKey = { text: request.text, voiceId: request.voiceId };
  const cached = ttsCache.get(cacheKey);
  if (cached) {
    console.log(`TTS cache hit for voice: ${request.voiceId}`);
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(
      () => generateTTSInternal(request),
      {
        maxAttempts: config.retry.maxAttempts,
        baseDelay: config.retry.baseDelay,
        maxDelay: config.retry.maxDelay,
        onRetry: (attempt, error) => {
          console.warn(`TTS attempt ${attempt} failed: ${error.message}`);
        },
      }
    );

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
async function generateTTSInternal(
  request: TTSRequest
): Promise<TTSResult> {
  const config = getAIConfig();
  
  if (config.tts.provider === "openai") {
    return await generateTTSWithOpenAI(request);
  } else if (config.tts.provider === "elevenlabs") {
    return await generateTTSWithElevenLabs(request);
  } else {
    throw new TTSError(
      `Unsupported TTS provider: ${config.tts.provider}`,
      { provider: config.tts.provider }
    );
  }
}

/**
 * Generate TTS using OpenAI
 */
async function generateTTSWithOpenAI(
  request: TTSRequest
): Promise<TTSResult> {
  const openai = getOpenAIClient();

  // Map generic voice IDs to OpenAI voices
  const voiceMap: Record<string, "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer"> = {
    "voice_1": "alloy",
    "voice_2": "echo",
    "voice_3": "fable",
    "voice_4": "onyx",
    "voice_5": "nova",
    "voice_6": "shimmer",
  };

  const openaiVoice = voiceMap[request.voiceId] || "alloy";

  console.log(`Generating TTS with OpenAI (voice: ${openaiVoice}, ${request.text.length} chars)`);

  try {
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: openaiVoice,
      input: request.text,
      speed: request.speed || 1.0,
    });

    // Save audio to file
    const filePath = await saveAudioBuffer(await mp3.arrayBuffer(), request, "mp3");

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

    throw new TTSError(
      `OpenAI TTS failed: ${err.message}`,
      { error: err.message, voiceId: request.voiceId }
    );
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
      "ELEVENLABS_API_KEY not set",
      { provider: "elevenlabs" }
    );
  }
  
  console.log(`Generating TTS with ElevenLabs (voice: ${request.voiceId}, ${request.text.length} chars)`);

  try {
    const config = getAIConfig();
    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${request.voiceId}`,
      {
        method: "POST",
        headers: {
          "Accept": "audio/mpeg",
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text: request.text,
          model_id: "eleven_monolingual_v1",
          voice_settings: {
            stability: request.stability ?? config.tts.stability ?? 0.5,
            similarity_boost: request.similarityBoost ?? config.tts.similarityBoost ?? 0.75,
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

    throw new TTSError(
      `ElevenLabs TTS failed: ${err.message}`,
      { error: err.message, voiceId: request.voiceId }
    );
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
  
  // Ensure storage directory exists
  if (!fs.existsSync(config.storage.audioPath)) {
    fs.mkdirSync(config.storage.audioPath, { recursive: true });
  }

  // Generate filename
  const hash = crypto.createHash("md5")
    .update(request.text + request.voiceId)
    .digest("hex")
    .substring(0, 8);
  const timestamp = Date.now();
  const filename = `tts_${request.voiceId}_${timestamp}_${hash}.${extension}`;
  const filePath = path.join(config.storage.audioPath, filename);

  try {
    const buffer = Buffer.from(arrayBuffer);
    fs.writeFileSync(filePath, buffer);

    console.log(`TTS audio saved to: ${filePath}`);
    return filePath;
  } catch (error) {
    throw new TTSError(
      `Failed to save audio: ${(error as Error).message}`,
      { error: (error as Error).message }
    );
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
