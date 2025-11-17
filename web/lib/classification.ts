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

// Load allowed tags from config
const ALLOWED_TAGS = [
  "remote_work",
  "morning_routine",
  "coffee",
  "focus_time",
  "deep_work",
  "procrastination",
  "lunch_break",
  "afternoon_slump",
  "end_of_day",
  "work_from_home",
  "video_calls",
  "meetings",
  "inbox_anxiety",
  "notifications",
  "wifi_problems",
  "technical_difficulties",
  "lofi_vibes",
  "rainy_day",
  "coding_session",
  "writing_session",
  "study_session",
  "creative_work",
  "late_night_work",
  "early_morning",
  "quiet_hours",
  "sunrise",
  "early_start",
  "commute",
  "work_start",
  "meeting_prep",
  "first_call",
  "petty_grievances",
  "minor_frustrations",
  "relatable_struggles",
  "coworking",
  "freelancing",
  "digital_nomad",
  "timezone_confusion",
  "seasonal_mood",
  "winter_blues",
  "summer_evenings",
  "rainy_weather",
  "obscure_history",
  "local_landmarks",
  "lofield_lore",
  "roadworks",
  "the_hub",
  "station_references",
  "nostalgic",
  "contemplative",
  "chill_beats",
  "ambient_sounds",
  "nature_sounds",
  "urban_ambience",
  "vinyl_crackle",
  "jazz_elements",
  "piano_focus",
  "guitar_melodies",
  "soft_percussion",
  "evening_wind_down",
  "evening_routine",
  "logging_off",
  "closing_laptop",
  "dinner_time",
  "finally_done",
  "insomnia",
  "late_night_thoughts",
  "insomnia_prevention",
  "reflective",
  "peaceful",
  "bedtime_routine",
  "existential_thoughts",
  "productivity_myths",
  "work_life_balance",
  "virtual_meetings",
  "slack_messages",
  "email_overload",
  "deadline_stress",
  "client_calls",
  "side_projects",
  "hobby_coding",
  "tea_break",
  "snack_time",
  "meal_deals",
  "cooking_at_desk",
  "staring_into_fridge",
  "pretending_to_work",
  "actually_working",
  "flow_state",
  "concentration",
  "productivity",
  "back_to_back_meetings",
  "pretend_walk",
  "midday_thoughts",
  "end_of_day_countdown",
  "meeting_fatigue",
  "almost_done",
  "final_push",
  "context_switching",
  "multitasking",
  "single_tasking",
  "pomodoro_technique",
  "distraction_free",
  "background_noise",
  "white_noise",
  "cafe_sounds",
  "keyboard_typing",
  "mouse_clicking",
  "comfortable_silence",
];

const STYLE_GUIDE_EXCERPT = `
Lofield FM Voice and Tone:
- Dry and understated: No shouting, no fake enthusiasm
- Self-deprecating: We're all in this together, and "this" is mildly absurd
- Slightly dark but never cruel
- Relatable: Speaking to remote work culture
- Matter-of-fact about the AI

CONTENT GUIDELINES:
✓ DO: Reference remote work pain points, Lofield landmarks, maintain show-specific personality
✗ DON'T: Give motivational speeches, offer health/medical advice, discuss politics, be cruel, include explicit content

Examples of Good Tone:
- "That was 'Rainfall on a Tuesday,' requested by Sarah in Sheffield. Sarah, we hope your Wi-Fi is holding up. Statistically speaking, it probably isn't."
- "Next up, a track inspired by the experience of joining a video call and realizing you're the only one with your camera on."
`;

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
  userType: "music" | "talk",
): Promise<ClassificationResult> {
  const openai = getOpenAIClient();
  if (!openai) {
    // Fallback: use simple heuristics without LLM
    return fallbackClassification(text, userType);
  }

  try {
    const systemPrompt = `You are a content classifier for Lofield FM, an AI-powered radio station with a dry, understated tone.

${STYLE_GUIDE_EXCERPT}

Your task is to classify user requests and extract structured metadata.

Allowed tags: ${ALLOWED_TAGS.join(", ")}

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
        ALLOWED_TAGS.includes(tag),
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
  userType: "music" | "talk",
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

  const hasMusicKeywords = musicKeywords.some((kw) =>
    lowerText.includes(kw),
  );
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
