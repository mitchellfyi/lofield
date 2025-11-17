import { classifyRequest } from "../classification";

describe("classifyRequest - Fallback Mode", () => {
  beforeEach(() => {
    // Run all tests in fallback mode (no API key)
    delete process.env.OPENAI_API_KEY;
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
  });

  describe("Music Prompts", () => {
    it("should classify music requests in fallback mode", async () => {
      const result = await classifyRequest(
        "Smooth lofi beats for a rainy morning coding session",
        "music",
      );

      expect(result.type).toBe("music_prompt");
      expect(result.normalized).toBeDefined();
      expect(result.metadata).toHaveProperty("mood");
      expect(result.metadata).toHaveProperty("tempo");
      expect(result.metadata).toHaveProperty("energy");
      expect(result.metadata).toHaveProperty("keywords");
      expect(result.metadata).toHaveProperty("tags");
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });

    it("should extract basic music metadata", async () => {
      const result = await classifyRequest(
        "Jazz music for afternoon work",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tempo).toBeDefined();
      expect(metadata.energy).toBeDefined();
      expect(metadata.mood).toBeInstanceOf(Array);
      expect(metadata.keywords).toBeInstanceOf(Array);
      expect(metadata.tags).toBeInstanceOf(Array);
    });

    it("should handle music keywords", async () => {
      const result = await classifyRequest(
        "Chill beats for coding",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(result.type).toBe("music_prompt");
      expect(metadata.tags.length).toBeGreaterThan(0);
    });
  });

  describe("Talk Topics", () => {
    it("should classify talk topic requests in fallback mode", async () => {
      const result = await classifyRequest(
        "Let's talk about back-to-back video calls",
        "talk",
      );

      expect(result.type).toBe("talk_topic");
      expect(result.metadata).toHaveProperty("topic");
      expect(result.metadata).toHaveProperty("tone");
      expect(result.metadata).toHaveProperty("tags");
      expect(result.metadata).toHaveProperty("suggestedDuration");
    });

    it("should extract basic talk metadata", async () => {
      const result = await classifyRequest(
        "Discuss remote work challenges",
        "talk",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tone).toBeDefined();
      expect(metadata.suggestedDuration).toBeGreaterThan(0);
      expect(metadata.suggestedDuration).toBeLessThanOrEqual(180);
      expect(metadata.tags).toBeInstanceOf(Array);
    });

    it("should handle talk keywords", async () => {
      const result = await classifyRequest(
        "Talk about WiFi problems during meetings",
        "talk",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(result.type).toBe("talk_topic");
      expect(metadata.tags.length).toBeGreaterThan(0);
    });
  });

  describe("Type Detection", () => {
    it("should classify as music when music keywords are present", async () => {
      const result = await classifyRequest(
        "Piano melody for concentration",
        "music",
      );

      expect(result.type).toBe("music_prompt");
    });

    it("should classify as talk when talk keywords are present", async () => {
      const result = await classifyRequest(
        "Discuss remote work challenges",
        "talk",
      );

      expect(result.type).toBe("talk_topic");
    });

    it("should respect user type hint when keywords are ambiguous", async () => {
      const musicResult = await classifyRequest(
        "Something for work",
        "music",
      );
      expect(musicResult.type).toBe("music_prompt");

      const talkResult = await classifyRequest(
        "Something for work",
        "talk",
      );
      expect(talkResult.type).toBe("talk_topic");
    });
  });

  describe("Tag Extraction", () => {
    it("should extract morning tags", async () => {
      const result = await classifyRequest(
        "Morning coffee music",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("morning_routine");
    });

    it("should extract coffee tags", async () => {
      const result = await classifyRequest(
        "Music for my coffee break",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("coffee");
    });

    it("should extract coding tags", async () => {
      const result = await classifyRequest(
        "Music for coding session",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("coding_session");
    });

    it("should extract meeting tags", async () => {
      const result = await classifyRequest(
        "Music for endless meetings",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("meetings");
    });

    it("should extract work tags", async () => {
      const result = await classifyRequest(
        "Music for work from home",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("remote_work");
    });

    it("should extract rain tags", async () => {
      const result = await classifyRequest(
        "Rainy day music",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("rainy_day");
    });

    it("should extract focus tags", async () => {
      const result = await classifyRequest(
        "Music for focus and concentration",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("focus_time");
    });

    it("should provide default tags when no keywords match", async () => {
      const result = await classifyRequest(
        "Some music please",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("lofi_vibes");
    });

    it("should provide default tags for talk when no keywords match", async () => {
      const result = await classifyRequest(
        "Something to discuss",
        "talk",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.tags).toContain("remote_work");
    });
  });

  describe("Metadata Structure", () => {
    it("should return music metadata with correct structure", async () => {
      const result = await classifyRequest(
        "Chill music",
        "music",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(metadata.mood).toBeInstanceOf(Array);
      expect(["slow", "medium", "fast"]).toContain(metadata.tempo);
      expect(["low", "medium", "high"]).toContain(metadata.energy);
      expect(metadata.keywords).toBeInstanceOf(Array);
      expect(metadata.tags).toBeInstanceOf(Array);
    });

    it("should return talk metadata with correct structure", async () => {
      const result = await classifyRequest(
        "Let's talk",
        "talk",
      );

      const metadata = result.metadata as Record<string, unknown>;
      expect(typeof metadata.topic).toBe("string");
      expect(metadata.tone).toBeDefined();
      expect(metadata.tags).toBeInstanceOf(Array);
      expect(typeof metadata.suggestedDuration).toBe("number");
    });
  });

  describe("Edge Cases", () => {
    it("should handle short requests", async () => {
      const result = await classifyRequest(
        "Music please",
        "music",
      );

      expect(result.type).toBe("music_prompt");
      expect(result.normalized).toBeDefined();
    });

    it("should handle long requests", async () => {
      const longRequest = "I would really love some smooth chill lofi beats that I can listen to while I'm working on my coding project in the morning with my coffee after I wake up early and need to focus on deep work without distractions";
      
      const result = await classifyRequest(longRequest, "music");

      expect(result.type).toBe("music_prompt");
      expect(result.normalized).toBeDefined();
    });

    it("should return normalized text", async () => {
      const result = await classifyRequest(
        "Some music",
        "music",
      );

      expect(result.normalized).toBeTruthy();
      expect(result.normalized.length).toBeGreaterThan(0);
    });
  });

  describe("Confidence Scores", () => {
    it("should return confidence score in fallback mode", async () => {
      const result = await classifyRequest(
        "Music for work",
        "music",
      );

      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.confidence).toBeLessThanOrEqual(0.6);
    });
  });
});
