/**
 * Tests for Show Manager Enhancements
 * Tests for deep merge, async I/O, and seasonal override features
 */

import {
  getShowConfigWithOverrides,
  clearShowConfigCache,
} from "../show-manager";

describe("Show Manager Enhancements", () => {
  beforeEach(() => {
    clearShowConfigCache();
  });

  describe("Deep Merge for Seasonal Overrides", () => {
    it("should preserve original tone keywords when applying seasonal adjustments", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Should have original tone keywords
      expect(config.tone.keywords).toBeDefined();
      expect(config.tone.keywords.length).toBeGreaterThan(0);
      
      // Should contain original keywords
      expect(config.tone.keywords).toContain("controlled chaos");
      expect(config.tone.keywords).toContain("resigned acceptance");
    });

    it("should add seasonal topics without losing original topics", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Should have original topics
      expect(config.topics.primary_tags).toContain("morning_routine");
      expect(config.topics.primary_tags).toContain("commute");
      
      // Should also have winter topics
      const hasWinterTopics = config.topics.primary_tags.some(
        tag => tag.includes("winter") || tag.includes("dark") || tag.includes("cold")
      );
      expect(hasWinterTopics).toBe(true);
    });

    it("should apply holiday tone adjustments without overwriting base tone", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter",
        "christmas"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Should preserve original mood
      expect(config.tone.mood).toBeDefined();
      expect(config.tone.mood).toContain("Controlled chaos");
    });

    it("should handle multiple seasonal layers (season + holiday)", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter",
        "new_year"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Should have winter topics
      const hasWinterTopics = config.topics.primary_tags.some(
        tag => tag.includes("winter") || tag.includes("dark")
      );
      expect(hasWinterTopics).toBe(true);
      
      // Should preserve original configuration
      expect(config.tone.keywords.length).toBeGreaterThan(0);
      expect(config.topics.primary_tags).toContain("morning_routine");
    });

    it("should deduplicate topics when merging", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "summer"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Check for duplicate topics
      const uniqueTags = new Set(config.topics.primary_tags);
      expect(uniqueTags.size).toBe(config.topics.primary_tags.length);
    });
  });

  describe("Async I/O Non-Blocking Behavior", () => {
    it("should load multiple show configs concurrently", async () => {
      const startTime = Date.now();
      
      // Load multiple configs in parallel
      const [config1, config2, config3] = await Promise.all([
        getShowConfigWithOverrides("mild_panic_mornings", "winter"),
        getShowConfigWithOverrides("afternoon_survival_session", "summer"),
        getShowConfigWithOverrides("lofield_night_school", "autumn"),
      ]);
      
      const elapsed = Date.now() - startTime;
      
      // All should be loaded
      expect(config1).not.toBeNull();
      expect(config2).not.toBeNull();
      expect(config3).not.toBeNull();
      
      // Should be reasonably fast (concurrent, not sequential)
      // This is a rough check - async should be faster than sync would be
      expect(elapsed).toBeLessThan(1000); // 1 second is generous
    });
  });

  describe("Cache Behavior with Async", () => {
    it("should cache results from async loads", async () => {
      // First load
      const config1 = await getShowConfigWithOverrides("mild_panic_mornings", "winter");
      
      // Second load should use cache
      const config2 = await getShowConfigWithOverrides("mild_panic_mornings", "winter");
      
      // Both should exist
      expect(config1).not.toBeNull();
      expect(config2).not.toBeNull();
      
      // Should have same content (deep equality)
      expect(JSON.stringify(config1)).toBe(JSON.stringify(config2));
    });
  });
});
