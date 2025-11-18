/**
 * Script Generation Adapter for Scheduler Service
 * 
 * Integrates with OpenAI GPT-4 to generate presenter scripts based on
 * show configuration, seasonal context, and presenter personas.
 */

import OpenAI from "openai";
import * as crypto from "crypto";
import logger from "../logger";
import type { ShowConfig, Presenter, Request } from "../types";

// OpenAI client (lazy-loaded)
let openaiClient: OpenAI | null = null;

/**
 * Get or initialize OpenAI client
 */
function getOpenAIClient(): OpenAI {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY environment variable is not set. Please add OPENAI_API_KEY to your .env file. Get your API key from: https://platform.openai.com/api-keys"
    );
  }

  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  return openaiClient;
}

// Simple in-memory cache for scripts
interface CacheEntry {
  script: string;
  timestamp: number;
}

const scriptCache = new Map<string, CacheEntry>();
const CACHE_TTL = 3600 * 1000; // 1 hour in milliseconds

/**
 * Generate a cache key for script generation
 */
function getCacheKey(params: {
  segmentType: string;
  showId: string;
  season?: string;
  holidayTags?: string[];
  presenters: string[];
  topic?: string;
}): string {
  const data = {
    segmentType: params.segmentType,
    showId: params.showId,
    season: params.season,
    holidayTags: params.holidayTags?.sort().join(","),
    presenters: params.presenters.sort().join(","),
    topic: params.topic,
  };
  return crypto.createHash("md5").update(JSON.stringify(data)).digest("hex");
}

/**
 * Check cache for a script
 */
function getFromCache(key: string): string | null {
  const entry = scriptCache.get(key);
  if (!entry) return null;

  const age = Date.now() - entry.timestamp;
  if (age > CACHE_TTL) {
    scriptCache.delete(key);
    return null;
  }

  return entry.script;
}

/**
 * Store script in cache
 */
function storeInCache(key: string, script: string): void {
  scriptCache.set(key, {
    script,
    timestamp: Date.now(),
  });
}

/**
 * Build system prompt for script generation
 */
function buildSystemPrompt(): string {
  return `You are a script writer for Lofield FM, an AI-powered radio station.

**Lofield FM Voice Guidelines:**
- Use dry, understated humor
- Reference remote work pain points (bad Wi-Fi, endless meetings, inbox anxiety)
- Keep it relatable and matter-of-fact
- Acknowledge the AI aspect (we don't pretend to be human)
- Self-deprecating tone, never cruel
- Short sentences that are easy to speak

**CRITICAL RULES:**
- NO motivational speeches or "you can do it!" energy
- NO health or medical advice
- NO politics or divisive topics
- NO cruel or mean-spirited humor
- NO outdated slang or trying too hard to be cool

Return a JSON object with this structure:
{
  "transcript": "the script text - natural spoken dialogue",
  "estimatedDuration": seconds
}`;
}

/**
 * Build user prompt for track intro
 */
function buildTrackIntroPrompt(
  trackTitle: string,
  showConfig: ShowConfig,
  presenters: Presenter[],
  request: Request | null,
  seasonalContext?: { season?: string; holidayTags?: string[] }
): string {
  let prompt = `Generate a brief track introduction (15-30 seconds) for the show "${showConfig.name}".\n`;
  prompt += `\nShow mood: ${showConfig.tone.mood}`;
  prompt += `\nShow energy: ${showConfig.tone.energy_level}`;
  prompt += `\nTrack: "${trackTitle}"`;

  if (request) {
    prompt += `\nRequested by: ${request.userId || "a listener"}`;
  }

  prompt += `\n\nPresenters:\n`;
  for (const presenter of presenters) {
    prompt += `- ${presenter.name} (${presenter.role}): ${presenter.persona}\n`;
    if (presenter.quirks && presenter.quirks.length > 0) {
      prompt += `  Quirks: ${presenter.quirks.join(", ")}\n`;
    }
  }

  if (seasonalContext?.season) {
    prompt += `\nSeason: ${seasonalContext.season}`;
  }

  if (seasonalContext?.holidayTags && seasonalContext.holidayTags.length > 0) {
    prompt += `\nHoliday context: ${seasonalContext.holidayTags.join(", ")}`;
    prompt += `\n(Reference these in a low-key, understated way if appropriate. Avoid assumptions about celebration.)`;
  }

  prompt += `\n\nShow commentary style examples:\n`;
  if (showConfig.commentary_style?.sample_lines) {
    for (const line of showConfig.commentary_style.sample_lines.slice(0, 3)) {
      prompt += `- "${line}"\n`;
    }
  }

  prompt += `\n\nKeep it brief, dry, and conversational. Target 15-30 seconds of speech.`;

  return prompt;
}

/**
 * Build user prompt for longer commentary segment
 */
function buildSegmentPrompt(
  topic: string,
  showConfig: ShowConfig,
  presenters: Presenter[],
  seasonalContext?: { season?: string; holidayTags?: string[] },
  targetDuration: number = 60
): string {
  let prompt = `Generate a topical commentary segment (${targetDuration} seconds) for the show "${showConfig.name}".\n`;
  prompt += `\nTopic: ${topic}`;
  prompt += `\nShow mood: ${showConfig.tone.mood}`;
  prompt += `\nShow energy: ${showConfig.tone.energy_level}`;

  prompt += `\n\nPresenters:\n`;
  for (const presenter of presenters) {
    prompt += `- ${presenter.name} (${presenter.role}): ${presenter.persona}\n`;
    if (presenter.quirks && presenter.quirks.length > 0) {
      prompt += `  Quirks: ${presenter.quirks.join(", ")}\n`;
    }
  }

  if (presenters.length > 1) {
    prompt += `\nThis is a duo segment - create a brief back-and-forth conversation between the presenters.`;
    prompt += `\nFormat as natural dialogue. Use speaker labels like "${presenters[0].name}:" and "${presenters[1].name}:"`;
  }

  if (seasonalContext?.season) {
    prompt += `\nSeason: ${seasonalContext.season}`;
  }

  if (seasonalContext?.holidayTags && seasonalContext.holidayTags.length > 0) {
    prompt += `\nHoliday context: ${seasonalContext.holidayTags.join(", ")}`;
  }

  prompt += `\n\nShow commentary style examples:\n`;
  if (showConfig.commentary_style?.sample_lines) {
    for (const line of showConfig.commentary_style.sample_lines.slice(0, 3)) {
      prompt += `- "${line}"\n`;
    }
  }

  prompt += `\n\nTarget duration: ${targetDuration} seconds of speech.`;

  return prompt;
}

