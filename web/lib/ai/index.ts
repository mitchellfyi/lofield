/**
 * AI Modules Index
 *
 * Central export point for all AI modules.
 */

// Types
export type {
  MusicGenerationRequest,
  MusicGenerationResult,
  MusicMetadata,
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptMetadata,
  TTSRequest,
  TTSResult,
  TTSMetadata,
  SegmentType,
  ShowStyle,
  AIModuleConfig,
  CacheStats,
} from "./types";

export {
  MusicGenerationError,
  ScriptGenerationError,
  TTSError,
  CacheError,
  AIModuleError,
} from "./types";

// Configuration
export { getAIConfig, validateAIConfig } from "./config";

// Cache
export { AICache, createCache } from "./cache";

// Retry utility
export { withRetry, isRetryableError } from "./retry";

// Music generation
export {
  generateMusic,
  getMusicCacheStats,
  clearMusicCache,
} from "./music-generation";

// Script generation
export {
  generateScript,
  getScriptCacheStats,
  clearScriptCache,
} from "./script-generation";

// TTS
export { generateTTS, getTTSCacheStats, clearTTSCache } from "./tts";
