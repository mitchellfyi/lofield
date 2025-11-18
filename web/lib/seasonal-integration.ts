/**
 * AI Integration Helpers for Seasonal and Holiday Logic
 *
 * This module provides helper functions that integrate seasonal and holiday
 * detection with the AI music and script generation modules.
 */

import {
  getSeason,
  getHolidaysForDate,
  getSeasonalMusicMood,
  getContextTags,
  type Hemisphere,
} from "./seasonal";
import type {
  MusicGenerationRequest,
  ScriptGenerationRequest,
} from "./ai/types";

/**
 * Deep merge utility for arrays and objects
 * Arrays are concatenated and deduplicated
 * Objects are deeply merged
 *
 * @param target - Target object to merge into
 * @param source - Source object to merge from
 * @returns Merged object
 */
function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Partial<T>
): T {
  const result = { ...target };

  for (const key in source) {
    if (Object.prototype.hasOwnProperty.call(source, key)) {
      const sourceValue = source[key];
      const targetValue = result[key];

      if (Array.isArray(sourceValue) && Array.isArray(targetValue)) {
        // Concatenate and deduplicate arrays
        result[key] = [
          ...new Set([...targetValue, ...sourceValue]),
        ] as T[Extract<keyof T, string>];
      } else if (
        sourceValue &&
        typeof sourceValue === "object" &&
        !Array.isArray(sourceValue) &&
        targetValue &&
        typeof targetValue === "object" &&
        !Array.isArray(targetValue)
      ) {
        // Recursively merge objects
        result[key] = deepMerge(
          targetValue as Record<string, unknown>,
          sourceValue as Record<string, unknown>
        ) as T[Extract<keyof T, string>];
      } else if (sourceValue !== undefined) {
        // For primitive values or null, use source value
        result[key] = sourceValue as T[Extract<keyof T, string>];
      }
    }
  }

  return result;
}

/**
 * Configuration for seasonal integration
 */
export interface SeasonalIntegrationConfig {
  hemisphere?: Hemisphere;
  date?: Date;
  enableSeasonalBias?: boolean;
  enableHolidayTags?: boolean;
}

/**
 * Enhance a music generation request with seasonal context
 *
 * @param request - Base music generation request
 * @param config - Seasonal integration configuration
 * @returns Enhanced music generation request with seasonal bias
 */
export function enhanceMusicRequestWithSeason(
  request: MusicGenerationRequest,
  config: SeasonalIntegrationConfig = {}
): MusicGenerationRequest {
  const {
    hemisphere = "northern",
    date = new Date(),
    enableSeasonalBias = true,
  } = config;

  if (!enableSeasonalBias) {
    return request;
  }

  // Get seasonal music mood
  const seasonalMood = getSeasonalMusicMood(date, hemisphere);

  // Add seasonal bias to the request
  return {
    ...request,
    seasonalBias: seasonalMood,
  };
}

/**
 * Enhance a script generation request with seasonal and holiday context
 *
 * @param request - Base script generation request
 * @param config - Seasonal integration configuration
 * @returns Enhanced script generation request with seasonal and holiday context
 */
export function enhanceScriptRequestWithSeason(
  request: ScriptGenerationRequest,
  config: SeasonalIntegrationConfig = {}
): ScriptGenerationRequest {
  const {
    hemisphere = "northern",
    date = new Date(),
    enableHolidayTags = true,
  } = config;

  // Get current season
  const season = getSeason(date, hemisphere);

  // Get holiday tags if enabled
  const holidayTags = enableHolidayTags ? getHolidaysForDate(date) : [];

  // Merge with existing context info
  const contextInfo = {
    ...request.contextInfo,
    season,
    holidayTags: holidayTags.length > 0 ? holidayTags : undefined,
  };

  return {
    ...request,
    contextInfo,
  };
}

/**
 * Get all context tags for content generation
 * This combines seasonal tags and holiday tags for use in topic selection
 *
 * @param config - Seasonal integration configuration
 * @returns Array of context tags
 */
