/**
 * Configuration for AI modules
 *
 * Loads configuration from environment variables with sensible defaults.
 */

import type { AIModuleConfig } from "./types";

/**
 * Get AI module configuration from environment variables
 */
export function getAIConfig(): AIModuleConfig {
  const musicProvider =
    (process.env.MUSIC_PROVIDER as "elevenlabs" | "custom") || "elevenlabs";
  const ttsProvider =
    (process.env.TTS_PROVIDER as "elevenlabs" | "openai" | "google") ||
    "elevenlabs";
  const ttsModel =
    process.env.TTS_MODEL ||
    (ttsProvider === "elevenlabs" ? "eleven_multilingual_v2" : "tts-1");

  return {
    music: {
      provider: musicProvider,
      model: process.env.MUSIC_MODEL || "music_v1",
      defaultDuration: parseInt(
        process.env.MUSIC_DEFAULT_DURATION || "180",
        10
      ),
      cacheEnabled: process.env.MUSIC_CACHE_ENABLED !== "false",
      cacheTTL: parseInt(process.env.MUSIC_CACHE_TTL || "86400", 10), // 24 hours
    },
    script: {
      provider:
        (process.env.SCRIPT_PROVIDER as "openai" | "anthropic") || "openai",
      model: process.env.SCRIPT_MODEL || "gpt-4o-mini",
      temperature: parseFloat(process.env.SCRIPT_TEMPERATURE || "0.7"),
      maxTokens: parseInt(process.env.SCRIPT_MAX_TOKENS || "1000", 10),
      cacheEnabled: process.env.SCRIPT_CACHE_ENABLED !== "false",
      cacheTTL: parseInt(process.env.SCRIPT_CACHE_TTL || "3600", 10), // 1 hour
    },
    tts: {
      provider: ttsProvider,
      model: ttsModel,
      defaultVoice: process.env.TTS_DEFAULT_VOICE,
      cacheEnabled: process.env.TTS_CACHE_ENABLED !== "false",
      cacheTTL: parseInt(process.env.TTS_CACHE_TTL || "86400", 10), // 24 hours
      stability: parseFloat(process.env.TTS_STABILITY || "0.5"),
      similarityBoost: parseFloat(process.env.TTS_SIMILARITY_BOOST || "0.75"),
    },
    storage: {
      audioPath: process.env.AUDIO_STORAGE_PATH || "/tmp/lofield/audio",
      cacheDir: process.env.CACHE_DIR || "/tmp/lofield/cache",
    },
    retry: {
      maxAttempts: parseInt(process.env.RETRY_MAX_ATTEMPTS || "3", 10),
      baseDelay: parseInt(process.env.RETRY_BASE_DELAY || "1000", 10),
      maxDelay: parseInt(process.env.RETRY_MAX_DELAY || "10000", 10),
    },
  };
}

/**
 * Validate AI configuration
 */
export function validateAIConfig(config: AIModuleConfig): void {
  // Validate music config
  if (config.music.defaultDuration < 60 || config.music.defaultDuration > 600) {
    throw new Error(
      "Invalid MUSIC_DEFAULT_DURATION: must be between 60 and 600 seconds"
    );
  }

  // Validate script config
  if (config.script.temperature < 0 || config.script.temperature > 2) {
    throw new Error("Invalid SCRIPT_TEMPERATURE: must be between 0 and 2");
  }
  if (config.script.maxTokens < 100 || config.script.maxTokens > 4000) {
    throw new Error("Invalid SCRIPT_MAX_TOKENS: must be between 100 and 4000");
  }

  // Validate TTS config
  if (
    config.tts.stability !== undefined &&
    (config.tts.stability < 0 || config.tts.stability > 1)
  ) {
    throw new Error("Invalid TTS_STABILITY: must be between 0 and 1");
  }
  if (
    config.tts.similarityBoost !== undefined &&
    (config.tts.similarityBoost < 0 || config.tts.similarityBoost > 1)
  ) {
    throw new Error("Invalid TTS_SIMILARITY_BOOST: must be between 0 and 1");
  }

  // Validate retry config
  if (config.retry.maxAttempts < 1 || config.retry.maxAttempts > 10) {
    throw new Error("Invalid RETRY_MAX_ATTEMPTS: must be between 1 and 10");
  }
}
