/**
 * Tests for AI configuration module
 */

import { getAIConfig, validateAIConfig } from "../config";

describe("AI Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment before each test
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original environment
    process.env = originalEnv;
  });

  describe("getAIConfig", () => {
    it("should return default configuration when no env vars are set", () => {
      const config = getAIConfig();

      expect(config.music.provider).toBe("elevenlabs");
      expect(config.music.defaultDuration).toBe(180);
      expect(config.script.provider).toBe("openai");
      expect(config.tts.provider).toBe("elevenlabs");
    });

    it("should use environment variables when set", () => {
      process.env.MUSIC_DEFAULT_DURATION = "240";
      process.env.SCRIPT_TEMPERATURE = "0.8";
      process.env.TTS_STABILITY = "0.7";

      const config = getAIConfig();

      expect(config.music.defaultDuration).toBe(240);
      expect(config.script.temperature).toBe(0.8);
      expect(config.tts.stability).toBe(0.7);
    });

    it("should handle cache configuration", () => {
      process.env.MUSIC_CACHE_ENABLED = "false";
      process.env.SCRIPT_CACHE_TTL = "7200";

      const config = getAIConfig();

      expect(config.music.cacheEnabled).toBe(false);
      expect(config.script.cacheTTL).toBe(7200);
    });

    it("should configure storage paths", () => {
      process.env.AUDIO_STORAGE_PATH = "/custom/audio";
      process.env.CACHE_DIR = "/custom/cache";

      const config = getAIConfig();

      expect(config.storage.audioPath).toBe("/custom/audio");
      expect(config.storage.cacheDir).toBe("/custom/cache");
    });

    it("should configure retry settings", () => {
      process.env.RETRY_MAX_ATTEMPTS = "5";
      process.env.RETRY_BASE_DELAY = "2000";
      process.env.RETRY_MAX_DELAY = "30000";

      const config = getAIConfig();

      expect(config.retry.maxAttempts).toBe(5);
      expect(config.retry.baseDelay).toBe(2000);
      expect(config.retry.maxDelay).toBe(30000);
    });
  });

  describe("validateAIConfig", () => {
    it("should accept valid configuration", () => {
      const config = getAIConfig();
      expect(() => validateAIConfig(config)).not.toThrow();
    });

    it("should reject invalid music duration", () => {
      const config = getAIConfig();
      config.music.defaultDuration = 30; // Too short

      expect(() => validateAIConfig(config)).toThrow("MUSIC_DEFAULT_DURATION");
    });

    it("should reject invalid script temperature", () => {
      const config = getAIConfig();
      config.script.temperature = 3.0; // Too high

      expect(() => validateAIConfig(config)).toThrow("SCRIPT_TEMPERATURE");
    });

    it("should reject invalid script max tokens", () => {
      const config = getAIConfig();
      config.script.maxTokens = 50; // Too low

      expect(() => validateAIConfig(config)).toThrow("SCRIPT_MAX_TOKENS");
    });

    it("should reject invalid TTS stability", () => {
      const config = getAIConfig();
      config.tts.stability = 1.5; // Out of range

      expect(() => validateAIConfig(config)).toThrow("TTS_STABILITY");
    });

    it("should reject invalid TTS similarity boost", () => {
      const config = getAIConfig();
      config.tts.similarityBoost = -0.1; // Out of range

      expect(() => validateAIConfig(config)).toThrow("TTS_SIMILARITY_BOOST");
    });

    it("should reject invalid retry attempts", () => {
      const config = getAIConfig();
      config.retry.maxAttempts = 0; // Too low

      expect(() => validateAIConfig(config)).toThrow("RETRY_MAX_ATTEMPTS");
    });
  });

  describe("Provider Configuration", () => {
    it("should support different music providers", () => {
      process.env.MUSIC_PROVIDER = "custom";
      const config = getAIConfig();
      expect(config.music.provider).toBe("custom");
    });

    it("should support different script providers", () => {
      process.env.SCRIPT_PROVIDER = "anthropic";
      const config = getAIConfig();
      expect(config.script.provider).toBe("anthropic");
    });

    it("should support different TTS providers", () => {
      process.env.TTS_PROVIDER = "elevenlabs";
      const config = getAIConfig();
      expect(config.tts.provider).toBe("elevenlabs");
    });
  });
});
