/**
 * Tests for Show Manager Module
 */

import {
  loadShowConfigs,
  getShowConfig,
  getAllShowConfigs,
  validateShowConfig,
  getShowConfigWithOverrides,
  clearShowConfigCache,
} from "../show-manager";

describe("Show Manager", () => {
  beforeEach(() => {
    clearShowConfigCache();
  });

  describe("loadShowConfigs", () => {
    it("should load show configurations", async () => {
      const configs = await loadShowConfigs();
      expect(configs.size).toBeGreaterThan(0);
    });

    it("should cache configurations", async () => {
      const configs1 = await loadShowConfigs();
      const configs2 = await loadShowConfigs();
      expect(configs1).toBe(configs2);
    });

    it("should force reload when requested", async () => {
      const configs1 = await loadShowConfigs();
      const configs2 = await loadShowConfigs(true);
      expect(configs1).not.toBe(configs2);
    });
  });

  describe("getShowConfig", () => {
    it("should retrieve a specific show config", async () => {
      const config = await getShowConfig("mild_panic_mornings");
      expect(config).not.toBeNull();
      expect(config?.name).toBe("Mild Panic Mornings");
    });

    it("should return null for non-existent show", async () => {
      const config = await getShowConfig("nonexistent_show");
      expect(config).toBeNull();
    });
  });

  describe("getAllShowConfigs", () => {
    it("should return all show configurations", async () => {
      const configs = await getAllShowConfigs();
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty("id");
      expect(configs[0]).toHaveProperty("name");
    });
  });

  describe("validateShowConfig", () => {
    it("should validate a correct show config", async () => {
      const config = await getShowConfig("mild_panic_mornings");
      if (!config) {
        throw new Error("Config not found");
      }

      const result = validateShowConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect music fraction exceeding maximum", async () => {
      const config = await getShowConfig("mild_panic_mornings");
      if (!config) {
        throw new Error("Config not found");
      }

      const invalidConfig = {
        ...config,
        ratios: {
          music_fraction: 0.7, // Exceeds 0.60 max
          talk_fraction: 0.3,
        },
      };

      const result = validateShowConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Music fraction");
    });

    it("should detect talk fraction below minimum", async () => {
      const config = await getShowConfig("mild_panic_mornings");
      if (!config) {
        throw new Error("Config not found");
      }

      const invalidConfig = {
        ...config,
        ratios: {
          music_fraction: 0.7,
          talk_fraction: 0.3, // Below 0.40 min
        },
      };

      const result = validateShowConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect incorrect duration", async () => {
      const config = await getShowConfig("mild_panic_mornings");
      if (!config) {
        throw new Error("Config not found");
      }

      const invalidConfig = {
        ...config,
        schedule: {
          ...config.schedule,
          duration_hours: 2, // Should be 3
        },
      };

      const result = validateShowConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes("Duration"))).toBe(true);
    });
  });

  describe("getShowConfigWithOverrides", () => {
    it("should apply seasonal overrides", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter"
      );

      expect(config).not.toBeNull();
      if (!config) return;

      // Check if winter topics were added
      const hasWinterTopics = config.topics.primary_tags.some(
        (tag) =>
          tag.includes("winter") || tag.includes("dark") || tag.includes("cold")
      );
      expect(hasWinterTopics).toBe(true);
    });

    it("should return config without overrides for non-existent season", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "spring"
      );

      expect(config).not.toBeNull();
    });

    it("should handle holiday overrides", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter",
        "Christmas"
      );

      expect(config).not.toBeNull();
    });

    it("should deep merge tone adjustments", async () => {
      const config = await getShowConfigWithOverrides(
        "mild_panic_mornings",
        "winter"
      );

      expect(config).not.toBeNull();
      if (!config) return;

      // Should preserve original tone keywords while adding seasonal adjustment
      expect(config.tone.keywords).toBeDefined();
      expect(config.tone.keywords.length).toBeGreaterThan(0);
    });
  });
});
