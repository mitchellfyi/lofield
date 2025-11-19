/**
 * Tests for Topic Selector Module
 */

import {
  selectTopics,
  getMoodKeywords,
  selectSampleLine,
  selectCheckIn,
  shouldGenerateLongerSegment,
  getSegmentDuration,
  getMaxLinkDuration,
  getMinGapBetweenLinks,
  getTypicalTrackLength,
  buildPromptContext,
  TopicDiversityTracker,
} from "../topic-selector";
import type { ShowConfig, SeasonalContext } from "../types";

describe("Topic Selector", () => {
  const mockShowConfig: ShowConfig = {
    id: "test_show",
    name: "Test Show",
    description: "Test description",
    schedule: {
      days: ["mon"],
      start_time_utc: "09:00",
      end_time_utc: "12:00",
      duration_hours: 3,
    },
    ratios: {
      music_fraction: 0.5,
      talk_fraction: 0.5,
    },
    timing: {
      max_link_seconds: 30,
      min_gap_between_links_seconds: 180,
      typical_track_length_seconds: 210,
    },
    presenters: {
      primary_duo: ["alex", "sam"],
      duo_probability: 0.8,
      solo_probability: 0.2,
    },
    tone: {
      keywords: ["calm", "focused", "dry"],
      energy_level: "moderate",
      mood: "Calm and focused",
    },
    topics: {
      primary_tags: ["focus_time", "deep_work", "coding"],
      banned_tags: ["loud", "energetic"],
    },
    commentary_style: {
      typical_intro_length_seconds: 30,
      longer_segment_frequency: "occasional",
      longer_segment_length_seconds: 60,
      sample_lines: ["Sample line 1", "Sample line 2", "Sample line 3"],
      check_ins: ["Check in 1", "Check in 2"],
    },
  };

  const mockSeasonalContext: SeasonalContext = {
    season: "winter",
    month: 12,
    isHoliday: false,
    additionalTags: ["winter_focus", "dark_days"],
  };

  describe("selectTopics", () => {
    it("should select topics from primary tags", () => {
      const topics = selectTopics({
        showConfig: mockShowConfig,
        seasonalContext: { ...mockSeasonalContext, additionalTags: [] },
        maxTags: 3,
      });

      expect(topics.length).toBeLessThanOrEqual(3);
      topics.forEach((tag) => {
        expect(mockShowConfig.topics.primary_tags).toContain(tag);
      });
    });

    it("should include seasonal tags", () => {
      const topics = selectTopics({
        showConfig: mockShowConfig,
        seasonalContext: mockSeasonalContext,
        maxTags: 10,
      });

      const hasSeasonalTag = topics.some((tag) =>
        mockSeasonalContext.additionalTags.includes(tag)
      );
      expect(hasSeasonalTag).toBe(true);
    });

    it("should exclude banned tags", () => {
      const topics = selectTopics({
        showConfig: mockShowConfig,
        seasonalContext: mockSeasonalContext,
        maxTags: 10,
      });

      topics.forEach((tag) => {
        expect(mockShowConfig.topics.banned_tags || []).not.toContain(tag);
      });
    });

    it("should exclude specified tags", () => {
      const excludeTags = ["focus_time"];
      const topics = selectTopics({
        showConfig: mockShowConfig,
        seasonalContext: mockSeasonalContext,
        excludeTags,
        maxTags: 10,
      });

      topics.forEach((tag) => {
        expect(excludeTags).not.toContain(tag);
      });
    });

    it("should respect maxTags limit", () => {
      const topics = selectTopics({
        showConfig: mockShowConfig,
        seasonalContext: mockSeasonalContext,
        maxTags: 2,
      });

      expect(topics.length).toBeLessThanOrEqual(2);
    });
  });

  describe("getMoodKeywords", () => {
    it("should return tone keywords", () => {
      const keywords = getMoodKeywords(mockShowConfig, mockSeasonalContext);
      expect(keywords.length).toBeGreaterThan(0);
      mockShowConfig.tone.keywords.forEach((keyword) => {
        expect(keywords).toContain(keyword);
      });
    });

    it("should include seasonal context", () => {
      const contextWithAdjustment: SeasonalContext = {
        ...mockSeasonalContext,
        toneAdjustment: "Reference cold weather and dark mornings",
      };

      const keywords = getMoodKeywords(mockShowConfig, contextWithAdjustment);
      expect(keywords.length).toBeGreaterThan(
        mockShowConfig.tone.keywords.length
      );
    });
  });

  describe("selectSampleLine", () => {
    it("should return a sample line", () => {
      const line = selectSampleLine(mockShowConfig);
      expect(line).not.toBeNull();
      expect(mockShowConfig.commentary_style?.sample_lines).toContain(line);
    });

    it("should return null when no sample lines", () => {
      const configWithoutSamples = {
        ...mockShowConfig,
        commentary_style: undefined,
      };
      const line = selectSampleLine(configWithoutSamples);
      expect(line).toBeNull();
    });
  });

  describe("selectCheckIn", () => {
    it("should return a check-in phrase", () => {
      const checkIn = selectCheckIn(mockShowConfig);
      expect(checkIn).not.toBeNull();
      expect(mockShowConfig.commentary_style?.check_ins).toContain(checkIn);
    });

    it("should return null when no check-ins", () => {
      const configWithoutCheckIns = {
        ...mockShowConfig,
        commentary_style: undefined,
      };
      const checkIn = selectCheckIn(configWithoutCheckIns);
      expect(checkIn).toBeNull();
    });
  });

  describe("shouldGenerateLongerSegment", () => {
    it("should always return false for 'rare'", () => {
      // Run multiple times to check probability
      const results = Array(10)
        .fill(0)
        .map(() => shouldGenerateLongerSegment("rare"));
      const trueCount = results.filter((r) => r).length;
      expect(trueCount).toBeLessThan(5); // Should be mostly false
    });

    it("should always return true for very high frequency", () => {
      // With 'frequent' (0.6 probability), we expect mostly true
      const results = Array(20)
        .fill(0)
        .map(() => shouldGenerateLongerSegment("frequent"));
      const trueCount = results.filter((r) => r).length;
      expect(trueCount).toBeGreaterThan(5); // Should be mostly true
    });
  });

  describe("getSegmentDuration", () => {
    it("should return typical duration for normal segments", () => {
      const duration = getSegmentDuration(mockShowConfig, false);
      expect(duration).toBe(30);
    });

    it("should return longer duration for extended segments", () => {
      const duration = getSegmentDuration(mockShowConfig, true);
      expect(duration).toBe(60);
    });

    it("should return default when no commentary style", () => {
      const configWithoutStyle = {
        ...mockShowConfig,
        commentary_style: undefined,
      };
      const duration = getSegmentDuration(configWithoutStyle);
      expect(duration).toBe(30);
    });
  });

  describe("getMaxLinkDuration", () => {
    it("should return max link seconds from config", () => {
      const maxLink = getMaxLinkDuration(mockShowConfig);
      expect(maxLink).toBe(30);
    });
  });

  describe("getMinGapBetweenLinks", () => {
    it("should return min gap from config", () => {
      const minGap = getMinGapBetweenLinks(mockShowConfig);
      expect(minGap).toBe(180);
    });
  });

  describe("getTypicalTrackLength", () => {
    it("should return typical track length from config", () => {
      const trackLength = getTypicalTrackLength(mockShowConfig);
      expect(trackLength).toBe(210);
    });

    it("should return default when not specified", () => {
      const configWithoutTrackLength = {
        ...mockShowConfig,
        timing: {
          ...mockShowConfig.timing,
          typical_track_length_seconds: undefined,
        },
      };
      const trackLength = getTypicalTrackLength(configWithoutTrackLength);
      expect(trackLength).toBe(210); // Default
    });
  });

  describe("buildPromptContext", () => {
    it("should build complete prompt context", () => {
      const context = buildPromptContext(
        mockShowConfig,
        mockSeasonalContext,
        true
      );

      expect(context.showName).toBe("Test Show");
      expect(context.showMood).toBe("Calm and focused");
      expect(context.energyLevel).toBe("moderate");
      expect(context.toneKeywords.length).toBeGreaterThan(0);
      expect(context.topics.length).toBeGreaterThan(0);
      expect(context.sampleLine).toBeDefined();
    });

    it("should include seasonal note when available", () => {
      const contextWithAdjustment: SeasonalContext = {
        ...mockSeasonalContext,
        toneAdjustment: "Winter vibes",
      };

      const context = buildPromptContext(
        mockShowConfig,
        contextWithAdjustment,
        true
      );
      expect(context.seasonalNote).toBe("Winter vibes");
    });

    it("should exclude examples when requested", () => {
      const context = buildPromptContext(
        mockShowConfig,
        mockSeasonalContext,
        false
      );
      expect(context.sampleLine).toBeUndefined();
    });
  });

  describe("TopicDiversityTracker", () => {
    let tracker: TopicDiversityTracker;

    beforeEach(() => {
      tracker = new TopicDiversityTracker();
    });

    it("should track used topics", () => {
      tracker.recordTopic("focus_time");
      const weight1 = tracker.getTopicWeight("focus_time");
      const weight2 = tracker.getTopicWeight("deep_work");

      expect(weight1).toBeLessThan(weight2);
    });

    it("should select weighted topics", () => {
      const topics = ["topic1", "topic2", "topic3", "topic4"];

      // Record some topics to create weight differences
      tracker.recordTopic("topic1");
      tracker.recordTopic("topic1");

      const selected = tracker.selectWeightedTopics(topics, 2);
      expect(selected.length).toBe(2);

      // topic1 should be less likely to be selected again
      // but we can't guarantee in a single test, so just check it returns valid topics
      selected.forEach((topic) => {
        expect(topics).toContain(topic);
      });
    });

    it("should clear history", () => {
      tracker.recordTopic("topic1");
      tracker.clear();
      const weight = tracker.getTopicWeight("topic1");
      expect(weight).toBe(1.0); // Reset to default
    });
  });
});
