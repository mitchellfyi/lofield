/**
 * Tests for Script Generator Module
 */

import { generateScript, splitScriptForDuo } from "../ai/script-generator";
import type { ShowConfig, Presenter } from "../types";

// Mock OpenAI client
jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    transcript: "That was Rainfall on a Tuesday, requested by Sarah in Sheffield.",
                    estimatedDuration: 15,
                  }),
                },
              },
            ],
          }),
        },
      },
    })),
  };
});

describe("Script Generator", () => {
  const mockShowConfig: ShowConfig = {
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
      music_fraction: 0.6,
      talk_fraction: 0.4,
    },
    timing: {
      max_link_seconds: 120,
      min_gap_between_links_seconds: 300,
    },
    presenters: {
      primary_duo: ["alex", "sam"],
      duo_probability: 0.7,
      solo_probability: 0.3,
    },
    tone: {
      keywords: ["dry", "matter-of-fact", "understated"],
      energy_level: "calm",
      mood: "contemplative",
    },
    topics: {
      primary_tags: ["remote-work", "focus", "concentration"],
      banned_tags: ["politics", "health-advice"],
    },
    commentary_style: {
      typical_intro_length_seconds: 30,
      longer_segment_frequency: "occasional",
      longer_segment_length_seconds: 120,
      sample_lines: [
        "That was a track.",
        "Hope you're making it through.",
      ],
    },
  };

  const mockPresenters: Presenter[] = [
    {
      id: "alex",
      name: "Alex",
      voice_id: "voice_alex_contemplative",
      role: "anchor",
      persona: "Contemplative, comfortable with silence",
      shows: ["test_show"],
      quirks: ["Often pauses mid-sentence"],
    },
    {
      id: "sam",
      name: "Sam",
      voice_id: "voice_sam_quiet",
      role: "sidekick",
      persona: "Quiet, observant, dry humor",
      shows: ["test_show"],
      quirks: ["Delivers one-liners sparingly"],
    },
  ];

  beforeEach(() => {
    // Set OpenAI API key for tests
    process.env.OPENAI_API_KEY = "test-key";
  });

  describe("generateScript", () => {
    it("should generate a track intro script", async () => {
      const result = await generateScript({
        segmentType: "track_intro",
        showConfig: mockShowConfig,
        presenters: mockPresenters,
        trackTitle: "Rainfall on a Tuesday",
        targetDuration: 30,
      });

      expect(result.script).toBeDefined();
      expect(result.script.length).toBeGreaterThan(0);
      expect(result.estimatedDuration).toBeGreaterThan(0);
    });

    it("should generate a segment script", async () => {
      const result = await generateScript({
        segmentType: "segment",
        showConfig: mockShowConfig,
        presenters: mockPresenters,
        topic: "remote work challenges",
        targetDuration: 60,
      });

      expect(result.script).toBeDefined();
      expect(result.script.length).toBeGreaterThan(0);
    });

    it("should generate an ident script", async () => {
      const result = await generateScript({
        segmentType: "ident",
        showConfig: mockShowConfig,
        presenters: [mockPresenters[0]],
        targetDuration: 10,
      });

      expect(result.script).toBeDefined();
      expect(result.estimatedDuration).toBeLessThanOrEqual(15);
    });

    it("should use cache for identical requests", async () => {
      const params = {
        segmentType: "track_intro" as const,
        showConfig: mockShowConfig,
        presenters: mockPresenters,
        trackTitle: "Test Track",
        targetDuration: 30,
      };

      const result1 = await generateScript(params);
      const result2 = await generateScript(params);

      // Both should return the same script (cached)
      expect(result1.script).toBe(result2.script);
    });
  });

  describe("splitScriptForDuo", () => {
    it("should split unlabeled script between presenters", () => {
      const script = "Hello. How are you? I'm doing fine. Let's continue.";
      const result = splitScriptForDuo(script, mockPresenters);

      expect(result.length).toBe(4); // 4 sentences
      expect(result[0].presenterId).toBe("alex");
      expect(result[1].presenterId).toBe("sam");
      expect(result[2].presenterId).toBe("alex");
      expect(result[3].presenterId).toBe("sam");
    });

    it("should parse labeled script correctly", () => {
      const script = "Alex: Hello there.\nSam: Hi, how are you?\nAlex: Good thanks.";
      const result = splitScriptForDuo(script, mockPresenters);

      expect(result.length).toBe(3);
      expect(result[0].presenterId).toBe("alex");
      expect(result[0].text).toBe("Hello there.");
      expect(result[1].presenterId).toBe("sam");
      expect(result[1].text).toBe("Hi, how are you?");
      expect(result[2].presenterId).toBe("alex");
      expect(result[2].text).toBe("Good thanks.");
    });

    it("should handle single presenter", () => {
      const script = "This is a solo script.";
      const result = splitScriptForDuo(script, [mockPresenters[0]]);

      expect(result.length).toBe(1);
      expect(result[0].presenterId).toBe("alex");
      expect(result[0].text).toBe(script);
    });
  });
});
