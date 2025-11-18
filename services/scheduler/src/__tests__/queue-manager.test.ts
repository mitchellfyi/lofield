/**
 * Tests for Queue Manager Module
 */

import { calculateQueuedMinutes } from "../queue-manager";
import type { QueuedSegment } from "../types";

describe("Queue Manager", () => {
  describe("calculateQueuedMinutes", () => {
    it("should calculate total minutes from segments", () => {
      const now = new Date();
      const segments: QueuedSegment[] = [
        {
          id: "seg1",
          showId: "show1",
          type: "music",
          filePath: "/path/to/music.mp3",
          startTime: now,
          endTime: new Date(now.getTime() + 3 * 60 * 1000), // 3 minutes
        },
        {
          id: "seg2",
          showId: "show1",
          type: "talk",
          filePath: "/path/to/talk.mp3",
          startTime: new Date(now.getTime() + 3 * 60 * 1000),
          endTime: new Date(now.getTime() + 5 * 60 * 1000), // 2 minutes
        },
      ];

      const totalMinutes = calculateQueuedMinutes(segments);
      expect(totalMinutes).toBeCloseTo(5, 1); // 3 + 2 = 5 minutes
    });

    it("should return 0 for empty segments array", () => {
      const totalMinutes = calculateQueuedMinutes([]);
      expect(totalMinutes).toBe(0);
    });

    it("should handle segments with different durations", () => {
      const now = new Date();
      const segments: QueuedSegment[] = [
        {
          id: "seg1",
          showId: "show1",
          type: "music",
          filePath: "/path/to/music.mp3",
          startTime: now,
          endTime: new Date(now.getTime() + 180 * 1000), // 3 minutes
        },
        {
          id: "seg2",
          showId: "show1",
          type: "ident",
          filePath: "/path/to/ident.mp3",
          startTime: new Date(now.getTime() + 180 * 1000),
          endTime: new Date(now.getTime() + 190 * 1000), // 10 seconds
        },
      ];

      const totalMinutes = calculateQueuedMinutes(segments);
      expect(totalMinutes).toBeCloseTo(3.167, 2); // 3 + 0.167 minutes
    });
  });
});
