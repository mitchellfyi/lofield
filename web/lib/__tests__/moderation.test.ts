import { moderateRequest } from "../moderation";

describe("moderateRequest - Station Rules (No API)", () => {
  beforeEach(() => {
    // Test without OpenAI API key to focus on station-specific rules
    delete process.env.OPENAI_API_KEY;
    process.env.AUTO_MODERATION_ENABLED = "true";
  });

  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.AUTO_MODERATION_ENABLED;
  });

  describe("Allowed Content", () => {
    it("should allow clean music requests", async () => {
      const result = await moderateRequest(
        "Smooth lofi beats for a rainy afternoon coding session",
      );
      expect(result.verdict).toBe("allowed");
    });

    it("should allow clean talk topic requests", async () => {
      const result = await moderateRequest(
        "Let's talk about the struggle of back-to-back video calls",
      );
      expect(result.verdict).toBe("allowed");
    });

    it("should allow work-related topics", async () => {
      const result = await moderateRequest(
        "Music for getting through endless meetings",
      );
      expect(result.verdict).toBe("allowed");
    });

    it("should allow references to Lofield landmarks", async () => {
      const result = await moderateRequest(
        "Something about the eternal roadworks on the High Street",
      );
      expect(result.verdict).toBe("allowed");
    });
  });

  describe("Rejected Content - Station-Specific Rules", () => {
    it("should reject political content", async () => {
      const result = await moderateRequest(
        "Music to listen to while watching the election results",
      );
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain(
        "Political content is not allowed (see style guide)",
      );
      expect(result.categories).toContain("politics");
    });

    it("should reject medical advice", async () => {
      const result = await moderateRequest(
        "Can you play something to help with my anxiety diagnosis?",
      );
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain(
        "Medical or health advice is not allowed (we're not qualified)",
      );
      expect(result.categories).toContain("health_advice");
    });

    it("should reject financial advice", async () => {
      const result = await moderateRequest(
        "Play some beats while I trade Bitcoin",
      );
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain(
        "Financial or investment advice is not allowed",
      );
      expect(result.categories).toContain("finance_advice");
    });

    it("should reject spam with URLs", async () => {
      const result = await moderateRequest(
        "Check out my beats at http://example.com",
      );
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain(
        "Promotional content, spam, or URLs are not allowed",
      );
      expect(result.categories).toContain("spam");
    });

    it("should reject promotional content", async () => {
      const result = await moderateRequest(
        "Buy now! Limited time offer! Click here!",
      );
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain(
        "Promotional content, spam, or URLs are not allowed",
      );
    });
  });

  describe("Borderline Content - Needs Rewrite", () => {
    it("should flag overly motivational content", async () => {
      const result = await moderateRequest(
        "You can do it! Motivational beats to chase your dreams!",
      );
      expect(result.verdict).toBe("needs_rewrite");
      expect(result.reasons).toContain(
        "Content is too motivational for Lofield FM's dry, understated tone",
      );
      expect(result.categories).toContain("tone_mismatch");
    });

    it("should flag inspirational content", async () => {
      const result = await moderateRequest(
        "Believe in yourself! Never give up on your goals!",
      );
      expect(result.verdict).toBe("needs_rewrite");
      expect(result.reasons).toContain(
        "Content is too motivational for Lofield FM's dry, understated tone",
      );
    });
  });

  describe("Edge Cases", () => {
    it("should reject empty strings", async () => {
      const result = await moderateRequest("");
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain("Empty or whitespace-only text");
    });

    it("should reject whitespace-only strings", async () => {
      const result = await moderateRequest("   \n\t   ");
      expect(result.verdict).toBe("rejected");
      expect(result.reasons).toContain("Empty or whitespace-only text");
    });

    it("should respect AUTO_MODERATION_ENABLED=false", async () => {
      process.env.AUTO_MODERATION_ENABLED = "false";
      const result = await moderateRequest("Any content");
      expect(result.verdict).toBe("allowed");
      expect(result.reasons).toContain("Auto-moderation disabled");
    });
  });

  describe("Pattern Matching", () => {
    it("should detect political keywords", async () => {
      const politicalPhrases = [
        "Let's talk about the election",
        "Music while I vote",
        "Discussion about government policy",
        "Conservative vs Labour debate",
      ];

      for (const phrase of politicalPhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).toBe("rejected");
        expect(result.categories).toContain("politics");
      }
    });

    it("should detect health/medical keywords", async () => {
      const healthPhrases = [
        "Music for my depression treatment",
        "Help with my illness symptoms",
        "I need a diagnosis for this",
      ];

      for (const phrase of healthPhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).toBe("rejected");
        expect(result.categories).toContain("health_advice");
      }
    });

    it("should detect financial keywords", async () => {
      const financePhrases = [
        "Music while I invest in stocks",
        "Crypto trading session",
        "Get rich quick music",
      ];

      for (const phrase of financePhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).toBe("rejected");
        expect(result.categories).toContain("finance_advice");
      }
    });

    it("should detect spam patterns", async () => {
      const spamPhrases = [
        "Visit my website www.example.com",
        "Click here for more info",
        "Subscribe to my channel",
      ];

      for (const phrase of spamPhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).toBe("rejected");
        expect(result.categories).toContain("spam");
      }
    });

    it("should detect motivational tone", async () => {
      const motivationalPhrases = [
        "You can do it team!",
        "Inspire yourself to greatness",
        "Never give up on your dreams!",
      ];

      for (const phrase of motivationalPhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).toBe("needs_rewrite");
        expect(result.categories).toContain("tone_mismatch");
      }
    });
  });

  describe("Case Insensitivity", () => {
    it("should detect patterns regardless of case", async () => {
      const mixedCasePhrases = [
        "ELECTION results music",
        "BitCoin trading beats",
        "WWW.EXAMPLE.COM",
        "MOTIVATE yourself!",
      ];

      for (const phrase of mixedCasePhrases) {
        const result = await moderateRequest(phrase);
        expect(result.verdict).not.toBe("allowed");
      }
    });
  });
});
