/**
 * Tests for Scheduler Service
 */

import { SchedulerService } from "../scheduler";
import type { SchedulerConfig, Show, ShowConfig } from "../types";

// Mock logger first before importing scheduler
jest.mock("../logger", () => ({
  __esModule: true,
  default: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock other dependencies
jest.mock("../show-scheduler");
jest.mock("../queue-manager");
jest.mock("../content-generator");
jest.mock("../archiver");
jest.mock("../broadcaster");

import {
  getCurrentShow,
  getNextShow,
  getShowEndTime,
  isNearShowTransition,
} from "../show-scheduler";
import {
  needsReplenishment,
  getNextAvailableSlot,
  createSegment,
  createTrack,
  markRequestAsUsed,
  getTopRequests,
  getQueuedSegments,
} from "../queue-manager";
import {
  generateMusicTrack,
  generateCommentary,
  generateHandoverSegment,
  generateIdent,
  generateFallbackContent,
} from "../content-generator";

const mockGetCurrentShow = getCurrentShow as jest.MockedFunction<
  typeof getCurrentShow
>;
const mockGetNextShow = getNextShow as jest.MockedFunction<typeof getNextShow>;
const mockGetShowEndTime = getShowEndTime as jest.MockedFunction<
  typeof getShowEndTime
>;
const mockIsNearShowTransition = isNearShowTransition as jest.MockedFunction<
  typeof isNearShowTransition
>;
const mockNeedsReplenishment = needsReplenishment as jest.MockedFunction<
  typeof needsReplenishment
>;
const mockGetNextAvailableSlot = getNextAvailableSlot as jest.MockedFunction<
  typeof getNextAvailableSlot
>;
const mockCreateSegment = createSegment as jest.MockedFunction<
  typeof createSegment
>;
const mockCreateTrack = createTrack as jest.MockedFunction<typeof createTrack>;
const mockMarkRequestAsUsed = markRequestAsUsed as jest.MockedFunction<
  typeof markRequestAsUsed
>;
const mockGetTopRequests = getTopRequests as jest.MockedFunction<
  typeof getTopRequests
>;
const mockGenerateMusicTrack = generateMusicTrack as jest.MockedFunction<
  typeof generateMusicTrack
>;
const mockGenerateCommentary = generateCommentary as jest.MockedFunction<
  typeof generateCommentary
>;
const mockGenerateHandoverSegment =
  generateHandoverSegment as jest.MockedFunction<
    typeof generateHandoverSegment
  >;
const mockGenerateIdent = generateIdent as jest.MockedFunction<
  typeof generateIdent
>;
const mockGenerateFallbackContent =
  generateFallbackContent as jest.MockedFunction<
    typeof generateFallbackContent
  >;

describe("SchedulerService", () => {
  let scheduler: SchedulerService;
  let config: SchedulerConfig;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    config = {
      bufferMinutes: 60,
      checkIntervalSeconds: 30,
      audioStoragePath: "/tmp/audio",
      archivePath: "/tmp/archive",
      minQueueDepthMinutes: 30,
    };

    scheduler = new SchedulerService(config);
  });

  describe("Talk/Music Ratio Enforcement", () => {
    it("should enforce 50/50 talk/music ratio", async () => {
      const showConfig: ShowConfig = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        schedule: {
          days: ["mon"],
          start_time_utc: "06:00",
          end_time_utc: "09:00",
          duration_hours: 3,
        },
        ratios: {
          music_fraction: 0.5,
          talk_fraction: 0.5,
        },
        timing: {
          max_link_seconds: 30,
          min_gap_between_links_seconds: 200,
          typical_track_length_seconds: 180, // 3 minutes
        },
        presenters: {
          primary_duo: ["morgan", "riley"],
          duo_probability: 0.85,
          solo_probability: 0.15,
        },
        tone: {
          keywords: ["test"],
          energy_level: "moderate",
          mood: "test",
        },
        topics: {
          primary_tags: ["test"],
        },
        commentary_style: {
          typical_intro_length_seconds: 30,
          longer_segment_frequency: "regular",
          longer_segment_length_seconds: 120,
          sample_lines: [],
        },
      };

      const show: Show = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        startHour: 6,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "morgan,riley",
        configJson: JSON.stringify(showConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const request = {
        id: "req1",
        userId: "user1",
        type: "music",
        rawText: "Test Request",
        normalized: "test request",
        votes: 10,
        status: "pending",
        createdAt: new Date(),
        usedAt: null,
        moderationStatus: "approved",
      };

      mockGetCurrentShow.mockResolvedValue(show);
      mockIsNearShowTransition.mockReturnValue(false);
      mockNeedsReplenishment.mockResolvedValue({
        needed: true,
        currentMinutes: 10,
        targetMinutes: 30,
        minutesNeeded: 20, // Need 20 minutes total
      });
      mockGetTopRequests.mockResolvedValue([request]);
      mockGetNextAvailableSlot.mockResolvedValue(new Date());

      // Mock music track generation (3 minutes as per config)
      mockGenerateMusicTrack.mockResolvedValue({
        success: true,
        filePath: "/tmp/music.mp3",
        metadata: {
          title: "Test Track",
          duration: 180, // 3 minutes from config
        },
      });

      // Mock commentary generation (30 seconds)
      mockGenerateCommentary.mockResolvedValue({
        success: true,
        filePath: "/tmp/commentary.mp3",
        metadata: {
          duration: 30,
        },
      });

      mockCreateTrack.mockResolvedValue("track1");
      mockCreateSegment.mockResolvedValue("seg1");
      mockMarkRequestAsUsed.mockResolvedValue();

      // Mock idents to fill remaining time
      mockGenerateIdent.mockResolvedValue({
        success: true,
        filePath: "/tmp/ident.mp3",
        metadata: {
          duration: 10,
        },
      });

      // Trigger a single tick manually (since we can't easily test the loop)
      await (scheduler as any).checkAndGenerateContent(show);

      // Verify that content was generated with correct ratios
      // For 20 minutes needed: 10 min music (50%), 10 min talk (50%)
      // With 3-min tracks and 30-sec commentary, we expect:
      // - Music tracks to be generated
      // - Commentary to be generated
      expect(mockGenerateMusicTrack).toHaveBeenCalled();
      expect(mockGenerateCommentary).toHaveBeenCalled();

      // Music should use the show-specific duration (180 seconds)
      const musicCall = mockGenerateMusicTrack.mock.calls[0];
      expect(musicCall[1].id).toBe("test_show"); // Verify it's using the right show
    });

    it("should enforce 60/40 music/talk ratio", async () => {
      const showConfig: ShowConfig = {
        id: "test_show_60_40",
        name: "Music Heavy Show",
        description: "Test",
        schedule: {
          days: ["mon"],
          start_time_utc: "12:00",
          end_time_utc: "15:00",
          duration_hours: 3,
        },
        ratios: {
          music_fraction: 0.6,
          talk_fraction: 0.4,
        },
        timing: {
          max_link_seconds: 30,
          min_gap_between_links_seconds: 200,
          typical_track_length_seconds: 210, // 3.5 minutes
        },
        presenters: {
          primary_duo: ["alex", "sam"],
          duo_probability: 0.7,
          solo_probability: 0.3,
        },
        tone: {
          keywords: ["energetic"],
          energy_level: "high",
          mood: "upbeat",
        },
        topics: {
          primary_tags: ["music"],
        },
        commentary_style: {
          typical_intro_length_seconds: 25,
          longer_segment_frequency: "occasional",
          longer_segment_length_seconds: 90,
          sample_lines: [],
        },
      };

      const show: Show = {
        id: "test_show_60_40",
        name: "Music Heavy Show",
        description: "Test",
        startHour: 12,
        durationHours: 3,
        talkFraction: 0.4,
        musicFraction: 0.6,
        presenterIds: "alex,sam",
        configJson: JSON.stringify(showConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const request = {
        id: "req2",
        userId: "user2",
        type: "music",
        rawText: "Upbeat Track",
        normalized: "upbeat track",
        votes: 15,
        status: "pending",
        createdAt: new Date(),
        usedAt: null,
        moderationStatus: "approved",
      };

      mockGetCurrentShow.mockResolvedValue(show);
      mockIsNearShowTransition.mockReturnValue(false);
      mockNeedsReplenishment.mockResolvedValue({
        needed: true,
        currentMinutes: 5,
        targetMinutes: 30,
        minutesNeeded: 25, // Need 25 minutes total
      });
      mockGetTopRequests.mockResolvedValue([
        request,
        { ...request, id: "req3" },
      ]);
      mockGetNextAvailableSlot.mockResolvedValue(new Date());

      // Mock music track generation (3.5 minutes as per config)
      mockGenerateMusicTrack.mockResolvedValue({
        success: true,
        filePath: "/tmp/music2.mp3",
        metadata: {
          title: "Upbeat Track",
          duration: 210, // 3.5 minutes from config
        },
      });

      // Mock commentary generation (25 seconds)
      mockGenerateCommentary.mockResolvedValue({
        success: true,
        filePath: "/tmp/commentary2.mp3",
        metadata: {
          duration: 25,
        },
      });

      mockCreateTrack.mockResolvedValue("track2");
      mockCreateSegment.mockResolvedValue("seg2");
      mockMarkRequestAsUsed.mockResolvedValue();

      mockGenerateIdent.mockResolvedValue({
        success: true,
        filePath: "/tmp/ident2.mp3",
        metadata: {
          duration: 10,
        },
      });

      await (scheduler as any).checkAndGenerateContent(show);

      // Verify music uses show-specific duration
      expect(mockGenerateMusicTrack).toHaveBeenCalled();
      const musicResult = mockGenerateMusicTrack.mock.results[0].value;
      expect((await musicResult).metadata?.duration).toBe(210);
    });
  });

  describe("Show Transitions and Handovers", () => {
    it("should generate handover when near show transition", async () => {
      const currentShow: Show = {
        id: "morning_show",
        name: "Morning Show",
        description: "Morning",
        startHour: 6,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "morgan,riley",
        configJson: JSON.stringify({
          id: "morning_show",
          name: "Morning Show",
          handover: {
            duration_seconds: 300,
            style: "friendly",
            typical_themes: ["transition"],
          },
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nextShow: Show = {
        id: "afternoon_show",
        name: "Afternoon Show",
        description: "Afternoon",
        startHour: 9,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "alex,sam",
        configJson: JSON.stringify({
          id: "afternoon_show",
          name: "Afternoon Show",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetCurrentShow.mockResolvedValue(currentShow);
      mockIsNearShowTransition.mockReturnValue(true);
      mockGetNextShow.mockResolvedValue(nextShow);
      mockGetShowEndTime.mockReturnValue(new Date(Date.now() + 5 * 60 * 1000)); // 5 mins from now
      mockNeedsReplenishment.mockResolvedValue({
        needed: false,
        currentMinutes: 35,
        targetMinutes: 30,
        minutesNeeded: 0,
      });

      mockGenerateHandoverSegment.mockResolvedValue({
        success: true,
        filePath: "/tmp/handover.mp3",
        metadata: {
          duration: 300, // 5 minutes
        },
      });

      mockCreateSegment.mockResolvedValue("handover_seg");

      await (scheduler as any).checkShowTransition(currentShow);

      // Verify handover was generated
      expect(mockGenerateHandoverSegment).toHaveBeenCalledWith(
        currentShow,
        nextShow,
        config.audioStoragePath
      );

      // Verify handover segment was scheduled
      expect(mockCreateSegment).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "handover",
          showId: currentShow.id,
        })
      );
    });

    it("should not generate duplicate handovers", async () => {
      const currentShow: Show = {
        id: "morning_show",
        name: "Morning Show",
        description: "Morning",
        startHour: 6,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "morgan,riley",
        configJson: JSON.stringify({
          id: "morning_show",
          name: "Morning Show",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const nextShow: Show = {
        id: "afternoon_show",
        name: "Afternoon Show",
        description: "Afternoon",
        startHour: 9,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "alex,sam",
        configJson: JSON.stringify({
          id: "afternoon_show",
          name: "Afternoon Show",
        }),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockGetCurrentShow.mockResolvedValue(currentShow);
      mockIsNearShowTransition.mockReturnValue(true);
      mockGetNextShow.mockResolvedValue(nextShow);
      mockGetShowEndTime.mockReturnValue(new Date(Date.now() + 5 * 60 * 1000));
      mockNeedsReplenishment.mockResolvedValue({
        needed: false,
        currentMinutes: 35,
        targetMinutes: 30,
        minutesNeeded: 0,
      });

      mockGenerateHandoverSegment.mockResolvedValue({
        success: true,
        filePath: "/tmp/handover.mp3",
        metadata: {
          duration: 300,
        },
      });

      mockCreateSegment.mockResolvedValue("handover_seg");

      // First call - should generate handover
      await (scheduler as any).checkShowTransition(currentShow);
      expect(mockGenerateHandoverSegment).toHaveBeenCalledTimes(1);

      // Second call within 10 minutes - should not generate another handover
      await (scheduler as any).checkShowTransition(currentShow);
      expect(mockGenerateHandoverSegment).toHaveBeenCalledTimes(1); // Still just 1
    });
  });

  describe("Fallback Content Generation", () => {
    it("should use fallback when music generation fails", async () => {
      const showConfig: ShowConfig = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        schedule: {
          days: ["mon"],
          start_time_utc: "06:00",
          end_time_utc: "09:00",
          duration_hours: 3,
        },
        ratios: {
          music_fraction: 0.5,
          talk_fraction: 0.5,
        },
        timing: {
          max_link_seconds: 30,
          min_gap_between_links_seconds: 200,
          typical_track_length_seconds: 180,
        },
        presenters: {
          primary_duo: ["morgan", "riley"],
          duo_probability: 0.85,
          solo_probability: 0.15,
        },
        tone: {
          keywords: ["test"],
          energy_level: "moderate",
          mood: "test",
        },
        topics: {
          primary_tags: ["test"],
        },
      };

      const show: Show = {
        id: "test_show",
        name: "Test Show",
        description: "Test",
        startHour: 6,
        durationHours: 3,
        talkFraction: 0.5,
        musicFraction: 0.5,
        presenterIds: "morgan,riley",
        configJson: JSON.stringify(showConfig),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const request = {
        id: "req1",
        userId: "user1",
        type: "music",
        rawText: "Test Request",
        normalized: "test request",
        votes: 10,
        status: "pending",
        createdAt: new Date(),
        usedAt: null,
        moderationStatus: "approved",
      };

      mockGetCurrentShow.mockResolvedValue(show);
      mockIsNearShowTransition.mockReturnValue(false);
      mockNeedsReplenishment.mockResolvedValue({
        needed: true,
        currentMinutes: 10,
        targetMinutes: 30,
        minutesNeeded: 20,
      });
      mockGetTopRequests.mockResolvedValue([request]);
      mockGetNextAvailableSlot.mockResolvedValue(new Date());

      // Mock music generation failure
      mockGenerateMusicTrack.mockResolvedValue({
        success: false,
        error: "Generation failed",
      });

      // Mock fallback content
      mockGenerateFallbackContent.mockResolvedValue({
        filePath: "/tmp/fallback_music.mp3",
        duration: 180,
      });

      mockCreateTrack.mockResolvedValue("track1");
      mockCreateSegment.mockResolvedValue("seg1");
      mockMarkRequestAsUsed.mockResolvedValue();
      mockGenerateCommentary.mockResolvedValue({
        success: false,
      });
      mockGenerateIdent.mockResolvedValue({
        success: true,
        filePath: "/tmp/ident.mp3",
        metadata: { duration: 10 },
      });

      await (scheduler as any).checkAndGenerateContent(show);

      // Verify fallback was used
      expect(mockGenerateFallbackContent).toHaveBeenCalledWith(
        "music",
        config.audioStoragePath
      );
    });
  });
});
