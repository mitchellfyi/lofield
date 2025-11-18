/**
 * Tests for Broadcaster Module
 */

import {
  BroadcastEvent,
  formatSegmentForBroadcast,
  createSSEMessage,
  getBroadcastStats,
} from "../broadcaster";
import type { QueuedSegment } from "../types";

describe("Broadcaster", () => {
  describe("formatSegmentForBroadcast", () => {
    it("should format segment with all fields", () => {
      const segment: QueuedSegment = {
        id: "seg123",
        showId: "show456",
        type: "music",
        filePath: "/path/to/music.mp3",
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T10:03:00Z"),
        trackId: "track789",
        requestId: "req101",
        metadata: { artist: "Test Artist" },
      };

      const formatted = formatSegmentForBroadcast(segment);

      expect(formatted).toEqual({
        id: "seg123",
        type: "music",
        startTime: "2024-01-01T10:00:00.000Z",
        endTime: "2024-01-01T10:03:00.000Z",
        showId: "show456",
        trackId: "track789",
        requestId: "req101",
        metadata: { artist: "Test Artist" },
      });
    });

    it("should handle segment without optional fields", () => {
      const segment: QueuedSegment = {
        id: "seg123",
        showId: "show456",
        type: "ident",
        filePath: "/path/to/ident.mp3",
        startTime: new Date("2024-01-01T10:00:00Z"),
        endTime: new Date("2024-01-01T10:00:10Z"),
      };

      const formatted = formatSegmentForBroadcast(segment);

      expect(formatted).toEqual({
        id: "seg123",
        type: "ident",
        startTime: "2024-01-01T10:00:00.000Z",
        endTime: "2024-01-01T10:00:10.000Z",
        showId: "show456",
        trackId: undefined,
        requestId: undefined,
        metadata: undefined,
      });
    });
  });

  describe("createSSEMessage", () => {
    it("should create correctly formatted SSE message", () => {
      const data = { test: "value", number: 123 };
      const message = createSSEMessage(BroadcastEvent.NOW_PLAYING, data);

      expect(message).toBe('event: now_playing\ndata: {"test":"value","number":123}\n\n');
    });

    it("should handle different event types", () => {
      const data = { info: "test" };
      const message = createSSEMessage(BroadcastEvent.QUEUE_UPDATE, data);

      expect(message).toContain("event: queue_update");
      expect(message).toContain('data: {"info":"test"}');
    });
  });

  describe("getBroadcastStats", () => {
    it("should return stats with no active listeners", () => {
      const stats = getBroadcastStats();

      expect(stats.totalListeners).toBe(0);
      expect(stats.activeEvents).toEqual([]);
      expect(Object.keys(stats.listenersByEvent).length).toBe(0);
    });
  });
});
