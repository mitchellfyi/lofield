/**
 * Tests for seasonal integration helpers
 */

import {
  enhanceMusicRequestWithSeason,
  enhanceScriptRequestWithSeason,
  getContentContextTags,
  getShowSeasonOverrides,
  getShowHolidayOverrides,
} from "../seasonal-integration";
import type { MusicGenerationRequest, ScriptGenerationRequest } from "../ai/types";

describe("Seasonal Integration Helpers", () => {
  describe("enhanceMusicRequestWithSeason", () => {
    it("should add seasonal bias to music request", () => {
      const request: MusicGenerationRequest = {
        prompt: "chill lofi beats",
        duration: 180,
      };

      const date = new Date("2025-01-15");
      const enhanced = enhanceMusicRequestWithSeason(request, {
        date,
        hemisphere: "northern",
      });

      expect(enhanced.seasonalBias).toBeDefined();
      expect(typeof enhanced.seasonalBias).toBe("string");
      expect(enhanced.prompt).toBe("chill lofi beats");
    });

    it("should not add seasonal bias when disabled", () => {
      const request: MusicGenerationRequest = {
        prompt: "chill lofi beats",
      };

      const enhanced = enhanceMusicRequestWithSeason(request, {
        enableSeasonalBias: false,
      });

      expect(enhanced.seasonalBias).toBeUndefined();
    });

    it("should preserve existing request properties", () => {
      const request: MusicGenerationRequest = {
        prompt: "relaxing music",
        duration: 240,
        bpm: 80,
        mood: ["calm", "peaceful"],
        tags: ["study", "focus"],
      };

      const enhanced = enhanceMusicRequestWithSeason(request);

      expect(enhanced.prompt).toBe("relaxing music");
      expect(enhanced.duration).toBe(240);
      expect(enhanced.bpm).toBe(80);
      expect(enhanced.mood).toEqual(["calm", "peaceful"]);
      expect(enhanced.tags).toEqual(["study", "focus"]);
    });
  });

  describe("enhanceScriptRequestWithSeason", () => {
    it("should add season and holiday context to script request", () => {
      const request: ScriptGenerationRequest = {
        segmentType: "track_intro",
        showStyle: "mild_panic_mornings",
        presenterIds: ["morgan", "riley"],
      };

      const date = new Date("2025-12-25");
      const enhanced = enhanceScriptRequestWithSeason(request, {
        date,
        hemisphere: "northern",
      });

      expect(enhanced.contextInfo?.season).toBe("winter");
      expect(enhanced.contextInfo?.holidayTags).toContain("christmas_day");
    });

    it("should not add holiday tags when disabled", () => {
      const request: ScriptGenerationRequest = {
        segmentType: "segment",
        showStyle: "deep_work_calendar_blocks",
        presenterIds: ["alex", "sam"],
      };

      const date = new Date("2025-12-25");
      const enhanced = enhanceScriptRequestWithSeason(request, {
        date,
        enableHolidayTags: false,
      });

      expect(enhanced.contextInfo?.season).toBe("winter");
      expect(enhanced.contextInfo?.holidayTags).toBeUndefined();
    });

    it("should preserve existing context info", () => {
      const request: ScriptGenerationRequest = {
        segmentType: "track_intro",
        showStyle: "mild_panic_mornings",
        presenterIds: ["morgan", "riley"],
        contextInfo: {
          currentTime: new Date(),
          weather: "rainy",
          previousTrack: "Morning Coffee",
        },
      };

      const date = new Date("2025-06-15");
      const enhanced = enhanceScriptRequestWithSeason(request, { date });

      expect(enhanced.contextInfo?.currentTime).toBeDefined();
      expect(enhanced.contextInfo?.weather).toBe("rainy");
      expect(enhanced.contextInfo?.previousTrack).toBe("Morning Coffee");
      expect(enhanced.contextInfo?.season).toBe("summer");
    });

    it("should not add holidayTags field for non-holiday dates", () => {
      const request: ScriptGenerationRequest = {
        segmentType: "segment",
        showStyle: "afternoon_survival_session",
        presenterIds: ["presenter1", "presenter2"],
      };

      const date = new Date("2025-03-15");
      const enhanced = enhanceScriptRequestWithSeason(request, { date });

      expect(enhanced.contextInfo?.season).toBe("spring");
      expect(enhanced.contextInfo?.holidayTags).toBeUndefined();
    });
  });

  describe("getContentContextTags", () => {
    it("should return seasonal tags for non-holiday date", () => {
      const date = new Date("2025-01-15");
      const tags = getContentContextTags({ date, hemisphere: "northern" });

      expect(tags).toContain("winter_weather");
      expect(tags.length).toBeGreaterThan(0);
    });

    it("should return combined seasonal and holiday tags", () => {
      const date = new Date("2025-12-25");
      const tags = getContentContextTags({ date, hemisphere: "northern" });

      expect(tags).toContain("winter_weather");
      expect(tags).toContain("christmas_day");
    });
  });

  describe("getShowSeasonOverrides", () => {
    it("should return season overrides when present", () => {
      const showConfig = {
        season_overrides: {
          winter: {
            tone_adjustment: "Reference darkness, cold commutes",
            additional_topics: ["dark_mornings", "cold_weather"],
          },
        },
      };

      const date = new Date("2025-01-15");
      const overrides = getShowSeasonOverrides(showConfig, {
        date,
        hemisphere: "northern",
      });

      expect(overrides.additionalTopics).toContain("dark_mornings");
      expect(overrides.additionalTopics).toContain("cold_weather");
      expect(overrides.toneAdjustment).toBe(
        "Reference darkness, cold commutes"
      );
    });

    it("should return empty array when no overrides for season", () => {
      const showConfig = {
        season_overrides: {
          winter: {
            additional_topics: ["winter_topic"],
          },
        },
      };

      const date = new Date("2025-07-15"); // Summer
      const overrides = getShowSeasonOverrides(showConfig, {
        date,
        hemisphere: "northern",
      });

      expect(overrides.additionalTopics).toEqual([]);
      expect(overrides.toneAdjustment).toBeUndefined();
    });

    it("should return empty array when no season_overrides in config", () => {
      const showConfig = {};

      const overrides = getShowSeasonOverrides(showConfig);

      expect(overrides.additionalTopics).toEqual([]);
      expect(overrides.toneAdjustment).toBeUndefined();
    });
  });

  describe("getShowHolidayOverrides", () => {
    it("should return holiday overrides when date matches", () => {
      const showConfig = {
        holiday_overrides: {
          christmas_period: {
            dates: ["2025-12-24", "2025-12-25", "2025-12-26"],
            tone_adjustment: "Acknowledge holiday time",
            notes: "Some people work through holidays",
          },
        },
      };

      const date = new Date("2025-12-25");
      const overrides = getShowHolidayOverrides(showConfig, { date });

      expect(overrides).not.toBeNull();
      expect(overrides?.toneAdjustment).toBe("Acknowledge holiday time");
      expect(overrides?.notes).toBe("Some people work through holidays");
    });

    it("should return null when date does not match", () => {
      const showConfig = {
        holiday_overrides: {
          christmas_period: {
            dates: ["2025-12-24", "2025-12-25"],
            tone_adjustment: "Holiday vibes",
          },
        },
      };

      const date = new Date("2025-01-15");
      const overrides = getShowHolidayOverrides(showConfig, { date });

      expect(overrides).toBeNull();
    });

    it("should return null when no holiday_overrides in config", () => {
      const showConfig = {};

      const overrides = getShowHolidayOverrides(showConfig);

      expect(overrides).toBeNull();
    });

    it("should handle multiple holiday periods", () => {
      const showConfig = {
        holiday_overrides: {
          new_year: {
            dates: ["2025-01-01"],
            tone_adjustment: "New year energy",
            sample_line: "New year, same commute",
          },
          christmas: {
            dates: ["2025-12-25"],
            tone_adjustment: "Christmas vibes",
          },
        },
      };

      const newYearDate = new Date("2025-01-01");
      const newYearOverrides = getShowHolidayOverrides(showConfig, {
        date: newYearDate,
      });

      expect(newYearOverrides?.sampleLine).toBe("New year, same commute");

      const christmasDate = new Date("2025-12-25");
      const christmasOverrides = getShowHolidayOverrides(showConfig, {
        date: christmasDate,
      });

      expect(christmasOverrides?.toneAdjustment).toBe("Christmas vibes");
    });
  });
});
