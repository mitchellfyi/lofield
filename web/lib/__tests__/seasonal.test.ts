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
    });

    it("should return a mood descriptor for summer", () => {
      const date = new Date("2025-07-15");
      const mood = getSeasonalMusicMood(date, "northern");

      expect(typeof mood).toBe("string");
      expect(mood.length).toBeGreaterThan(0);
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
      expect(enhanced).toMatch(/.*,\s+.+/); // Should have comma and additional text
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
  });
});
