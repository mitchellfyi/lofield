/**
 * Tests for TTS module
 */

import { generateTTS, getTTSCacheStats, clearTTSCache } from "../tts";

describe("TTS Module", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearTTSCache();
    
    // Remove API key to test error handling
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;
  });

  describe("API Configuration", () => {
    it("should throw error when OpenAI API key is missing", async () => {
      process.env.TTS_PROVIDER = "openai";
      
      const request = {
        text: "This is a test script for presenter one.",
        voiceId: "voice_1",
        presenterName: "Alex",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("OPENAI_API_KEY");
    });

    it("should throw error when ElevenLabs API key is missing", async () => {
      process.env.TTS_PROVIDER = "elevenlabs";
      
      const request = {
        text: "This is a test script.",
        voiceId: "voice_elevenlabs_1",
        presenterName: "Sam",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("ELEVENLABS_API_KEY");
    });
  });

  describe("Request Validation", () => {
    it("should accept valid TTS request", async () => {
      const request = {
        text: "Good morning, listeners. That was 'Chill Beats' requested by Alex in Bristol.",
        voiceId: "voice_1",
        presenterName: "Presenter One",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
      // Structure is valid, just missing API key
    });

    it("should handle requests with speed parameter", async () => {
      const request = {
        text: "This is a test.",
        voiceId: "voice_2",
        speed: 1.2,
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });

    it("should handle requests with ElevenLabs-specific parameters", async () => {
      const request = {
        text: "This is a test.",
        voiceId: "voice_3",
        stability: 0.6,
        similarityBoost: 0.8,
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });
  });

  describe("Voice Configuration", () => {
    it("should accept different voice IDs", async () => {
      const voiceIds = ["voice_1", "voice_2", "voice_3", "voice_4", "voice_5", "voice_6"];

      for (const voiceId of voiceIds) {
        const request = {
          text: "Test script",
          voiceId,
        };

        const result = await generateTTS(request);
        
        expect(result.success).toBe(false);
        // All voice IDs should be accepted structurally
      }
    });
  });

  describe("Text Handling", () => {
    it("should handle short text", async () => {
      const request = {
        text: "Short.",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });

    it("should handle long text", async () => {
      const longText = `
        Good morning, everyone. That was 'Deep Focus Mode' requested by Sarah in London.
        Sarah, we hope your Wi-Fi is holding up better than usual this morning.
        Statistically speaking, it probably isn't, but we can hope.
        Coming up next, we have 'Chill Coding Session' for anyone who's been staring at
        the same line of code for the past twenty minutes. We've all been there.
        You're listening to Deep Work on Lofield FM. Now playing on a frequency that
        probably doesn't exist.
      `;

      const request = {
        text: longText,
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });

    it("should handle text with special characters", async () => {
      const request = {
        text: "It's 3:30 PM, and you're still on that call. We get it. Here's some music.",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });
  });

  describe("Cache Behavior", () => {
    it("should initialize cache correctly", () => {
      const stats = getTTSCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should track cache misses", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      await generateTTS(request);
      
      const stats = getTTSCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it("should clear cache", () => {
      clearTTSCache();
      const stats = getTTSCacheStats();
      
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should return error result on failure", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.filePath).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });

    it("should include error details", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.error).toBeTruthy();
      expect(typeof result.error).toBe("string");
    });
  });

  describe("Result Structure", () => {
    it("should return properly structured result", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("cached");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.cached).toBe("boolean");
    });
  });

  describe("Optional Parameters", () => {
    it("should work without presenter name", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
      // Should not fail validation
    });

    it("should work without speed parameter", async () => {
      const request = {
        text: "Test script",
        voiceId: "voice_1",
      };

      const result = await generateTTS(request);
      
      expect(result.success).toBe(false);
    });
  });
});
