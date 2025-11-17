import OpenAI from "openai";
import { getAllowedTags, getStyleGuideExcerpt } from "./config-loader";

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

export type RequestType = "music_prompt" | "talk_topic";

export interface MusicMetadata {
  mood: string[];
  tempo: string; // "slow", "medium", "fast"
  energy: string; // "low", "medium", "high"
  keywords: string[];
  tags: string[];
}

export interface TalkMetadata {
  topic: string;
  tone: string; // "dry", "reflective", "humorous", "matter-of-fact"
  tags: string[];
  suggestedDuration?: number; // in seconds
}

export interface ClassificationResult {
  type: RequestType;
  normalized: string; // LLM-cleaned version of the request
  metadata: MusicMetadata | TalkMetadata;
  confidence: number; // 0-1
}

// Load allowed tags and style guide from centralized config
// These are loaded dynamically from config/tags.json and config/station.json
// to ensure consistency with the rest of the system

/**
 * Classifies a user request as either a music prompt or talk topic,
 * extracting structured metadata using an LLM.
 *
 * @param text - The user-submitted request text (already moderated)
 * @param userType - User-specified type hint ("music" or "talk")
 * @returns ClassificationResult with type, normalized text, and metadata
 */
export async function classifyRequest(
  text: string,
  userType: "music" | "talk"
): Promise<ClassificationResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    // Fallback: use simple heuristics without LLM
    return fallbackClassification(text, userType);
  }

  try {
    // Load allowed tags and style guide from config
    const allowedTags = getAllowedTags();
    const styleGuideExcerpt = getStyleGuideExcerpt();

    const systemPrompt = `You are a content classifier for Lofield FM, an AI-powered radio station with a dry, understated tone.

${styleGuideExcerpt}

Your task is to classify user requests and extract structured metadata.

Allowed tags: ${allowedTags.join(", ")}

Return a JSON object with this structure:
{
  "type": "music_prompt" or "talk_topic",
  "normalized": "cleaned version of the request",
  "confidence": 0.0 to 1.0,
  "metadata": {
    // For music_prompt:
    "mood": ["descriptive", "words"],
    "tempo": "slow" | "medium" | "fast",
    "energy": "low" | "medium" | "high",
    "keywords": ["key", "words"],
    "tags": ["matching", "allowed", "tags"]
    
    // For talk_topic:
    "topic": "core topic description",
    "tone": "dry" | "reflective" | "humorous" | "matter-of-fact",
    "tags": ["matching", "allowed", "tags"],
    "suggestedDuration": seconds (60-180)
  }
}

Guidelines:
1. Normalize the text to match Lofield FM's dry, understated tone
2. Only use tags from the allowed list
3. For music: extract mood, tempo, energy level
4. For talk: identify core topic and appropriate tone
5. If the user type doesn't match the content, use what makes sense
6. Confidence should reflect how clear the request is`;

    const userPrompt = `User type hint: ${userType}
Request text: "${text}"

Classify this request and return JSON.`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from LLM");
    }

    const result = JSON.parse(content) as ClassificationResult;

    // Validate the response structure
    if (!result.type || !result.normalized || !result.metadata) {
      throw new Error("Invalid response structure from LLM");
    }

    // Filter tags to only include allowed ones
    if (result.metadata.tags) {
      result.metadata.tags = result.metadata.tags.filter((tag) =>
        allowedTags.includes(tag)
      );
    }

    return result;
  } catch (error) {
    console.error("Error during classification:", error);
    // Fallback to simple classification
    return fallbackClassification(text, userType);
  }
}

/**
 * Fallback classification when LLM is unavailable.
 * Uses simple heuristics based on keywords and user type hint.
 */
function fallbackClassification(
  text: string,
  userType: "music" | "talk"
): ClassificationResult {
  const lowerText = text.toLowerCase();

  // Determine if it's music or talk based on keywords
  const musicKeywords = [
    "music",
    "track",
    "song",
    "beat",
    "melody",
    "rhythm",
    "lofi",
    "chill",
    "ambient",
    "piano",
    "guitar",
    "jazz",
    "instrumental",
  ];
  const talkKeywords = [
    "talk",
    "discuss",
    "chat",
    "topic",
    "about",
    "tell",
    "story",
    "thoughts",
    "experience",
  ];

  const hasMusicKeywords = musicKeywords.some((kw) => lowerText.includes(kw));
  const hasTalkKeywords = talkKeywords.some((kw) => lowerText.includes(kw));

  let type: RequestType;
  if (hasMusicKeywords && !hasTalkKeywords) {
    type = "music_prompt";
  } else if (hasTalkKeywords && !hasMusicKeywords) {
    type = "talk_topic";
  } else {
    // Use user hint
    type = userType === "music" ? "music_prompt" : "talk_topic";
  }

  // Extract basic tags
  const tags: string[] = [];
  if (lowerText.includes("morning")) tags.push("morning_routine");
  if (lowerText.includes("focus") || lowerText.includes("concentration"))
    tags.push("focus_time");
  if (lowerText.includes("coffee")) tags.push("coffee");
  if (lowerText.includes("coding")) tags.push("coding_session");
  if (lowerText.includes("meeting")) tags.push("meetings");
  if (lowerText.includes("work")) tags.push("remote_work");
  if (lowerText.includes("rain")) tags.push("rainy_day");
  if (lowerText.includes("chill")) tags.push("chill_beats");

  if (type === "music_prompt") {
    return {
      type,
      normalized: text.trim(),
      confidence: 0.6,
      metadata: {
        mood: ["calm", "focused"],
        tempo: "medium",
        energy: "medium",
        keywords: text.split(" ").slice(0, 5),
        tags: tags.length > 0 ? tags : ["lofi_vibes"],
      },
    };
  } else {
    return {
      type,
      normalized: text.trim(),
      confidence: 0.6,
      metadata: {
        topic: text.trim().substring(0, 100),
        tone: "matter-of-fact",
        tags: tags.length > 0 ? tags : ["remote_work"],
        suggestedDuration: 120,
      },
    };
  }
}
