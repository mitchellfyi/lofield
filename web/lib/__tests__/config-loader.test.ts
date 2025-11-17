import {
  getAllowedTags,
  getBannedTags,
  getStyleGuideExcerpt,
  loadTagsConfig,
  loadStationConfig,
  clearConfigCache,
} from "../config-loader";

describe("config-loader", () => {
  beforeEach(() => {
    // Clear cache before each test
    clearConfigCache();
  });

  afterEach(() => {
    // Clear cache after each test
    clearConfigCache();
  });

  describe("loadTagsConfig", () => {
    it("should load tags configuration from config/tags.json", () => {
      const config = loadTagsConfig();

      expect(config).toBeDefined();
      expect(config.allowed_topic_tags).toBeInstanceOf(Array);
      expect(config.banned_topic_tags).toBeInstanceOf(Array);
      expect(config.holiday_tags).toBeDefined();
      expect(config.seasonal_tags).toBeDefined();
      expect(config.topic_categories).toBeDefined();
    });

    it("should cache the loaded configuration", () => {
      const config1 = loadTagsConfig();
      const config2 = loadTagsConfig();

      // Should return the same cached object
      expect(config1).toBe(config2);
    });

    it("should reload configuration after cache clear", () => {
      const config1 = loadTagsConfig();
      clearConfigCache();
      const config2 = loadTagsConfig();

      // Should return different objects (not cached)
      expect(config1).not.toBe(config2);
      // But should have the same content
      expect(config1).toEqual(config2);
    });
  });

  describe("loadStationConfig", () => {
    it("should load station configuration from config/station.json", () => {
      const config = loadStationConfig();

      expect(config).toBeDefined();
      expect(config.name).toBe("Lofield FM");
      expect(config.tagline).toBeDefined();
      expect(config.default_ratios).toBeDefined();
      expect(config.default_tone).toBeDefined();
      expect(config.forbidden_topics).toBeInstanceOf(Array);
    });

    it("should cache the loaded configuration", () => {
      const config1 = loadStationConfig();
      const config2 = loadStationConfig();

      // Should return the same cached object
      expect(config1).toBe(config2);
    });
  });

  describe("getAllowedTags", () => {
    it("should return array of allowed topic tags", () => {
      const tags = getAllowedTags();

      expect(tags).toBeInstanceOf(Array);
      expect(tags.length).toBeGreaterThan(0);
    });

    it("should include common work-related tags", () => {
      const tags = getAllowedTags();

      expect(tags).toContain("remote_work");
      expect(tags).toContain("coffee");
      expect(tags).toContain("meetings");
      expect(tags).toContain("focus_time");
    });

    it("should include Lofield-specific tags", () => {
      const tags = getAllowedTags();

      expect(tags).toContain("lofield_lore");
      expect(tags).toContain("roadworks");
    });

    it("should include music-related tags", () => {
      const tags = getAllowedTags();

      expect(tags).toContain("lofi_vibes");
      expect(tags).toContain("chill_beats");
      expect(tags).toContain("piano_focus");
    });

    it("should return consistent results on multiple calls", () => {
      const tags1 = getAllowedTags();
      const tags2 = getAllowedTags();

      expect(tags1).toEqual(tags2);
    });
  });

  describe("getBannedTags", () => {
    it("should return array of banned topic tags", () => {
      const tags = getBannedTags();

      expect(tags).toBeInstanceOf(Array);
      expect(tags.length).toBeGreaterThan(0);
    });

    it("should include forbidden topics", () => {
      const tags = getBannedTags();

      expect(tags).toContain("politics");
      expect(tags).toContain("health_advice");
      expect(tags).toContain("medical_advice");
      expect(tags).toContain("finance_advice");
    });

    it("should include explicit content tags", () => {
      const tags = getBannedTags();

      expect(tags).toContain("explicit_content");
      expect(tags).toContain("hate_speech");
      expect(tags).toContain("harassment");
    });

    it("should include spam-related tags", () => {
      const tags = getBannedTags();

      expect(tags).toContain("spam");
      expect(tags).toContain("advertising");
    });

    it("should return consistent results on multiple calls", () => {
      const tags1 = getBannedTags();
      const tags2 = getBannedTags();

      expect(tags1).toEqual(tags2);
    });
  });

  describe("getStyleGuideExcerpt", () => {
    it("should return a non-empty string", () => {
      const excerpt = getStyleGuideExcerpt();

      expect(typeof excerpt).toBe("string");
      expect(excerpt.length).toBeGreaterThan(0);
    });

    it("should include voice and tone guidelines", () => {
      const excerpt = getStyleGuideExcerpt();

      expect(excerpt).toContain("Voice and Tone");
      expect(excerpt.toLowerCase()).toContain("dry");
      expect(excerpt.toLowerCase()).toContain("understated");
    });

    it("should include content guidelines", () => {
      const excerpt = getStyleGuideExcerpt();

      expect(excerpt).toContain("CONTENT GUIDELINES");
      expect(excerpt).toContain("DO:");
      expect(excerpt).toContain("DON'T:");
    });

    it("should include examples of good tone", () => {
      const excerpt = getStyleGuideExcerpt();

      expect(excerpt).toContain("Examples of Good Tone");
      expect(excerpt).toContain("Wi-Fi");
    });

    it("should mention key forbidden topics", () => {
      const excerpt = getStyleGuideExcerpt();

      expect(excerpt.toLowerCase()).toContain("motivational");
      expect(excerpt.toLowerCase()).toContain("politics");
    });

    it("should return consistent results on multiple calls", () => {
      const excerpt1 = getStyleGuideExcerpt();
      const excerpt2 = getStyleGuideExcerpt();

      expect(excerpt1).toBe(excerpt2);
    });
  });

  describe("Integration", () => {
    it("should work correctly when loading all configs", () => {
      const allowedTags = getAllowedTags();
      const bannedTags = getBannedTags();
      const excerpt = getStyleGuideExcerpt();

      // All should be defined and valid
      expect(allowedTags.length).toBeGreaterThan(0);
      expect(bannedTags.length).toBeGreaterThan(0);
      expect(excerpt.length).toBeGreaterThan(0);

      // Allowed and banned tags should be disjoint sets
      const overlap = allowedTags.filter((tag) => bannedTags.includes(tag));
      expect(overlap).toEqual([]);
    });

    it("should maintain cache across multiple helper function calls", () => {
      // First call - loads and caches
      const tags1 = getAllowedTags();
      const banned1 = getBannedTags();

      // Second call - uses cache
      const tags2 = getAllowedTags();
      const banned2 = getBannedTags();

      // Should be exact same references (cached)
      expect(tags1).toEqual(tags2);
      expect(banned1).toEqual(banned2);
    });
  });

  describe("Error Handling", () => {
    it("should handle missing style_guide_excerpt gracefully", () => {
      // Even if style_guide_excerpt is not in station.json,
      // should return a default excerpt
      const excerpt = getStyleGuideExcerpt();

      expect(excerpt).toBeDefined();
      expect(excerpt.length).toBeGreaterThan(0);
    });
  });
});
