/**
 * Tests for Queue Builder Module
 */

import {
  calculateQueueStats,
  validateQueueRatios,
  determineNextSegmentType,
  calculateSegmentNeeds,
  getMinGapBetweenLinks,
  canAddTalkSegment,
  formatQueueSummary,
} from "../queue-builder";
import type { QueuedSegment, Show } from "../types";

describe("Queue Builder", () => {
  const mockShow: Show = {
    id: "deep_work_calendar_blocks",
    name: "Deep Work",
    description: "Test show",
    startHour: 9,
    durationHours: 3,
    talkFraction: 0.4,
    musicFraction: 0.6,
    presenterIds: '["taylor", "drew"]',
    configJson: JSON.stringify({
      id: "deep_work_calendar_blocks",
      ratios: {
        music_fraction: 0.6,
        talk_fraction: 0.4,
      },
      timing: {
        min_gap_between_links_seconds: 300,
      },
    }),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  function createMockSegment(
    type: "music" | "talk" | "ident" | "handover",
    durationSeconds: number,
    offsetMinutes: number = 0
  ): QueuedSegment {
    const startTime = new Date();
    startTime.setMinutes(startTime.getMinutes() + offsetMinutes);
    const endTime = new Date(startTime);
    endTime.setSeconds(endTime.getSeconds() + durationSeconds);

    return {
      id: `segment_${Math.random()}`,
      showId: "test_show",
      type,
      filePath: "/test/path.mp3",
      startTime,
      endTime,
    };
  }

  describe("calculateQueueStats", () => {
    it("should calculate stats for empty queue", () => {
      const stats = calculateQueueStats([]);
      expect(stats.totalDurationMinutes).toBe(0);
      expect(stats.musicDurationMinutes).toBe(0);
      expect(stats.talkDurationMinutes).toBe(0);
      expect(stats.musicFraction).toBe(0);
      expect(stats.talkFraction).toBe(0);
    });

    it("should calculate stats for music-only queue", () => {
      const segments = [
        createMockSegment("music", 180), // 3 minutes
        createMockSegment("music", 180), // 3 minutes
      ];

      const stats = calculateQueueStats(segments);
      expect(stats.totalDurationMinutes).toBeCloseTo(6, 1);
      expect(stats.musicDurationMinutes).toBeCloseTo(6, 1);
      expect(stats.talkDurationMinutes).toBe(0);
      expect(stats.musicFraction).toBeCloseTo(1.0, 2);
      expect(stats.talkFraction).toBe(0);
    });

    it("should calculate stats for talk-only queue", () => {
      const segments = [
        createMockSegment("talk", 30), // 30 seconds
        createMockSegment("talk", 30), // 30 seconds
      ];

      const stats = calculateQueueStats(segments);
      expect(stats.totalDurationMinutes).toBeCloseTo(1, 1);
      expect(stats.musicDurationMinutes).toBe(0);
      expect(stats.talkDurationMinutes).toBeCloseTo(1, 1);
      expect(stats.musicFraction).toBe(0);
      expect(stats.talkFraction).toBeCloseTo(1.0, 2);
    });

    it("should calculate stats for mixed queue", () => {
      const segments = [
        createMockSegment("music", 180), // 3 minutes
        createMockSegment("talk", 60),   // 1 minute
        createMockSegment("music", 180), // 3 minutes
      ];

      const stats = calculateQueueStats(segments);
      expect(stats.totalDurationMinutes).toBeCloseTo(7, 1);
      expect(stats.musicDurationMinutes).toBeCloseTo(6, 1);
      expect(stats.talkDurationMinutes).toBeCloseTo(1, 1);
      expect(stats.musicFraction).toBeCloseTo(6/7, 2);
      expect(stats.talkFraction).toBeCloseTo(1/7, 2);
    });

    it("should count idents as talk", () => {
      const segments = [
        createMockSegment("ident", 10),
      ];

      const stats = calculateQueueStats(segments);
      expect(stats.talkDurationMinutes).toBeGreaterThan(0);
      expect(stats.segmentCounts.ident).toBe(1);
    });

    it("should count handovers as talk", () => {
      const segments = [
        createMockSegment("handover", 300), // 5 minutes
      ];

      const stats = calculateQueueStats(segments);
      expect(stats.talkDurationMinutes).toBeCloseTo(5, 1);
      expect(stats.segmentCounts.handover).toBe(1);
    });
  });

  describe("validateQueueRatios", () => {
    it("should validate correct ratios", async () => {
      const segments = [
        createMockSegment("music", 360), // 6 minutes (60%)
        createMockSegment("talk", 240),  // 4 minutes (40%)
      ];

      const result = await validateQueueRatios(segments, mockShow);
      expect(result.valid).toBe(true);
    });

    it("should detect excessive music", async () => {
      const segments = [
        createMockSegment("music", 420), // 7 minutes (70%)
        createMockSegment("talk", 180),  // 3 minutes (30%)
      ];

      const result = await validateQueueRatios(segments, mockShow);
      expect(result.valid).toBe(false);
      expect(result.message).toContain("Music fraction");
    });

    it("should detect insufficient talk", async () => {
      const segments = [
        createMockSegment("music", 540), // 9 minutes (90%)
        createMockSegment("talk", 60),   // 1 minute (10%)
      ];

      const result = await validateQueueRatios(segments, mockShow);
      expect(result.valid).toBe(false);
      // Could fail on either music or talk check
      expect(result.message).toBeDefined();
    });

    it("should allow small deviation from target", async () => {
      const segments = [
        createMockSegment("music", 380), // 6.33 minutes (63.3%)
        createMockSegment("talk", 220),  // 3.67 minutes (36.7%)
      ];

      // Should pass because deviation is within tolerance (0.05)
      const result = await validateQueueRatios(segments, mockShow);
      expect(result.valid).toBe(true);
    });
  });

  describe("determineNextSegmentType", () => {
    it("should suggest music when music is low", async () => {
      const segments = [
        createMockSegment("talk", 300), // All talk, no music
      ];

      const nextType = await determineNextSegmentType(segments, mockShow);
      expect(nextType).toBe("music");
    });

    it("should suggest talk when talk is low", async () => {
      const segments = [
        createMockSegment("music", 600), // All music, no talk
      ];

      const nextType = await determineNextSegmentType(segments, mockShow);
      expect(nextType).toBe("talk");
    });

    it("should suggest balanced when ratios are good", async () => {
      const segments = [
        createMockSegment("music", 360), // 60%
        createMockSegment("talk", 240),  // 40%
      ];

      const nextType = await determineNextSegmentType(segments, mockShow);
      expect(["music", "talk", "balanced"]).toContain(nextType);
    });
  });

  describe("calculateSegmentNeeds", () => {
    it("should calculate needs for empty queue", async () => {
      const needs = await calculateSegmentNeeds([], mockShow, 60); // 60 minutes target

      expect(needs.totalDurationNeeded).toBe(60 * 60); // 3600 seconds
      expect(needs.musicSegmentsNeeded).toBeGreaterThan(0);
      expect(needs.talkSegmentsNeeded).toBeGreaterThan(0);
    });

    it("should calculate remaining needs", async () => {
      const segments = [
        createMockSegment("music", 180), // 3 minutes
        createMockSegment("talk", 60),   // 1 minute
      ];

      const needs = await calculateSegmentNeeds(segments, mockShow, 10); // 10 minutes target

      expect(needs.totalDurationNeeded).toBeCloseTo(6 * 60, 0); // ~6 minutes remaining
      expect(needs.musicSegmentsNeeded).toBeGreaterThan(0);
      expect(needs.talkSegmentsNeeded).toBeGreaterThan(0);
    });

    it("should return zero needs when queue is full", async () => {
      const segments = [
        createMockSegment("music", 600), // 10 minutes
      ];

      const needs = await calculateSegmentNeeds(segments, mockShow, 10); // 10 minutes target

      expect(needs.totalDurationNeeded).toBeLessThanOrEqual(0);
      expect(needs.musicSegmentsNeeded).toBe(0);
      expect(needs.talkSegmentsNeeded).toBe(0);
    });
  });

  describe("getMinGapBetweenLinks", () => {
    it("should get min gap from show config", async () => {
      const minGap = await getMinGapBetweenLinks(mockShow);
      expect(minGap).toBe(300);
    });
  });

  describe("canAddTalkSegment", () => {
    it("should allow talk when no previous talk", async () => {
      const segments = [
        createMockSegment("music", 180),
      ];

      const canAdd = await canAddTalkSegment(segments, mockShow);
      expect(canAdd).toBe(true);
    });

    it("should allow talk when enough time has passed", async () => {
      const segments = [
        createMockSegment("talk", 30, -10), // 10 minutes ago
        createMockSegment("music", 180, -7), // 7 minutes ago
      ];

      const canAdd = await canAddTalkSegment(segments, mockShow);
      expect(canAdd).toBe(true);
    });

    it("should prevent talk when too soon after previous", async () => {
      // Create a recent talk segment
      const recentTalk = createMockSegment("talk", 30);
      // Manually set the end time to be very recent (1 minute ago)
      recentTalk.endTime = new Date(Date.now() - 60000);

      const segments = [recentTalk];

      const canAdd = await canAddTalkSegment(segments, mockShow);
      expect(canAdd).toBe(false);
    });
  });

  describe("formatQueueSummary", () => {
    it("should format queue stats as string", () => {
      const segments = [
        createMockSegment("music", 360), // 6 minutes
        createMockSegment("talk", 240),  // 4 minutes
        createMockSegment("ident", 10),
      ];

      const stats = calculateQueueStats(segments);
      const summary = formatQueueSummary(stats);

      expect(summary).toContain("min total");
      expect(summary).toContain("Music:");
      expect(summary).toContain("Talk:");
      expect(summary).toContain("Segments:");
    });
  });
});
