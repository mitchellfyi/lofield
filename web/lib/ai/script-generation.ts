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
      "OPENAI_API_KEY not set",
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
  const cached = scriptCache.get(request);
  if (cached) {
    console.log(`Script cache hit for ${request.segmentType} / ${request.showStyle}`);
    return { ...cached, cached: true };
  }

  try {
    const result = await withRetry(
      () => generateScriptInternal(request),
      {
        maxAttempts: config.retry.maxAttempts,
        baseDelay: config.retry.baseDelay,
        maxDelay: config.retry.maxDelay,
        onRetry: (attempt, error) => {
          console.warn(`Script generation attempt ${attempt} failed: ${error.message}`);
        },
      }
    );

    // Cache successful result
    if (result.success && result.transcript) {
      scriptCache.set(request, result, {
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

  console.log(`Generating ${request.segmentType} script for ${request.showStyle}`);

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
      estimatedDuration: parsed.estimatedDuration || estimateDuration(parsed.transcript),
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
    morning_commute: "Morning Commute (The Fictional One): 6-9 AM. Upbeat but realistic. Topics: morning routines, commute (even if fictional), coffee, starting the day.",
    deep_work: "Deep Work (According to Calendar Blocks): 9 AM-12 PM. Focused, minimal interruptions. Topics: concentration, meetings, productivity theater.",
    lunch_club: "Lunch Club (Allegedly Social): 12-3 PM. Slightly lighter, mid-day energy. Topics: lunch breaks, pretending to socialize, inbox management.",
    survival: "Survival Mode (Technically Still Operational): 3-6 PM. Late afternoon energy dip. Topics: afternoon slump, existential meetings, counting down to end of day.",
    commute: "Evening Commute (Another One): 6-9 PM. Winding down, lighter mood. Topics: end of workday, disconnecting, evening plans (or lack thereof).",
    night_school: "Night School (For People Who Read Documentation): 9 PM-12 AM. Thoughtful, reflective. Topics: learning, side projects, documentation, curiosity.",
    night_shift: "Night Shift (For People Who Can't Sleep Anyway): 12-3 AM. Quiet, contemplative. Topics: insomnia, late-night thoughts, unconventional schedules.",
    insomniac: "The Insomniac Sessions (Might As Well Be Productive): 3-6 AM. Very late/very early. Topics: inability to sleep, quiet hours, sunrise approaches.",
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
