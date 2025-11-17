/**
 * Type definitions for AI modules
 * 
 * This file contains shared types for music generation, script generation,
 * and text-to-speech modules.
 */

// ============================================================================
// Music Generation Types
// ============================================================================

export interface MusicGenerationRequest {
  prompt: string;
  duration?: number; // Target duration in seconds (default: 180)
  bpm?: number; // Target BPM (optional)
  mood?: string[]; // Mood descriptors
  tags?: string[]; // Metadata tags
}

export interface MusicGenerationResult {
  success: boolean;
  filePath?: string; // Path to generated audio file
  metadata?: MusicMetadata;
  error?: string;
  cached?: boolean; // Whether result was retrieved from cache
}

export interface MusicMetadata {
  title: string;
  artist: string;
  duration: number; // Actual duration in seconds
  bpm?: number;
  mood?: string[];
  tags?: string[];
  generatedAt: Date;
  model: string; // Which AI model was used
  prompt: string; // The prompt that generated this track
}

// ============================================================================
// Script Generation Types
// ============================================================================

export type SegmentType = 
  | "track_intro" // 15-30 seconds: Introduce upcoming track
  | "segment" // 1-2 minutes: Topical chat, Lofield references
  | "handover" // 5 minutes: Duo-to-duo transition between shows
  | "ident"; // 5-10 seconds: Brief station ID

export type ShowStyle =
  | "morning_commute" // The Fictional One
  | "deep_work" // According to Calendar Blocks
  | "lunch_club" // Allegedly Social
  | "survival" // Technically Still Operational
  | "commute" // Another One
  | "night_school" // For People Who Read Documentation
  | "night_shift" // For People Who Can't Sleep Anyway
  | "insomniac"; // Might As Well Be Productive

export interface ScriptGenerationRequest {
  segmentType: SegmentType;
  showStyle: ShowStyle;
  topic?: string; // Main topic (for segments)
  trackInfo?: {
    title: string;
    requester?: string;
    location?: string;
  };
  contextInfo?: {
    currentTime?: Date;
    previousTrack?: string;
    nextTrack?: string;
    season?: string;
    weather?: string;
  };
  presenterIds: string[]; // Duo presenter IDs
  durationSeconds?: number; // Target duration
}

export interface ScriptGenerationResult {
  success: boolean;
  transcript?: string;
  metadata?: ScriptMetadata;
  error?: string;
  cached?: boolean;
}

export interface ScriptMetadata {
  segmentType: SegmentType;
  tone: "dry" | "reflective" | "humorous" | "matter-of-fact";
  tags: string[];
  estimatedDuration: number; // Estimated seconds
  presenterIds: string[];
  generatedAt: Date;
  model: string;
}

// ============================================================================
// TTS (Text-to-Speech) Types
// ============================================================================

export interface TTSRequest {
  text: string;
  voiceId: string; // Presenter voice identifier
  presenterName?: string; // For logging/metadata
  speed?: number; // Speech rate (0.5 - 2.0, default 1.0)
  stability?: number; // Voice stability (0.0 - 1.0, for ElevenLabs)
  similarityBoost?: number; // Voice similarity (0.0 - 1.0, for ElevenLabs)
}

export interface TTSResult {
  success: boolean;
  filePath?: string; // Path to generated audio file
  metadata?: TTSMetadata;
  error?: string;
  cached?: boolean;
}

export interface TTSMetadata {
  voiceId: string;
  presenterName?: string;
  duration: number; // Actual audio duration in seconds
  text: string; // The text that was converted
  generatedAt: Date;
  provider: string; // "elevenlabs" | "openai" | "google" | etc.
  characterCount: number;
}

// ============================================================================
// Cache Types
// ============================================================================

export interface CacheEntry<T> {
  key: string;
  value: T;
  createdAt: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  hitRate: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface AIModuleConfig {
  music: {
    provider: "replicate" | "custom";
    model: string;
    defaultDuration: number;
    cacheEnabled: boolean;
    cacheTTL: number; // Time to live in seconds
  };
  script: {
    provider: "openai" | "anthropic";
    model: string;
    temperature: number;
    maxTokens: number;
    cacheEnabled: boolean;
    cacheTTL: number;
  };
  tts: {
    provider: "elevenlabs" | "openai" | "google";
    defaultVoice?: string;
    cacheEnabled: boolean;
    cacheTTL: number;
    stability?: number;
    similarityBoost?: number;
  };
  storage: {
    audioPath: string; // Base path for audio files
    cacheDir: string; // Directory for cache files
  };
  retry: {
    maxAttempts: number;
    baseDelay: number; // Base delay in ms for exponential backoff
    maxDelay: number; // Max delay in ms
  };
}

// ============================================================================
// Error Types
// ============================================================================

export class AIModuleError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AIModuleError";
  }
}

export class MusicGenerationError extends AIModuleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "MUSIC_GENERATION_ERROR", details);
    this.name = "MusicGenerationError";
  }
}

export class ScriptGenerationError extends AIModuleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "SCRIPT_GENERATION_ERROR", details);
    this.name = "ScriptGenerationError";
  }
}

export class TTSError extends AIModuleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "TTS_ERROR", details);
    this.name = "TTSError";
  }
}

export class CacheError extends AIModuleError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "CACHE_ERROR", details);
    this.name = "CacheError";
  }
}
