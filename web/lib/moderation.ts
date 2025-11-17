import OpenAI from "openai";

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI | null {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }
  return openaiClient;
}

export type ModerationVerdict = "allowed" | "rejected" | "needs_rewrite";

export interface ModerationResult {
  verdict: ModerationVerdict;
  reasons: string[];
  categories?: string[];
}

// Banned topics are loaded from config/tags.json
// The actual moderation checks are implemented using pattern matching below
// to detect variations and avoid false negatives

/**
 * Moderates user-submitted request text for safety and compliance with station guidelines.
 *
 * Uses OpenAI Moderation API to detect:
 * - Hate speech
 * - Harassment
 * - Self-harm
 * - Sexual content
 * - Violence
 *
 * Also checks against station-specific banned topics (politics, medical advice, etc.)
 *
 * @param text - The user-submitted request text
 * @returns ModerationResult with verdict and reasons
 */
export async function moderateRequest(text: string): Promise<ModerationResult> {
  if (!text || text.trim().length === 0) {
    return {
      verdict: "rejected",
      reasons: ["Empty or whitespace-only text"],
    };
  }

  const reasons: string[] = [];
  const categories: string[] = [];

  try {
    // Check if moderation is enabled
    const moderationEnabled = process.env.AUTO_MODERATION_ENABLED !== "false";

    if (!moderationEnabled) {
      return {
        verdict: "allowed",
        reasons: ["Auto-moderation disabled"],
      };
    }

    // Use OpenAI Moderation API
    const openai = getOpenAIClient();
    if (!openai) {
      console.warn("OPENAI_API_KEY not set, skipping OpenAI moderation");
      // Fall through to banned topic check
    } else {
      const moderation = await openai.moderations.create({
        model: "omni-moderation-latest",
        input: text,
      });

      const result = moderation.results[0];

      // Check each category
      if (result.categories.hate) {
        categories.push("hate");
        reasons.push("Contains hate speech");
      }
      if (result.categories.harassment) {
        categories.push("harassment");
        reasons.push("Contains harassment or threatening content");
      }
      if (result.categories["self-harm"]) {
        categories.push("self-harm");
        reasons.push("Contains self-harm content");
      }
      if (result.categories.sexual) {
        categories.push("sexual");
        reasons.push("Contains explicit sexual content");
      }
      if (result.categories.violence) {
        categories.push("violence");
        reasons.push("Contains violent content");
      }

      // If flagged by OpenAI moderation, reject immediately
      if (result.flagged) {
        return {
          verdict: "rejected",
          reasons,
          categories,
        };
      }
    }

    // Check for banned topics specific to Lofield FM
    const lowerText = text.toLowerCase();
    const foundBannedTopics: string[] = [];

    // Check for politics
    if (
      lowerText.match(
        /\b(election|vote|government|political|politician|policy|parliament|minister|mp\b|conservative|labour|liberal|democrat|republican)/i
      )
    ) {
      foundBannedTopics.push("politics");
      reasons.push("Political content is not allowed (see style guide)");
    }

    // Check for medical/health advice
    if (
      lowerText.match(
        /\b(diagnos(is|e|ed)|treatment|medication|medicine|cure|disease|illness|symptom|doctor|prescription|therapy|mental health advice)/i
      )
    ) {
      foundBannedTopics.push("health_advice");
      reasons.push(
        "Medical or health advice is not allowed (we're not qualified)"
      );
    }

    // Check for financial advice
    if (
      lowerText.match(
        /\b(invest|stock|trading|crypto|bitcoin|ethereum|financial advice|get rich|money making scheme)/i
      )
    ) {
      foundBannedTopics.push("finance_advice");
      reasons.push("Financial or investment advice is not allowed");
    }

    // Check for spam/advertising
    if (
      lowerText.match(
        /\b(buy now|click here|limited time|act now|visit my|subscribe to|follow me|check out my)/i
      ) ||
      lowerText.includes("http://") ||
      lowerText.includes("https://") ||
      lowerText.includes("www.")
    ) {
      foundBannedTopics.push("spam");
      reasons.push("Promotional content, spam, or URLs are not allowed");
    }

    if (foundBannedTopics.length > 0) {
      categories.push(...foundBannedTopics);
      return {
        verdict: "rejected",
        reasons,
        categories,
      };
    }

    // Check for borderline content that might need rewriting
    // e.g., overly emotional, motivational, or trying too hard
    if (
      lowerText.match(
        /\b(motivate|inspire|you can do it|believe in yourself|chase your dreams|never give up)/i
      )
    ) {
      return {
        verdict: "needs_rewrite",
        reasons: [
          "Content is too motivational for Lofield FM's dry, understated tone",
        ],
        categories: ["tone_mismatch"],
      };
    }

    // All checks passed
    return {
      verdict: "allowed",
      reasons: [],
      categories: [],
    };
  } catch (error) {
    console.error("Error during moderation:", error);
    // Fail open: allow content if moderation service fails
    // This prevents service outages from blocking all requests
    return {
      verdict: "allowed",
      reasons: ["Moderation service temporarily unavailable, request allowed"],
    };
  }
}
