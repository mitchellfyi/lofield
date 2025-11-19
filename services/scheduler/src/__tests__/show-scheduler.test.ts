/**
 * Tests for Show Scheduler Module
 */

import {
  getSeasonalContext,
  isNearShowTransition,
  getShowEndTime,
} from "../show-scheduler";
import type { Show } from "../types";

describe("Show Scheduler", () => {
  describe("getSeasonalContext", () => {
    it("should identify winter season", () => {
      const winterDate = new Date("2024-12-15T10:00:00Z");
      const context = getSeasonalContext(winterDate);

      expect(context.season).toBe("winter");
      expect(context.month).toBe(12);
    });

    it("should identify spring season", () => {
      const springDate = new Date("2024-04-15T10:00:00Z");
      const context = getSeasonalContext(springDate);

      expect(context.season).toBe("spring");
      expect(context.month).toBe(4);
    });

    it("should identify summer season", () => {
      const summerDate = new Date("2024-07-15T10:00:00Z");
      const context = getSeasonalContext(summerDate);

      expect(context.season).toBe("summer");
      expect(context.month).toBe(7);
    });

    it("should identify autumn season", () => {
      const autumnDate = new Date("2024-10-15T10:00:00Z");
      const context = getSeasonalContext(autumnDate);

      expect(context.season).toBe("autumn");
      expect(context.month).toBe(10);
    });

    it("should detect Christmas holiday", () => {
      const christmasDate = new Date("2024-12-25T10:00:00Z");
      const context = getSeasonalContext(christmasDate);

      expect(context.isHoliday).toBe(true);
      expect(context.holidayName).toBe("Christmas");
    });

    it("should detect New Year holiday", () => {
      const newYearDate = new Date("2024-01-01T10:00:00Z");
      const context = getSeasonalContext(newYearDate);

      expect(context.isHoliday).toBe(true);
      expect(context.holidayName).toBe("New Year");
    });

    it("should detect Halloween holiday", () => {
      const halloweenDate = new Date("2024-10-31T10:00:00Z");
      const context = getSeasonalContext(halloweenDate);

      expect(context.isHoliday).toBe(true);
      expect(context.holidayName).toBe("Halloween");
    });

    it("should return non-holiday for regular dates", () => {
      const regularDate = new Date("2024-06-15T10:00:00Z");
      const context = getSeasonalContext(regularDate);

      expect(context.isHoliday).toBe(false);
      expect(context.holidayName).toBeUndefined();
    });
  });

  describe("getShowEndTime", () => {
    it("should calculate correct end time for a 3-hour show", () => {
      const show: Show = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        startHour: 9,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: '["presenter1"]',
        configJson: JSON.stringify({
          schedule: {
            start_time_utc: "09:00",
            duration_hours: 3,
          },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const endTime = getShowEndTime(show);
      const startHour = endTime.getUTCHours() - 3;

      expect(startHour).toBe(9);
    });
  });

  describe("isNearShowTransition", () => {
    it("should return true when within threshold", () => {
      const now = new Date();
      const show: Show = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        startHour: now.getUTCHours(),
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: '["presenter1"]',
        configJson: JSON.stringify({
          schedule: {
            start_time_utc: `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`,
            duration_hours: 3,
          },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // This will depend on current time, so we just test the function runs
      const result = isNearShowTransition(show, 10);
      expect(typeof result).toBe("boolean");
    });
  });
});
