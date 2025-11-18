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
    it("should load show configurations", () => {
      const configs = loadShowConfigs();
      expect(configs.size).toBeGreaterThan(0);
    });

    it("should cache configurations", () => {
      const configs1 = loadShowConfigs();
      const configs2 = loadShowConfigs();
      expect(configs1).toBe(configs2);
    });

    it("should force reload when requested", () => {
      const configs1 = loadShowConfigs();
      const configs2 = loadShowConfigs(true);
      expect(configs1).not.toBe(configs2);
    });
  });

  describe("getShowConfig", () => {
    it("should retrieve a specific show config", () => {
      const config = getShowConfig("deep_work_calendar_blocks");
      expect(config).not.toBeNull();
      expect(config?.name).toBe("Deep Work (According to Calendar Blocks)");
    });

    it("should return null for non-existent show", () => {
      const config = getShowConfig("nonexistent_show");
      expect(config).toBeNull();
    });
  });

  describe("getAllShowConfigs", () => {
    it("should return all show configurations", () => {
      const configs = getAllShowConfigs();
      expect(configs.length).toBeGreaterThan(0);
      expect(configs[0]).toHaveProperty("id");
      expect(configs[0]).toHaveProperty("name");
    });
  });

  describe("validateShowConfig", () => {
    it("should validate a correct show config", () => {
      const config = getShowConfig("deep_work_calendar_blocks");
      if (!config) {
        throw new Error("Config not found");
      }
      
      const result = validateShowConfig(config);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should detect music fraction exceeding maximum", () => {
      const config = getShowConfig("deep_work_calendar_blocks");
      if (!config) {
        throw new Error("Config not found");
      }

      const invalidConfig = {
        ...config,
        ratios: {
          music_fraction: 0.70, // Exceeds 0.60 max
          talk_fraction: 0.30,
        },
      };

      const result = validateShowConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Music fraction");
    });

    it("should detect talk fraction below minimum", () => {
      const config = getShowConfig("deep_work_calendar_blocks");
      if (!config) {
        throw new Error("Config not found");
      }

      const invalidConfig = {
        ...config,
        ratios: {
          music_fraction: 0.70,
          talk_fraction: 0.30, // Below 0.40 min
        },
      };

      const result = validateShowConfig(invalidConfig);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should detect incorrect duration", () => {
      const config = getShowConfig("deep_work_calendar_blocks");
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
      expect(result.errors.some(e => e.includes("Duration"))).toBe(true);
    });
  });

  describe("getShowConfigWithOverrides", () => {
    it("should apply seasonal overrides", () => {
      const config = getShowConfigWithOverrides(
        "deep_work_calendar_blocks",
        "winter"
      );
      
      expect(config).not.toBeNull();
      if (!config) return;

      // Check if winter topics were added
      const hasWinterTopics = config.topics.primary_tags.some(
        tag => tag.includes("winter") || tag.includes("dark")
      );
      expect(hasWinterTopics).toBe(true);
    });

    it("should return config without overrides for non-existent season", () => {
      const config = getShowConfigWithOverrides(
        "deep_work_calendar_blocks",
        "spring"
      );
      
      expect(config).not.toBeNull();
    });

    it("should handle holiday overrides", () => {
      const config = getShowConfigWithOverrides(
        "deep_work_calendar_blocks",
        "winter",
        "Christmas"
      );
      
      expect(config).not.toBeNull();
    });
  });
});
