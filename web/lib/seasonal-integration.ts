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
import type { MusicGenerationRequest, ScriptGenerationRequest } from "./ai/types";

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
  const {
    hemisphere = "northern",
    date = new Date(),
  } = config;

  return getContextTags(date, hemisphere);
}

/**
 * Check if show-specific season overrides should be applied
 * This helper function checks if there are season overrides in the show config
 * and applies them to the topic and tone adjustments
 * 
 * @param showConfig - The show configuration object (from config/shows/*.json)
 * @param config - Seasonal integration configuration
 * @returns Object with additional topics and tone adjustment (if applicable)
 */
export function getShowSeasonOverrides(
  showConfig: {
    season_overrides?: Record<string, {
      tone_adjustment?: string;
      additional_topics?: string[];
    }>;
  },
  config: SeasonalIntegrationConfig = {}
): {
  additionalTopics: string[];
  toneAdjustment?: string;
} {
  const {
    hemisphere = "northern",
    date = new Date(),
  } = config;

  const season = getSeason(date, hemisphere);
  const overrides = showConfig.season_overrides?.[season];

  if (!overrides) {
    return { additionalTopics: [] };
  }

  return {
    additionalTopics: overrides.additional_topics || [],
    toneAdjustment: overrides.tone_adjustment,
  };
}

/**
 * Check if show-specific holiday overrides should be applied
 * 
 * @param showConfig - The show configuration object
 * @param config - Seasonal integration configuration
 * @returns Holiday override information (if applicable)
 */
export function getShowHolidayOverrides(
  showConfig: {
    holiday_overrides?: Record<string, {
      dates?: string[];
      tone_adjustment?: string;
      sample_line?: string;
      notes?: string;
    }>;
  },
  config: SeasonalIntegrationConfig = {}
): {
  toneAdjustment?: string;
  sampleLine?: string;
  notes?: string;
} | null {
  const { date = new Date() } = config;

  if (!showConfig.holiday_overrides) {
    return null;
  }

  // Format current date as YYYY-MM-DD
  const dateString = date.toISOString().split("T")[0];

  // Find matching holiday override
  for (const override of Object.values(showConfig.holiday_overrides)) {
    if (override.dates && override.dates.includes(dateString)) {
      return {
        toneAdjustment: override.tone_adjustment,
        sampleLine: override.sample_line,
        notes: override.notes,
      };
    }
  }

  return null;
}
