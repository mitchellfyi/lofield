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
    it("should merge season overrides with base config", () => {
      const showConfig = {
        primary_tags: ["remote_work", "focus"],
        tone: "dry and understated",
        season_overrides: {
          winter: {
            tone_adjustment: "Reference darkness, cold commutes",
            additional_topics: ["dark_mornings", "cold_weather"],
          },
        },
      };

      const date = new Date("2025-01-15");
      const merged = getShowSeasonOverrides(showConfig, {
        date,
        hemisphere: "northern",
      });

      // Should merge arrays (concatenate and deduplicate)
      expect(merged.primary_tags).toContain("remote_work");
      expect(merged.primary_tags).toContain("focus");
      expect(merged.primary_tags).toContain("dark_mornings");
      expect(merged.primary_tags).toContain("cold_weather");
      
      // Tone should be from override (replaces scalar values)
      expect(merged.tone).toBe("Reference darkness, cold commutes");
    });

    it("should return original config when no overrides for season", () => {
      const showConfig = {
        primary_tags: ["remote_work"],
        tone: "dry",
        season_overrides: {
          winter: {
            additional_topics: ["winter_topic"],
          },
        },
      };

      const date = new Date("2025-07-15"); // Summer
      const merged = getShowSeasonOverrides(showConfig, {
        date,
        hemisphere: "northern",
      });

      expect(merged.primary_tags).toEqual(["remote_work"]);
      expect(merged.tone).toBe("dry");
    });

    it("should return original config when no season_overrides in config", () => {
      const showConfig = {
        primary_tags: ["work"],
      };

      const merged = getShowSeasonOverrides(showConfig);

      expect(merged.primary_tags).toEqual(["work"]);
    });

    it("should deduplicate merged arrays", () => {
      const showConfig = {
        primary_tags: ["remote_work", "focus"],
        season_overrides: {
          winter: {
            additional_topics: ["remote_work", "cold_weather"], // "remote_work" is duplicate
          },
        },
      };

      const date = new Date("2025-01-15");
      const merged = getShowSeasonOverrides(showConfig, { date });

      // Should have deduplicated "remote_work"
      const remoteWorkCount = merged.primary_tags.filter(
        tag => tag === "remote_work"
      ).length;
      expect(remoteWorkCount).toBe(1);
      expect(merged.primary_tags).toContain("focus");
      expect(merged.primary_tags).toContain("cold_weather");
    });

    it("should deeply merge nested objects", () => {
      const showConfig = {
        commentary_style: {
          pacing: "conversational",
          references: ["Lofield"],
        },
        season_overrides: {
          winter: {
            additional_topics: ["winter_weather"],
            commentary_style: {
              seasonal_note: "Mention dark mornings",
            },
          },
        },
      };

      const date = new Date("2025-01-15");
      const merged = getShowSeasonOverrides(showConfig, { date });

      // Should preserve original commentary_style properties
      expect(merged.commentary_style.pacing).toBe("conversational");
      expect(merged.commentary_style.references).toEqual(["Lofield"]);
      // Should add new properties from override
      expect((merged.commentary_style as Record<string, unknown>).seasonal_note).toBe("Mention dark mornings");
    });
  });

  describe("getShowHolidayOverrides", () => {
    it("should merge holiday overrides when date matches", () => {
      const showConfig = {
        tone: "dry",
        commentary_style: {
          pacing: "conversational",
        },
        holiday_overrides: {
          christmas_period: {
            dates: ["2025-12-24", "2025-12-25", "2025-12-26"],
            tone_adjustment: "Acknowledge holiday time",
            sample_line: "Christmas. Some of us are still online.",
            notes: "Some people work through holidays",
          },
        },
      };

      const date = new Date("2025-12-25");
      const merged = getShowHolidayOverrides(showConfig, { date });

      // Tone should be from override
      expect(merged.tone).toBe("Acknowledge holiday time");
      
      // Sample line should be added to commentary_style
      expect((merged.commentary_style as Record<string, unknown>).sample_holiday_line).toBe(
        "Christmas. Some of us are still online."
      );
      
      // Original commentary_style properties should be preserved
      expect(merged.commentary_style.pacing).toBe("conversational");
      
      // Notes should be added
      expect((merged as Record<string, unknown>).notes).toBe("Some people work through holidays");
    });

    it("should return original config when date does not match", () => {
      const showConfig = {
        tone: "dry",
        holiday_overrides: {
          christmas_period: {
            dates: ["2025-12-24", "2025-12-25"],
            tone_adjustment: "Holiday vibes",
          },
        },
      };

      const date = new Date("2025-01-15");
      const merged = getShowHolidayOverrides(showConfig, { date });

      expect(merged.tone).toBe("dry");
    });

    it("should return original config when no holiday_overrides in config", () => {
      const showConfig = {
        tone: "dry",
      };

      const merged = getShowHolidayOverrides(showConfig);

      expect(merged.tone).toBe("dry");
    });

    it("should handle multiple holiday periods", () => {
      const showConfig = {
        tone: "dry",
        commentary_style: {} as Record<string, unknown>,
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
      const newYearMerged = getShowHolidayOverrides(showConfig, {
        date: newYearDate,
      });

      expect((newYearMerged.commentary_style as Record<string, unknown>).sample_holiday_line).toBe(
        "New year, same commute"
      );

      const christmasDate = new Date("2025-12-25");
      const christmasMerged = getShowHolidayOverrides(showConfig, {
        date: christmasDate,
      });

      expect(christmasMerged.tone).toBe("Christmas vibes");
    });

    it("should deeply merge commentary_style", () => {
      const showConfig = {
        commentary_style: {
          pacing: "conversational",
          references: ["Lofield Town Hall"],
        },
        holiday_overrides: {
          halloween: {
            dates: ["2025-10-31"],
            sample_line: "Halloween. The scariest thing is your inbox.",
          },
        },
      };

      const date = new Date("2025-10-31");
      const merged = getShowHolidayOverrides(showConfig, { date });

      // Original properties should be preserved
      expect(merged.commentary_style.pacing).toBe("conversational");
      expect(merged.commentary_style.references).toEqual(["Lofield Town Hall"]);
      // New property should be added
      expect((merged.commentary_style as Record<string, unknown>).sample_holiday_line).toBe(
        "Halloween. The scariest thing is your inbox."
      );
    });
  });
});
