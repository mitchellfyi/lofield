/**
 * Script Generation Module
 *
 * Generates DJ scripts for presenter segments using LLMs.
 * Supports different segment types and show styles.
 */

import OpenAI from "openai";
import { getAIConfig } from "./config";
import { createCache } from "./cache";
import { withRetry, isRetryableError } from "./retry";
import { getStyleGuideExcerpt } from "../config-loader";
import { getHolidayScriptGuidance } from "../seasonal";
import type {
  ScriptGenerationRequest,
  ScriptGenerationResult,
  ScriptMetadata,
  SegmentType,
} from "./types";
import { ScriptGenerationError } from "./types";

// OpenAI client (lazy-loaded)
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new ScriptGenerationError(
      "OPENAI_API_KEY environment variable is not set. Please add OPENAI_API_KEY to your .env file. Get your API key from: https://platform.openai.com/api-keys",
      { provider: "openai" }
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

// Cache for script generation results
const config = getAIConfig();
const scriptCache = createCache<ScriptGenerationResult>(
  "script",
  config.script.cacheTTL,
  config.script.cacheEnabled,
  config.storage.cacheDir
);

/**
 * Generate a presenter script
 */
export async function generateScript(
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResult> {
  // Check cache first
  // Normalize cache key by excluding transient contextInfo fields (currentTime, previousTrack, nextTrack)
  // to allow reuse of scripts with similar characteristics
  const cacheKey = {
    segmentType: request.segmentType,
    showStyle: request.showStyle,
    topic: request.topic,
    trackInfo: request.trackInfo,
    // Include only non-transient context: season, weather, and holiday tags
    season: request.contextInfo?.season,
    weather: request.contextInfo?.weather,
    holidayTags: request.contextInfo?.holidayTags,
    presenterIds: request.presenterIds,
    durationSeconds: request.durationSeconds,
  };

  const cached = scriptCache.get(cacheKey);
  if (cached) {
    console.log(
      `Script cache hit for ${request.segmentType} / ${request.showStyle}`
    );
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(() => generateScriptInternal(request), {
      maxAttempts: config.retry.maxAttempts,
      baseDelay: config.retry.baseDelay,
      maxDelay: config.retry.maxDelay,
      onRetry: (attempt, error) => {
        console.warn(
          `Script generation attempt ${attempt} failed: ${error.message}`
        );
      },
    });

    // Cache successful result
    if (result.success && result.transcript) {
      scriptCache.set(cacheKey, result, {
        segmentType: request.segmentType,
        showStyle: request.showStyle,
        generatedAt: new Date().toISOString(),
      });
    }

    return result;
  } catch (error) {
    console.error("Script generation failed after all retries:", error);
    return {
      success: false,
      error: (error as Error).message,
      cached: false,
    };
  }
}

/**
 * Internal script generation logic
 */
async function generateScriptInternal(
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResult> {
  const config = getAIConfig();

  if (config.script.provider === "openai") {
    return await generateScriptWithOpenAI(request);
  } else {
    throw new ScriptGenerationError(
      `Unsupported script provider: ${config.script.provider}`,
      { provider: config.script.provider }
    );
  }
}

/**
 * Generate script using OpenAI
 */
async function generateScriptWithOpenAI(
  request: ScriptGenerationRequest
): Promise<ScriptGenerationResult> {
  const config = getAIConfig();
  const openai = getOpenAIClient();

  const systemPrompt = buildSystemPrompt(request);
  const userPrompt = buildUserPrompt(request);

  console.log(
    `Generating ${request.segmentType} script for ${request.showStyle}`
  );

  try {
    const completion = await openai.chat.completions.create({
      model: config.script.model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.script.temperature,
      max_tokens: config.script.maxTokens,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new ScriptGenerationError("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);

    if (!parsed.transcript) {
      throw new ScriptGenerationError("No transcript in response");
    }

    const metadata: ScriptMetadata = {
      segmentType: request.segmentType,
      tone: parsed.tone || "matter-of-fact",
      tags: parsed.tags || [],
      estimatedDuration:
        parsed.estimatedDuration || estimateDuration(parsed.transcript),
      presenterIds: request.presenterIds,
      generatedAt: new Date(),
      model: config.script.model,
    };

    return {
      success: true,
      transcript: parsed.transcript,
      metadata,
      cached: false,
    };
  } catch (error) {
    const err = error as Error;

    if (isRetryableError(err)) {
      throw err;
    }

    throw new ScriptGenerationError(
      `OpenAI generation failed: ${err.message}`,
      { error: err.message, request }
    );
  }
}

/**
 * Build system prompt for script generation
 */
function buildSystemPrompt(request: ScriptGenerationRequest): string {
  const styleGuide = getStyleGuideExcerpt();
  const guidelines = getSegmentGuidelines(request.segmentType);
  const showContext = getShowContext(request.showStyle);

  return `You are a script writer for Lofield FM, an AI-powered radio station.

${styleGuide}

${showContext}

${guidelines}

CRITICAL RULES:
- Use dry, understated humor
- Reference remote work pain points (bad Wi-Fi, endless meetings)
- Keep it relatable and matter-of-fact
- NO motivational speeches or "you can do it!" energy
- NO health or medical advice
- NO politics or divisive topics
- NO cruel or mean-spirited humor
- Acknowledge the AI aspect (we don't pretend to be human)

Return a JSON object with this structure:
{
  "transcript": "the script text",
  "tone": "dry" | "reflective" | "humorous" | "matter-of-fact",
  "tags": ["relevant", "tags"],
  "estimatedDuration": seconds
}`;
}

/**
 * Build user prompt for script generation
 */
function buildUserPrompt(request: ScriptGenerationRequest): string {
  let prompt = `Generate a ${request.segmentType} script for the ${request.showStyle} show.\n`;

  if (request.trackInfo) {
    prompt += `\nTrack info:`;
    prompt += `\n- Title: ${request.trackInfo.title}`;
    if (request.trackInfo.requester) {
      prompt += `\n- Requested by: ${request.trackInfo.requester}`;
    }
    if (request.trackInfo.location) {
      prompt += `\n- Location: ${request.trackInfo.location}`;
    }
  }

  if (request.topic) {
    prompt += `\nTopic: ${request.topic}`;
  }

  if (request.contextInfo) {
    prompt += `\nContext:`;
    if (request.contextInfo.currentTime) {
      prompt += `\n- Time: ${request.contextInfo.currentTime.toLocaleTimeString()}`;
    }
    if (request.contextInfo.previousTrack) {
      prompt += `\n- Previous track: ${request.contextInfo.previousTrack}`;
    }
    if (request.contextInfo.nextTrack) {
      prompt += `\n- Next track: ${request.contextInfo.nextTrack}`;
    }
    if (request.contextInfo.season) {
      prompt += `\n- Season: ${request.contextInfo.season}`;
    }
    if (request.contextInfo.weather) {
      prompt += `\n- Weather: ${request.contextInfo.weather}`;
    }
    if (
      request.contextInfo.holidayTags &&
      request.contextInfo.holidayTags.length > 0
    ) {
      // Get detailed holiday guidance from the seasonal module
      const holidayGuidance = getHolidayScriptGuidance(
        request.contextInfo.currentTime || new Date()
      );

      if (holidayGuidance) {
        prompt += `\n\n**HOLIDAY CONTEXT**`;
        prompt += `\n- Holiday/Event: ${holidayGuidance.holidayTags.join(", ")}`;
        prompt += `\n\n${holidayGuidance.guidance}`;
        prompt += `\n\n**Style Guidelines for Holidays:**`;
        prompt += `\n- Keep references low-key and understated`;
        prompt += `\n- Acknowledge the date without being overly festive or enthusiastic`;
        prompt += `\n- Recognize that not everyone celebrates - avoid assumptions`;
        prompt += `\n- Reference practical impacts (e.g., "reduced traffic", "shops closed") rather than celebration expectations`;
        prompt += `\n- Maintain the dry, self-deprecating Lofield FM tone`;
        prompt += `\n- DO NOT be overly cheerful or give advice about how people should celebrate`;

        if (holidayGuidance.exampleLines.length > 0) {
          prompt += `\n\n**Example Lines (Lofield FM style):**`;
          for (const example of holidayGuidance.exampleLines.slice(0, 3)) {
            prompt += `\n- "${example}"`;
          }
        }
      } else {
        // Fallback if guidance not available
        prompt += `\n- Holidays/Events: ${request.contextInfo.holidayTags.join(", ")}`;
        prompt += `\n  (Reference these in a low-key, understated way if appropriate. Avoid assumptions about celebration.)`;
      }
    }
  }

  if (request.durationSeconds) {
    prompt += `\n\nTarget duration: ${request.durationSeconds} seconds`;
  }

  prompt += `\n\nGenerate the script and return JSON.`;

  return prompt;
}

/**
 * Get segment-specific guidelines
 */
function getSegmentGuidelines(type: SegmentType): string {
  switch (type) {
    case "track_intro":
      return `TRACK INTRO (15-30 seconds):
- Introduce the upcoming track
- Read requester name and location if provided
- Keep it brief and dry
- Optional: mild observational humor about the request
Example: "That was 'Rainfall on a Tuesday,' requested by Sarah in Sheffield. Sarah, we hope your Wi-Fi is holding up. Statistically speaking, it probably isn't."`;

    case "segment":
      return `TOPICAL SEGMENT (1-2 minutes):
- Discuss a topic related to remote work, daily life, or Lofield
- Use dry, self-deprecating humor
- Reference Lofield landmarks or running jokes if appropriate
- Keep it conversational but don't try too hard
Example topic: back-to-back video calls, pretending to listen on mute, the illusion of inbox zero`;

    case "handover":
      return `HANDOVER (5 minutes):
- Transition from one duo to the next
- Acknowledge time of day and show change
- Brief banter between presenters
- Preview what's coming up in the next show
- Keep it natural, like colleagues changing shifts`;

    case "ident":
      return `STATION IDENT (5-10 seconds):
- Brief station identification
- Can include tagline or time/show name
- Keep it simple and direct
Examples: "Lofield FM. Now playing on a frequency that probably doesn't exist."
"You're listening to Deep Work, on Lofield FM."`;

    default:
      return "Generate an appropriate script for this segment.";
  }
}

/**
 * Get show-specific context
 */
function getShowContext(showStyle: string): string {
  const contexts: Record<string, string> = {
    mild_panic_mornings:
      "Mild Panic Mornings: 6-9 AM. Controlled chaos, acknowledging morning panic without being cheerful about it. Topics: morning routines, inbox anxiety, meeting prep, coffee, first call of the day.",
    deep_work_allegedly:
      "Deep Work, Allegedly: 6-9 AM (early hours). For people starting the work day very early. Gentle, soft energy, not quite awake yet. Topics: early morning focus, quiet hours, coffee, pre-dawn productivity.",
    deep_work_calendar_blocks:
      "Deep Work (According to Calendar Blocks): 9 AM-12 PM. Focused work time, minimal interruptions (in theory). Topics: concentration, meetings, productivity theater, deep work aspirations vs reality.",
    lunch_procrastination_club:
      "Lunch Procrastination Club: 12-3 PM. Mid-day energy, slightly lighter. Topics: lunch breaks, pretending to socialize, inbox management, afternoon procrastination.",
    afternoon_survival_session:
      "Afternoon Survival Session: 3-6 PM. Late afternoon energy dip, technically still operational. Topics: afternoon slump, existential meetings, counting down to end of day, survival mode.",
    commute_to_nowhere:
      "Commute to Nowhere: 6-9 PM. Evening wind-down, acknowledging the fictional commute. Topics: end of workday, disconnecting, evening plans (or lack thereof), pretending to have a commute.",
    lofield_night_school:
      "Lofield Night School: 9 PM-12 AM. Thoughtful, reflective, for people who read documentation. Topics: learning, side projects, curiosity, late-night focus.",
    insomniac_office:
      "Insomniac Office: 12-3 AM. Quiet, contemplative, for people who can't sleep anyway. Topics: insomnia, late-night thoughts, unconventional schedules, surreal 2am energy.",
  };

  return contexts[showStyle] || "General show context.";
}

/**
 * Estimate script duration based on character count
 * Rough estimate: ~150 words per minute, ~5 chars per word
 */
function estimateDuration(transcript: string): number {
  const charCount = transcript.length;
  const wordsPerMinute = 150;
  const charsPerWord = 5;
  const estimatedWords = charCount / charsPerWord;
  const estimatedMinutes = estimatedWords / wordsPerMinute;
  return Math.ceil(estimatedMinutes * 60); // Convert to seconds
}

/**
 * Get cache statistics
 */
export function getScriptCacheStats() {
  return scriptCache.getStats();
}

/**
 * Clear script cache
 */
export function clearScriptCache() {
  scriptCache.clear();
}
