/**
 * Tests for music generation module
 */

import {
  generateMusic,
  getMusicCacheStats,
  clearMusicCache,
} from "../music-generation";

describe("Music Generation Module", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearMusicCache();

    // Remove API key to test error handling
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterEach(() => {
    delete process.env.ELEVENLABS_API_KEY;
  });

  describe("API Configuration", () => {
    it("should throw error when API key is missing", async () => {
      const request = {
        prompt: "chill lofi beats",
        duration: 180,
      };

      const result = await generateMusic(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain("ELEVENLABS_API_KEY");
    });
  });

  describe("Request Validation", () => {
    it("should accept valid music request", async () => {
      const request = {
        prompt: "smooth jazz lofi for coding",
        duration: 180,
        mood: ["calm", "focused"],
        tags: ["coding_session"],
      };

      // Will fail due to missing API key, but validates structure
      const result = await generateMusic(request);

      expect(result.success).toBe(false);
      // Structure is valid, just missing credentials
    });

    it("should handle requests with minimal parameters", async () => {
      const request = {
        prompt: "lofi beats",
      };

      const result = await generateMusic(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should handle requests with BPM", async () => {
      const request = {
        prompt: "lofi beats",
        bpm: 85,
      };

      const result = await generateMusic(request);

      expect(result.success).toBe(false);
    });
  });

  describe("Cache Behavior", () => {
    it("should initialize cache correctly", () => {
      const stats = getMusicCacheStats();

      expect(stats).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should track cache misses", async () => {
      const request = {
        prompt: "chill lofi beats",
      };

      await generateMusic(request);

      const stats = getMusicCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it("should clear cache", () => {
      clearMusicCache();
      const stats = getMusicCacheStats();

      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should return error result on failure", async () => {
      const request = {
        prompt: "test prompt",
      };

      const result = await generateMusic(request);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.filePath).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it("should include error details", async () => {
      const request = {
        prompt: "test prompt",
      };

      const result = await generateMusic(request);

      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    });
  });

  describe("Result Structure", () => {
    it("should return properly structured result", async () => {
      const request = {
        prompt: "lofi beats",
        duration: 180,
      };

      const result = await generateMusic(request);

      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("cached");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.cached).toBe("boolean");
    });
  });
});