/**
 * Generate a script using OpenAI
 */
export async function generateScript(params: {
  segmentType: "track_intro" | "segment" | "handover" | "ident";
  showConfig: ShowConfig;
  presenters: Presenter[];
  trackTitle?: string;
  request?: Request | null;
  topic?: string;
  seasonalContext?: { season?: string; holidayTags?: string[] };
  targetDuration?: number;
}): Promise<{ script: string; estimatedDuration: number }> {
  const {
    segmentType,
    showConfig,
    presenters,
    trackTitle,
    request,
    topic,
    seasonalContext,
    targetDuration = 30,
  } = params;

  // Check cache
  const cacheKey = getCacheKey({
    segmentType,
    showId: showConfig.id,
    season: seasonalContext?.season,
    holidayTags: seasonalContext?.holidayTags,
    presenters: presenters.map((p) => p.id),
    topic,
  });

  const cached = getFromCache(cacheKey);
  if (cached) {
    logger.debug(`  [CACHE] Script cache hit for ${segmentType}`);
    const wordCount = cached.split(/\s+/).length;
    const estimatedDuration = Math.ceil((wordCount / 150) * 60);
    return { script: cached, estimatedDuration };
  }

  // Build prompts
  const systemPrompt = buildSystemPrompt();
  let userPrompt: string;

  if (segmentType === "track_intro" && trackTitle) {
    userPrompt = buildTrackIntroPrompt(
      trackTitle,
      showConfig,
      presenters,
      request || null,
      seasonalContext
    );
  } else if (segmentType === "segment" && topic) {
    userPrompt = buildSegmentPrompt(
      topic,
      showConfig,
      presenters,
      seasonalContext,
      targetDuration
    );
  } else if (segmentType === "ident") {
    userPrompt = `Generate a brief station ident (5-10 seconds) for ${showConfig.name}. Include the show name and time if appropriate.`;
  } else {
    // Fallback
    userPrompt = `Generate a ${segmentType} script for ${showConfig.name}.`;
  }

  logger.debug(`  [AI] Generating ${segmentType} script for ${showConfig.name}`);

  try {
    const openai = getOpenAIClient();
    const completion = await openai.chat.completions.create({
      model: process.env.SCRIPT_MODEL || "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" },
    });

    const content = completion.choices[0].message.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }

    const parsed = JSON.parse(content);
    if (!parsed.transcript) {
      throw new Error("No transcript in response");
    }

    const script = parsed.transcript;
    const estimatedDuration =
      parsed.estimatedDuration ||
      Math.ceil((script.split(/\s+/).length / 150) * 60);

    // Cache the result
    storeInCache(cacheKey, script);

    logger.debug(`  [AI] Generated script: "${script.substring(0, 100)}..."`);
    return { script, estimatedDuration };
  } catch (error) {
    logger.error({ err: error }, "  [ERROR] Script generation failed");
    throw error;
  }
}

/**
 * Split a duo script between two presenters
 * Returns array of { presenterId, text } segments
 */
export function splitScriptForDuo(
  script: string,
  presenters: Presenter[]
): { presenterId: string; text: string }[] {
  if (presenters.length < 2) {
    return [{ presenterId: presenters[0].id, text: script }];
  }

  // Check if script already has speaker labels (e.g., "Alex: Hello")
  const hasLabels = /^[A-Z][a-z]+:\s/.test(script);

  if (hasLabels) {
    // Parse labeled script
    const segments: { presenterId: string; text: string }[] = [];
    const lines = script.split(/\n+/);

    for (const line of lines) {
      const match = line.match(/^([A-Z][a-z]+):\s*(.+)$/);
      if (match) {
        const speakerName = match[1];
        const text = match[2];

        // Find presenter by name
        const presenter = presenters.find(
          (p) => p.name.toLowerCase() === speakerName.toLowerCase()
        );
        if (presenter) {
          segments.push({ presenterId: presenter.id, text });
        } else {
          // Unknown speaker, assign to first presenter
          segments.push({ presenterId: presenters[0].id, text });
        }
      } else if (line.trim()) {
        // Line without label, assign to last speaker or first presenter
        const lastSegment = segments[segments.length - 1];
        if (lastSegment) {
          lastSegment.text += " " + line.trim();
        } else {
          segments.push({ presenterId: presenters[0].id, text: line.trim() });
        }
      }
    }

    return segments.length > 0
      ? segments
      : [{ presenterId: presenters[0].id, text: script }];
  } else {
    // Split sentences between presenters
    const sentences = script.split(/(?<=[.!?])\s+/);
    const segments: { presenterId: string; text: string }[] = [];

    for (let i = 0; i < sentences.length; i++) {
      const presenterIndex = i % presenters.length;
      segments.push({
        presenterId: presenters[presenterIndex].id,
        text: sentences[i],
      });
    }

    return segments;
  }
}
