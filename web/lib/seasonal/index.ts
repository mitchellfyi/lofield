/**
 * Seasonal and Holiday Logic Module
 * 
 * This module provides comprehensive seasonal and holiday detection
 * for context-aware content generation in Lofield FM.
 * 
 * @module seasonal
 */

// Core seasonal logic
export {
  getSeason,
  getSeasonalMoodProfile,
  getHolidaysForDate,
  getHolidaysInRange,
  isHoliday,
  getSeasonalTags,
  getContextTags,
  getSeasonalMusicMood,
  applySeasonalBiasToMusicPrompt,
  getHolidayScriptGuidance,
  type Season,
  type Hemisphere,
  type SeasonalMoodProfile,
  type HolidayInfo,
} from "../seasonal";

// AI Integration helpers
export {
  enhanceMusicRequestWithSeason,
  enhanceScriptRequestWithSeason,
  getContentContextTags,
  getShowSeasonOverrides,
  getShowHolidayOverrides,
  type SeasonalIntegrationConfig,
} from "../seasonal-integration";
