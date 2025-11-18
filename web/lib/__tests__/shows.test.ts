import {
  loadShows,
  getShowById,
  getPresentersForShow,
  generateWeeklySchedule,
  getCurrentShow,
  clearShowsCache,
} from "../shows";
import * as fs from "fs";

// Mock fs module
jest.mock("fs", () => ({
  readFileSync: jest.fn(),
  readdirSync: jest.fn(),
}));

describe("shows utility", () => {
  const mockShowData = {
    id: "test_show",
    name: "Test Show",
    description: "A test show",
    schedule: {
      days: ["mon", "tue", "wed", "thu", "fri"],
      start_time_utc: "09:00",
      end_time_utc: "12:00",
      duration_hours: 3,
    },
    ratios: {
      music_fraction: 0.5,
      talk_fraction: 0.5,
    },
    presenters: {
      primary_duo: ["presenter1", "presenter2"],
      duo_probability: 0.85,
      solo_probability: 0.15,
    },
    tone: {
      keywords: ["relaxed", "friendly"],
      energy_level: "moderate",
      mood: "comfortable",
    },
    topics: {
      primary_tags: ["work", "focus"],
      allow_listener_requests: true,
    },
  };

  const mockPresentersData = {
    presenters: [
      {
        id: "presenter1",
        name: "Presenter One",
        voice_id: "voice1",
        role: "anchor",
        persona: "Friendly and welcoming",
        shows: ["test_show"],
        quirks: ["Always upbeat"],
      },
      {
        id: "presenter2",
        name: "Presenter Two",
        voice_id: "voice2",
        role: "sidekick",
        persona: "Supportive and calm",
        shows: ["test_show"],
        quirks: ["Good listener"],
      },
    ],
  };

  beforeEach(() => {
    clearShowsCache();
    jest.clearAllMocks();

    // Mock file system operations
    (fs.readdirSync as jest.Mock).mockReturnValue(["test_show.json"]);
    (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
      if (path.includes("test_show.json")) {
        return JSON.stringify(mockShowData);
      }
      if (path.includes("presenters.json")) {
        return JSON.stringify(mockPresentersData);
      }
      throw new Error("File not found");
    });
  });

  describe("loadShows", () => {
    it("should load shows from JSON files", () => {
      const shows = loadShows();
      expect(shows).toHaveLength(1);
      expect(shows[0].id).toBe("test_show");
      expect(shows[0].name).toBe("Test Show");
    });

    it("should cache loaded shows", () => {
      const firstCall = loadShows();
      const secondCall = loadShows();
      // Shows should be the same reference due to caching
      expect(firstCall).toBe(secondCall);
      expect(firstCall).toHaveLength(1);
    });

    it("should sort shows by start time", () => {
      (fs.readdirSync as jest.Mock).mockReturnValue([
        "show1.json",
        "show2.json",
      ]);
      (fs.readFileSync as jest.Mock).mockImplementation((path: string) => {
        if (path.includes("show1.json")) {
          return JSON.stringify({
            ...mockShowData,
            id: "show1",
            schedule: { ...mockShowData.schedule, start_time_utc: "15:00" },
          });
        }
        if (path.includes("show2.json")) {
          return JSON.stringify({
            ...mockShowData,
            id: "show2",
            schedule: { ...mockShowData.schedule, start_time_utc: "09:00" },
          });
        }
        return JSON.stringify(mockPresentersData);
      });

      clearShowsCache();
      const shows = loadShows();
      expect(shows[0].id).toBe("show2"); // Earlier show first
      expect(shows[1].id).toBe("show1");
    });
  });

  describe("getShowById", () => {
    it("should return a show by its ID", () => {
      const show = getShowById("test_show");
      expect(show).not.toBeNull();
      expect(show?.name).toBe("Test Show");
    });

    it("should return null for non-existent show", () => {
      const show = getShowById("nonexistent");
      expect(show).toBeNull();
    });
  });

  describe("getPresentersForShow", () => {
    it("should return presenters for a show", () => {
      const show = getShowById("test_show")!;
      const presenters = getPresentersForShow(show);
      expect(presenters).toHaveLength(2);
      expect(presenters[0].id).toBe("presenter1");
      expect(presenters[1].id).toBe("presenter2");
    });
  });

  describe("generateWeeklySchedule", () => {
    it("should generate a weekly schedule", () => {
      const schedule = generateWeeklySchedule();
      expect(schedule).toHaveLength(7); // 7 days
      expect(schedule[0]).toHaveLength(1); // Monday has 1 show
      expect(schedule[0][0].show.id).toBe("test_show");
    });

    it("should handle shows on multiple days", () => {
      const schedule = generateWeeklySchedule();
      // Show runs Mon-Fri
      expect(schedule[0]).toHaveLength(1); // Monday
      expect(schedule[1]).toHaveLength(1); // Tuesday
      expect(schedule[2]).toHaveLength(1); // Wednesday
      expect(schedule[3]).toHaveLength(1); // Thursday
      expect(schedule[4]).toHaveLength(1); // Friday
      expect(schedule[5]).toHaveLength(0); // Saturday
      expect(schedule[6]).toHaveLength(0); // Sunday
    });
  });

  describe("getCurrentShow", () => {
    it("should return the currently playing show", () => {
      // Mock a time during the show (10:00 UTC on Monday)
      const mockDate = new Date("2025-01-06T10:00:00Z"); // Monday
      const show = getCurrentShow(mockDate);
      expect(show).not.toBeNull();
      expect(show?.id).toBe("test_show");
    });

    it("should return null when no show is playing", () => {
      // Mock a time outside the show (14:00 UTC on Monday)
      const mockDate = new Date("2025-01-06T14:00:00Z"); // Monday
      const show = getCurrentShow(mockDate);
      expect(show).toBeNull();
    });

    it("should return null on days when show doesn't air", () => {
      // Mock Saturday when show doesn't run
      const mockDate = new Date("2025-01-04T10:00:00Z"); // Saturday
      const show = getCurrentShow(mockDate);
      expect(show).toBeNull();
    });
  });
});
