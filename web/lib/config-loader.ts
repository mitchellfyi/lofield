import { readFileSync } from "fs";
import { join } from "path";

// Define types for configuration structures
interface TagsConfig {
  allowed_topic_tags: string[];
  banned_topic_tags: string[];
  holiday_tags: Record<string, string[]>;
  seasonal_tags: Record<string, string[]>;
  topic_categories: Record<string, string[]>;
  notes: string[];
}

interface StationConfig {
  name: string;
  tagline: string;
  timezone: string;
  frequency: string;
  description: string;
  default_ratios: {
    max_music_fraction: number;
    min_talk_fraction: number;
    description: string;
  };
  default_timing: {
    max_link_seconds: number;
    min_gap_between_links_seconds: number;
    handover_duration_seconds: number;
    station_ident_seconds: number;
  };
  default_tone: {
    keywords: string[];
    description: string;
  };
  forbidden_styles: string[];
  forbidden_topics: string[];
  style_guide_excerpt?: string;
  seasons: Record<string, unknown>;
  ai_budget: Record<string, unknown>;
  streaming: Record<string, unknown>;
  moderation: Record<string, unknown>;
}

interface Presenter {
  id: string;
  name: string;
  voice_id: string;
  role: string;
  persona: string;
  shows: string[];
  quirks: string[];
}

interface PresentersConfig {
  presenters: Presenter[];
}

// Cache loaded configs to avoid repeated file reads
let tagsConfigCache: TagsConfig | null = null;
let stationConfigCache: StationConfig | null = null;
let presentersConfigCache: PresentersConfig | null = null;

/**
 * Get the path to the config directory.
 * In development/production, configs are in the parent directory.
 * In tests, they're also in the parent directory.
 */
function getConfigPath(filename: string): string {
  // Try to find the config directory
  const possiblePaths = [
    join(process.cwd(), "..", "config", filename),
    join(process.cwd(), "config", filename),
  ];

  for (const path of possiblePaths) {
    try {
      readFileSync(path);
      return path;
    } catch {
      continue;
    }
  }

  // If we can't find it, return the default path
  return join(process.cwd(), "..", "config", filename);
}

/**
 * Load the tags configuration from config/tags.json
 */
export function loadTagsConfig(): TagsConfig {
  if (tagsConfigCache) {
    return tagsConfigCache;
  }

  const configPath = getConfigPath("tags.json");
  const configContent = readFileSync(configPath, "utf-8");
  tagsConfigCache = JSON.parse(configContent);
  return tagsConfigCache!;
}

/**
 * Load the station configuration from config/station.json
 */
export function loadStationConfig(): StationConfig {
  if (stationConfigCache) {
    return stationConfigCache;
  }

  const configPath = getConfigPath("station.json");
  const configContent = readFileSync(configPath, "utf-8");
  stationConfigCache = JSON.parse(configContent);
  return stationConfigCache!;
}

/**
 * Get the list of allowed topic tags from config/tags.json
 */
export function getAllowedTags(): string[] {
  const config = loadTagsConfig();
  return config.allowed_topic_tags;
}

/**
 * Get the list of banned topic tags from config/tags.json
 */
export function getBannedTags(): string[] {
  const config = loadTagsConfig();
  return config.banned_topic_tags;
}

/**
 * Get the style guide excerpt for use in LLM prompts.
 * This provides a concise summary of the station's voice and tone.
 */
export function getStyleGuideExcerpt(): string {
  const config = loadStationConfig();

  // If a custom excerpt is defined in station.json, use it
  if (config.style_guide_excerpt) {
    return config.style_guide_excerpt;
  }

  // Otherwise, construct it from the station config
  return `
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
`.trim();
}

/**
 * Load the presenters configuration from config/presenters.json
 */
export function loadPresentersConfig(): PresentersConfig {
  if (presentersConfigCache) {
    return presentersConfigCache;
  }

  const configPath = getConfigPath("presenters.json");
  const data = readFileSync(configPath, "utf-8");
  presentersConfigCache = JSON.parse(data);
  return presentersConfigCache as PresentersConfig;
}

/**
 * Get a mapping of presenter IDs to their voice IDs
 */
export function getPresenterVoiceMap(): Record<string, string> {
  const config = loadPresentersConfig();
  const voiceMap: Record<string, string> = {};

  for (const presenter of config.presenters) {
    voiceMap[presenter.id] = presenter.voice_id;
  }

  return voiceMap;
}

/**
 * Clear the config cache. Useful for testing.
 */
export function clearConfigCache(): void {
  tagsConfigCache = null;
  stationConfigCache = null;
  presentersConfigCache = null;
}
