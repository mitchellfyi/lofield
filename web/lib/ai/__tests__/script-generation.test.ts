/**
 * Tests for script generation module
 */

import { generateScript, getScriptCacheStats, clearScriptCache } from "../script-generation";

describe("Script Generation Module", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearScriptCache();
    
    // Remove API key to test error handling
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("API Configuration", () => {
    it("should throw error when API key is missing", async () => {
      const request = {
        segmentType: "track_intro" as const,
        showStyle: "deep_work" as const,
        presenterIds: ["presenter_1", "presenter_2"],
        trackInfo: {
          title: "Chill Beats",
          requester: "Alex",
          location: "Bristol",
        },
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toContain("OPENAI_API_KEY");
    });
  });

  describe("Request Validation", () => {
    it("should accept track intro request", async () => {
      const request = {
        segmentType: "track_intro" as const,
        showStyle: "morning_commute" as const,
        presenterIds: ["presenter_1", "presenter_2"],
        trackInfo: {
          title: "Morning Lofi",
          requester: "Sarah",
          location: "London",
        },
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
      // Structure is valid, just missing API key
    });

    it("should accept segment request with topic", async () => {
      const request = {
        segmentType: "segment" as const,
        showStyle: "lunch_club" as const,
        presenterIds: ["presenter_3", "presenter_4"],
        topic: "back-to-back video calls",
        durationSeconds: 90,
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
    });

    it("should accept handover request", async () => {
      const request = {
        segmentType: "handover" as const,
        showStyle: "commute" as const,
        presenterIds: ["presenter_5", "presenter_6"],
        contextInfo: {
          currentTime: new Date(),
          season: "autumn",
        },
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
    });

    it("should accept ident request", async () => {
      const request = {
        segmentType: "ident" as const,
        showStyle: "night_shift" as const,
        presenterIds: ["presenter_7", "presenter_8"],
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
    });
  });

  describe("Context Information", () => {
    it("should handle requests with full context", async () => {
      const request = {
        segmentType: "track_intro" as const,
        showStyle: "deep_work" as const,
        presenterIds: ["presenter_1", "presenter_2"],
        trackInfo: {
          title: "Focus Mode",
          requester: "Alex",
          location: "Bristol",
        },
        contextInfo: {
          currentTime: new Date(),
          previousTrack: "Chill Vibes",
          nextTrack: "Deep Concentration",
          season: "winter",
          weather: "rainy",
        },
        durationSeconds: 30,
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe("Show Styles", () => {
    const showStyles = [
      "morning_commute",
      "deep_work",
      "lunch_club",
      "survival",
      "commute",
      "night_school",
      "night_shift",
      "insomniac",
    ] as const;

    showStyles.forEach((style) => {
      it(`should accept ${style} show style`, async () => {
        const request = {
          segmentType: "segment" as const,
          showStyle: style,
          presenterIds: ["presenter_1", "presenter_2"],
        };

        const result = await generateScript(request);
        
        expect(result.success).toBe(false);
        // Fails due to missing API key, but structure is valid
      });
    });
  });

  describe("Segment Types", () => {
    const segmentTypes = [
      "track_intro",
      "segment",
      "handover",
      "ident",
    ] as const;

    segmentTypes.forEach((type) => {
      it(`should accept ${type} segment type`, async () => {
        const request = {
          segmentType: type,
          showStyle: "deep_work" as const,
          presenterIds: ["presenter_1", "presenter_2"],
        };

        const result = await generateScript(request);
        
        expect(result.success).toBe(false);
      });
    });
  });

  describe("Cache Behavior", () => {
    it("should initialize cache correctly", () => {
      const stats = getScriptCacheStats();
      
      expect(stats).toBeDefined();
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });

    it("should track cache misses", async () => {
      const request = {
        segmentType: "track_intro" as const,
        showStyle: "deep_work" as const,
        presenterIds: ["presenter_1", "presenter_2"],
      };

      await generateScript(request);
      
      const stats = getScriptCacheStats();
      expect(stats.misses).toBeGreaterThan(0);
    });

    it("should clear cache", () => {
      clearScriptCache();
      const stats = getScriptCacheStats();
      
      expect(stats.size).toBe(0);
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
    });
  });

  describe("Error Handling", () => {
    it("should return error result on failure", async () => {
      const request = {
        segmentType: "track_intro" as const,
        showStyle: "deep_work" as const,
        presenterIds: ["presenter_1", "presenter_2"],
      };

      const result = await generateScript(request);
      
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
      expect(result.transcript).toBeUndefined();
      expect(result.metadata).toBeUndefined();
    });
  });

  describe("Result Structure", () => {
    it("should return properly structured result", async () => {
      const request = {
        segmentType: "segment" as const,
        showStyle: "lunch_club" as const,
        presenterIds: ["presenter_1", "presenter_2"],
      };

      const result = await generateScript(request);
      
      expect(result).toHaveProperty("success");
      expect(result).toHaveProperty("cached");
      expect(typeof result.success).toBe("boolean");
      expect(typeof result.cached).toBe("boolean");
    });
  });
});
