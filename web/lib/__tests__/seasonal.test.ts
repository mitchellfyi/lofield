/**
 * Tests for seasonal and holiday logic
 */

import {
  getSeason,
  getSeasonalMoodProfile,
  getHolidaysForDate,
  getHolidaysInRange,
  isHoliday,
  getSeasonalTags,
  getContextTags,
  getSeasonalMusicMood,
  applySeasonalBiasToMusicPrompt,
  getHolidayScriptGuidance,
} from "../seasonal";

describe("Seasonal Logic", () => {
  describe("getSeason", () => {
    describe("Northern Hemisphere", () => {
      it("should return winter for December", () => {
        const date = new Date("2025-12-15");
        expect(getSeason(date, "northern")).toBe("winter");
      });

      it("should return winter for January", () => {
        const date = new Date("2025-01-15");
        expect(getSeason(date, "northern")).toBe("winter");
      });

      it("should return winter for February", () => {
        const date = new Date("2025-02-15");
        expect(getSeason(date, "northern")).toBe("winter");
      });

      it("should return spring for March", () => {
        const date = new Date("2025-03-15");
        expect(getSeason(date, "northern")).toBe("spring");
      });

      it("should return spring for April", () => {
        const date = new Date("2025-04-15");
        expect(getSeason(date, "northern")).toBe("spring");
      });

      it("should return spring for May", () => {
        const date = new Date("2025-05-15");
        expect(getSeason(date, "northern")).toBe("spring");
      });

      it("should return summer for June", () => {
        const date = new Date("2025-06-15");
        expect(getSeason(date, "northern")).toBe("summer");
      });

      it("should return summer for July", () => {
        const date = new Date("2025-07-15");
        expect(getSeason(date, "northern")).toBe("summer");
      });

      it("should return summer for August", () => {
        const date = new Date("2025-08-15");
        expect(getSeason(date, "northern")).toBe("summer");
      });

      it("should return autumn for September", () => {
        const date = new Date("2025-09-15");
        expect(getSeason(date, "northern")).toBe("autumn");
      });

      it("should return autumn for October", () => {
        const date = new Date("2025-10-15");
        expect(getSeason(date, "northern")).toBe("autumn");
      });

      it("should return autumn for November", () => {
        const date = new Date("2025-11-15");
        expect(getSeason(date, "northern")).toBe("autumn");
      });
    });

    describe("Southern Hemisphere", () => {
      it("should return summer for December in southern hemisphere", () => {
        const date = new Date("2025-12-15");
        expect(getSeason(date, "southern")).toBe("summer");
      });

      it("should return summer for January in southern hemisphere", () => {
        const date = new Date("2025-01-15");
        expect(getSeason(date, "southern")).toBe("summer");
      });

      it("should return autumn for March in southern hemisphere", () => {
        const date = new Date("2025-03-15");
        expect(getSeason(date, "southern")).toBe("autumn");
      });

      it("should return winter for June in southern hemisphere", () => {
        const date = new Date("2025-06-15");
        expect(getSeason(date, "southern")).toBe("winter");
      });

      it("should return spring for September in southern hemisphere", () => {
        const date = new Date("2025-09-15");
        expect(getSeason(date, "southern")).toBe("spring");
      });
    });

    it("should default to northern hemisphere", () => {
      const date = new Date("2025-06-15");
      expect(getSeason(date)).toBe("summer");
    });

    it("should use current date when no date provided", () => {
      const result = getSeason();
      expect(["winter", "spring", "summer", "autumn"]).toContain(result);
    });
  });

  describe("getSeasonalMoodProfile", () => {
    it("should return winter mood profile", () => {
      const date = new Date("2025-01-15");
      const profile = getSeasonalMoodProfile(date, "northern");

      expect(profile.season).toBe("winter");
      expect(profile.descriptors).toContain("cosy");
      expect(profile.descriptors).toContain("muted");
      expect(profile.musicMood.length).toBeGreaterThan(0);
      expect(profile.topicBias).toContain("dark mornings");
    });

    it("should return spring mood profile", () => {
      const date = new Date("2025-04-15");
      const profile = getSeasonalMoodProfile(date, "northern");

      expect(profile.season).toBe("spring");
      expect(profile.descriptors).toContain("fresh");
      expect(profile.topicBias).toContain("lighter evenings");
    });

    it("should return summer mood profile", () => {
      const date = new Date("2025-07-15");
      const profile = getSeasonalMoodProfile(date, "northern");

      expect(profile.season).toBe("summer");
      expect(profile.descriptors).toContain("bright");
      expect(profile.descriptors).toContain("breezy");
      expect(profile.topicBias).toContain("long evenings");
    });

    it("should return autumn mood profile", () => {
      const date = new Date("2025-10-15");
      const profile = getSeasonalMoodProfile(date, "northern");

      expect(profile.season).toBe("autumn");
      expect(profile.descriptors).toContain("mellow");
      expect(profile.topicBias).toContain("darker evenings");
    });
  });

  describe("getHolidaysForDate", () => {
    it("should return holiday tags for New Year", () => {
      const date = new Date("2025-01-01");
      const holidays = getHolidaysForDate(date);

      expect(holidays).toContain("new_year");
    });

    it("should return holiday tags for Christmas", () => {
      const date = new Date("2025-12-25");
      const holidays = getHolidaysForDate(date);

      expect(holidays).toContain("christmas_day");
    });

    it("should return holiday tags for Halloween", () => {
      const date = new Date("2025-10-31");
      const holidays = getHolidaysForDate(date);

      expect(holidays).toContain("halloween");
    });

    it("should return empty array for non-holiday date", () => {
      const date = new Date("2025-03-15");
      const holidays = getHolidaysForDate(date);

      expect(holidays).toEqual([]);
    });

    it("should work for 2026 dates", () => {
      const date = new Date("2026-01-01");
      const holidays = getHolidaysForDate(date);

      expect(holidays).toContain("new_year");
    });
  });

  describe("isHoliday", () => {
    it("should return true for holiday dates", () => {
      const date = new Date("2025-12-25");
      expect(isHoliday(date)).toBe(true);
    });

    it("should return false for non-holiday dates", () => {
      const date = new Date("2025-03-15");
      expect(isHoliday(date)).toBe(false);
    });
  });

  describe("getHolidaysInRange", () => {
    it("should return holidays within date range", () => {
      const startDate = new Date("2025-12-20");
      const endDate = new Date("2025-12-31");
      const holidays = getHolidaysInRange(startDate, endDate);

      expect(holidays.length).toBeGreaterThan(0);
      const christmasHoliday = holidays.find((h) => h.date === "2025-12-25");
      expect(christmasHoliday).toBeDefined();
      expect(christmasHoliday?.tags).toContain("christmas_day");
    });

    it("should return holidays in sorted order", () => {
      const startDate = new Date("2025-12-01");
      const endDate = new Date("2025-12-31");
      const holidays = getHolidaysInRange(startDate, endDate);

      for (let i = 1; i < holidays.length; i++) {
        expect(holidays[i].date >= holidays[i - 1].date).toBe(true);
      }
    });

    it("should return empty array when no holidays in range", () => {
      const startDate = new Date("2025-03-10");
      const endDate = new Date("2025-03-16");
      const holidays = getHolidaysInRange(startDate, endDate);

      expect(holidays).toEqual([]);
    });
  });

  describe("getSeasonalTags", () => {
    it("should return winter tags", () => {
      const tags = getSeasonalTags("winter");

      expect(tags).toContain("winter_weather");
      expect(tags).toContain("dark_evenings");
    });

    it("should return spring tags", () => {
      const tags = getSeasonalTags("spring");

      expect(tags).toContain("spring_weather");
      expect(tags).toContain("lighter_evenings");
    });

    it("should return summer tags", () => {
      const tags = getSeasonalTags("summer");

      expect(tags).toContain("summer_weather");
      expect(tags).toContain("long_evenings");
    });

    it("should return autumn tags", () => {
      const tags = getSeasonalTags("autumn");

      expect(tags).toContain("autumn_weather");
      expect(tags).toContain("darker_evenings");
    });
  });

  describe("getContextTags", () => {
    it("should return seasonal tags for non-holiday date", () => {
      const date = new Date("2025-01-15");
      const tags = getContextTags(date, "northern");

      expect(tags).toContain("winter_weather");
      expect(tags).toContain("dark_evenings");
    });

    it("should combine seasonal and holiday tags", () => {
      const date = new Date("2025-12-25");
      const tags = getContextTags(date, "northern");

      expect(tags).toContain("winter_weather");
      expect(tags).toContain("christmas_day");
    });

    it("should deduplicate tags", () => {
      const date = new Date("2025-12-25");
      const tags = getContextTags(date, "northern");

      const uniqueTags = [...new Set(tags)];
      expect(tags.length).toBe(uniqueTags.length);
    });
  });

  describe("getSeasonalMusicMood", () => {
    it("should return a mood descriptor for winter", () => {
      const date = new Date("2025-01-15");
      const mood = getSeasonalMusicMood(date, "northern");

      expect(typeof mood).toBe("string");
      expect(mood.length).toBeGreaterThan(0);
      // Should be from winter mood profile
      const winterMoods = [
        "warm and comforting",
        "soft ambient textures",
        "cosy winter atmosphere",
        "muted and reflective",
        "gentle winter ambience",
      ];
      expect(winterMoods).toContain(mood);
    });

    it("should return a mood descriptor for summer", () => {
      const date = new Date("2025-07-15");
      const mood = getSeasonalMusicMood(date, "northern");

      expect(typeof mood).toBe("string");
      expect(mood.length).toBeGreaterThan(0);
      // Should be from summer mood profile
      const summerMoods = [
        "bright and breezy",
        "relaxed summer vibes",
        "airy and open",
        "warm summer atmosphere",
        "light and easy",
      ];
      expect(summerMoods).toContain(mood);
    });

    it("should return consistent mood for the same date", () => {
      const date = new Date("2025-01-15");
      const mood1 = getSeasonalMusicMood(date, "northern");
      const mood2 = getSeasonalMusicMood(date, "northern");
      const mood3 = getSeasonalMusicMood(date, "northern");

      expect(mood1).toBe(mood2);
      expect(mood2).toBe(mood3);
    });

    it("should be deterministic based on day of year", () => {
      // Same day in different years should map to same index in mood array
      const date2025 = new Date("2025-03-15");
      const date2026 = new Date("2026-03-15");

      const mood2025 = getSeasonalMusicMood(date2025, "northern");
      const mood2026 = getSeasonalMusicMood(date2026, "northern");

      // Should be the same since it's the same day of year
      expect(mood2025).toBe(mood2026);
    });

    it("should cycle through all available moods over different days", () => {
      // Test several days in the same season to ensure variety
      const moods = new Set<string>();
      const winterMonth = 0; // January

      for (let day = 1; day <= 20; day++) {
        const date = new Date(2025, winterMonth, day);
        const mood = getSeasonalMusicMood(date, "northern");
        moods.add(mood);
      }

      // Should have at least 2 different moods (mood array has 5 items, 20 days should hit multiple)
      expect(moods.size).toBeGreaterThanOrEqual(2);
    });

    it("should return different moods for different hemispheres on same date", () => {
      const date = new Date("2025-01-15"); // Winter in north, summer in south
      const northernMood = getSeasonalMusicMood(date, "northern");
      const southernMood = getSeasonalMusicMood(date, "southern");

      // Different seasons = potentially different moods
      // (they could be same by coincidence, but verify they're from right season)
      const winterMoods = [
        "warm and comforting",
        "soft ambient textures",
        "cosy winter atmosphere",
        "muted and reflective",
        "gentle winter ambience",
      ];
      const summerMoods = [
        "bright and breezy",
        "relaxed summer vibes",
        "airy and open",
        "warm summer atmosphere",
        "light and easy",
      ];

      expect(winterMoods).toContain(northernMood);
      expect(summerMoods).toContain(southernMood);
    });

    it("should handle edge case dates (start/end of year)", () => {
      const newYearDate = new Date("2025-01-01");
      const newYearMood = getSeasonalMusicMood(newYearDate, "northern");
      expect(typeof newYearMood).toBe("string");
      expect(newYearMood.length).toBeGreaterThan(0);

      const endOfYearDate = new Date("2025-12-31");
      const endYearMood = getSeasonalMusicMood(endOfYearDate, "northern");
      expect(typeof endYearMood).toBe("string");
      expect(endYearMood.length).toBeGreaterThan(0);
    });

    it("should handle leap years correctly", () => {
      const leapDayDate = new Date("2024-02-29");
      const mood = getSeasonalMusicMood(leapDayDate, "northern");

      expect(typeof mood).toBe("string");
      expect(mood.length).toBeGreaterThan(0);

      // Should be from winter mood profile
      const winterMoods = [
        "warm and comforting",
        "soft ambient textures",
        "cosy winter atmosphere",
        "muted and reflective",
        "gentle winter ambience",
      ];
      expect(winterMoods).toContain(mood);
    });
  });

  describe("applySeasonalBiasToMusicPrompt", () => {
    it("should enhance prompt with seasonal mood", () => {
      const date = new Date("2025-01-15");
      const basePrompt = "chill lofi beats for studying";
      const enhanced = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      expect(enhanced).toContain(basePrompt);
      expect(enhanced.length).toBeGreaterThan(basePrompt.length);
      expect(enhanced).toMatch(/.*,\s+with a .+/); // Should have ", with a" phrase
    });

    it("should add different seasonal biases for different seasons", () => {
      const basePrompt = "lofi hip-hop";
      const winterDate = new Date("2025-01-15");
      const summerDate = new Date("2025-07-15");

      const winterPrompt = applySeasonalBiasToMusicPrompt(
        basePrompt,
        winterDate,
        "northern"
      );
      const summerPrompt = applySeasonalBiasToMusicPrompt(
        basePrompt,
        summerDate,
        "northern"
      );

      expect(winterPrompt).not.toBe(summerPrompt);
      expect(winterPrompt).toContain(basePrompt);
      expect(summerPrompt).toContain(basePrompt);
    });

    it("should produce grammatically correct prompts", () => {
      const date = new Date("2025-01-15");
      const basePrompt = "chill lofi beats";
      const enhanced = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      // Should match pattern: "base prompt, with a seasonal mood"
      expect(enhanced).toMatch(/^.+, with a .+$/);
      // Should not have awkward concatenation
      expect(enhanced).not.toMatch(/cosy winter atmosphere$/); // Old format
      expect(enhanced).toMatch(
        /with a cosy winter atmosphere$|with a warm and comforting$|with a soft ambient textures$|with a muted and reflective$|with a gentle winter ambience$/
      ); // New format with "with a"
    });

    it("should handle prompts with trailing punctuation", () => {
      const date = new Date("2025-01-15");
      const basePrompt = "relaxing ambient music.";
      const enhanced = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      // Should still add the seasonal bias naturally
      expect(enhanced).toContain(basePrompt);
      expect(enhanced).toMatch(/.*,\s+with a .+/);
    });

    it("should handle prompts that already have commas", () => {
      const date = new Date("2025-06-15");
      const basePrompt = "soft, gentle lofi tracks";
      const enhanced = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      // Should add seasonal bias after the entire prompt
      expect(enhanced).toContain(basePrompt);
      expect(enhanced).toMatch(/soft, gentle lofi tracks, with a .+/);
    });

    it("should work with short prompts", () => {
      const date = new Date("2025-03-15");
      const basePrompt = "lofi";
      const enhanced = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      expect(enhanced).toMatch(/^lofi, with a .+$/);
    });

    it("should be consistent across multiple calls with same date", () => {
      const date = new Date("2025-01-15");
      const basePrompt = "ambient study music";

      const enhanced1 = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );
      const enhanced2 = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );
      const enhanced3 = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );

      // All should be identical since mood is deterministic by date
      expect(enhanced1).toBe(enhanced2);
      expect(enhanced2).toBe(enhanced3);
    });

    it("should work with southern hemisphere", () => {
      const date = new Date("2025-01-15"); // Winter in north, summer in south
      const basePrompt = "chill beats";

      const northern = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "northern"
      );
      const southern = applySeasonalBiasToMusicPrompt(
        basePrompt,
        date,
        "southern"
      );

      // Should have different seasonal moods
      expect(northern).not.toBe(southern);
      expect(northern).toContain("chill beats");
      expect(southern).toContain("chill beats");
    });
  });

  describe("getHolidayScriptGuidance", () => {
    it("should return guidance for holidays", () => {
      const date = new Date("2025-12-25");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance).not.toBeNull();
      expect(guidance?.holidayTags).toContain("christmas_day");
      expect(guidance?.guidance).toBeDefined();
      expect(guidance?.exampleLines).toBeDefined();
      expect(guidance?.exampleLines.length).toBeGreaterThan(0);
    });

    it("should return null for non-holiday dates", () => {
      const date = new Date("2025-03-15");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance).toBeNull();
    });

    it("should provide understated example lines for Christmas", () => {
      const date = new Date("2025-12-25");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance?.exampleLines.length).toBeGreaterThan(0);
      // Check for dry, understated tone (should NOT be overly cheerful)
      const hasUnderstatedTone = guidance?.exampleLines.some(
        (line) =>
          line.toLowerCase().includes("still") ||
          line.toLowerCase().includes("same") ||
          line.toLowerCase().includes("some of us")
      );
      expect(hasUnderstatedTone).toBe(true);
    });

    it("should provide guidance for Halloween", () => {
      const date = new Date("2025-10-31");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance).not.toBeNull();
      expect(guidance?.holidayTags).toContain("halloween");
      expect(guidance?.exampleLines.length).toBeGreaterThan(0);
    });

    it("should provide guidance for New Year", () => {
      const date = new Date("2025-01-01");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance).not.toBeNull();
      expect(guidance?.holidayTags).toContain("new_year");
      expect(guidance?.exampleLines.length).toBeGreaterThan(0);
    });

    it("should include restraint and dry wit in guidance", () => {
      const date = new Date("2025-12-25");
      const guidance = getHolidayScriptGuidance(date);

      expect(guidance?.guidance).toContain("restraint");
      expect(guidance?.guidance).toContain("dry");
      expect(guidance?.guidance).toContain("matter-of-factly");
    });
  });
});