export function getContentContextTags(
  config: SeasonalIntegrationConfig = {}
): string[] {
  const { hemisphere = "northern", date = new Date() } = config;

  return getContextTags(date, hemisphere);
}

/**
 * Apply show-specific season overrides to the base configuration
 * This helper function checks if there are season overrides in the show config
 * and merges them with the base configuration (arrays are concatenated, objects are merged)
 *
 * @param showConfig - The show configuration object (from config/shows/*.json)
 * @param config - Seasonal integration configuration
 * @returns Merged show configuration with season overrides applied
 */
export function getShowSeasonOverrides<
  T extends {
    primary_tags?: string[];
    tone?: string;
    commentary_style?: Record<string, unknown>;
    [key: string]: unknown;
  },
>(
  showConfig: T & {
    season_overrides?: Record<
      string,
      {
        tone_adjustment?: string;
        additional_topics?: string[];
        [key: string]: unknown;
      }
    >;
  },
  config: SeasonalIntegrationConfig = {}
): T {
  const { hemisphere = "northern", date = new Date() } = config;

  const season = getSeason(date, hemisphere);
  const overrides = showConfig.season_overrides?.[season];

  if (!overrides) {
    return showConfig;
  }

  // Build override object for merging
  const overrideConfig: Partial<T> = {};

  // Map additional_topics to primary_tags
  if (overrides.additional_topics) {
    overrideConfig.primary_tags =
      overrides.additional_topics as T["primary_tags"];
  }

  // Map tone_adjustment to tone
  if (overrides.tone_adjustment) {
    overrideConfig.tone = overrides.tone_adjustment as T["tone"];
  }

  // Include any other override properties
  for (const key in overrides) {
    if (key !== "additional_topics" && key !== "tone_adjustment") {
      (overrideConfig as Record<string, unknown>)[key] = overrides[key];
    }
  }

  // Deep merge the configurations
  return deepMerge(showConfig, overrideConfig);
}

/**
 * Apply show-specific holiday overrides to the base configuration
 * This helper function merges holiday overrides with the base show configuration
 *
 * @param showConfig - The show configuration object
 * @param config - Seasonal integration configuration
 * @returns Merged show configuration with holiday overrides applied, or original config if no match
 */
export function getShowHolidayOverrides<
  T extends {
    tone?: string;
    commentary_style?: Record<string, unknown>;
    [key: string]: unknown;
  },
>(
  showConfig: T & {
    holiday_overrides?: Record<
      string,
      {
        dates?: string[];
        tone_adjustment?: string;
        sample_line?: string;
        notes?: string;
        [key: string]: unknown;
      }
    >;
  },
  config: SeasonalIntegrationConfig = {}
): T {
  const { date = new Date() } = config;

  if (!showConfig.holiday_overrides) {
    return showConfig;
  }

  // Format current date as YYYY-MM-DD
  const dateString = date.toISOString().split("T")[0];

  // Find matching holiday override
  for (const override of Object.values(showConfig.holiday_overrides)) {
    if (override.dates && override.dates.includes(dateString)) {
      // Build override object for merging
      const overrideConfig: Partial<T> = {};

      // Map tone_adjustment to tone
      if (override.tone_adjustment) {
        overrideConfig.tone = override.tone_adjustment as T["tone"];
      }

      // Add sample_line to commentary_style if present
      if (override.sample_line) {
        overrideConfig.commentary_style = {
          sample_holiday_line: override.sample_line,
        } as T["commentary_style"];
      }

      // Include notes and any other override properties
      for (const key in override) {
        if (
          key !== "dates" &&
          key !== "tone_adjustment" &&
          key !== "sample_line"
        ) {
          (overrideConfig as Record<string, unknown>)[key] = override[key];
        }
      }

      // Deep merge the configurations
      return deepMerge(showConfig, overrideConfig);
    }
  }

  return showConfig;
}
