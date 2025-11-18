/**
 * Seasonal and Holiday Logic
 *
 * Provides functions for detecting the current season and relevant holidays,
 * enabling context-aware content generation for Lofield FM.
 */

import { loadTagsConfig } from "./config-loader";

/**
 * Season type definition
 */
export type Season = "winter" | "spring" | "summer" | "autumn";

/**
 * Hemisphere type definition
 */
export type Hemisphere = "northern" | "southern";

/**
 * Seasonal mood descriptors for music generation
 */
export interface SeasonalMoodProfile {
  season: Season;
  descriptors: string[];
  musicMood: string[];
  topicBias: string[];
}

/**
 * Holiday information
 */
export interface HolidayInfo {
  date: string; // ISO date format (YYYY-MM-DD)
  tags: string[];
}

/**
 * Seasonal mood profiles mapping seasons to mood descriptors
 */
const SEASONAL_MOOD_PROFILES: Record<Season, SeasonalMoodProfile> = {
  winter: {
    season: "winter",
    descriptors: ["cosy", "muted", "warm", "introspective", "gentle"],
    musicMood: [
      "warm and comforting",
      "soft ambient textures",
      "cosy winter atmosphere",
      "muted and reflective",
      "gentle winter ambience",
    ],
    topicBias: [
      "dark mornings",
      "cold weather",
      "heating decisions",
      "cosy indoors",
      "winter blues",
    ],
  },
  spring: {
    season: "spring",
    descriptors: ["fresh", "hopeful", "light", "renewed", "gentle"],
    musicMood: [
      "light and refreshing",
      "hopeful spring atmosphere",
      "gentle renewal vibes",
      "fresh and airy",
      "soft spring awakening",
    ],
    topicBias: [
      "lighter evenings",
      "spring cleaning",
      "renewal",
      "spring weather",
    ],
  },
  summer: {
    season: "summer",
    descriptors: ["bright", "breezy", "relaxed", "airy", "open"],
    musicMood: [
      "bright and breezy",
      "relaxed summer vibes",
      "airy and open",
      "warm summer atmosphere",
      "light and easy",
    ],
    topicBias: [
      "long evenings",
      "outdoor work",
      "sunshine",
      "summer weather",
      "holiday time",
    ],
  },
  autumn: {
    season: "autumn",
    descriptors: ["mellow", "reflective", "warm", "contemplative", "rich"],
    musicMood: [
      "mellow autumn tones",
      "reflective and contemplative",
      "warm earthy atmosphere",
      "rich autumnal vibes",
      "gentle transitions",
    ],
    topicBias: [
      "darker evenings",
      "back to school energy",
      "cozy indoors",
      "falling leaves",
      "autumn weather",
    ],
  },
};

/**
 * Determine the season based on month and hemisphere
 *
 * @param date - The date to check (defaults to current date)
 * @param hemisphere - Northern or Southern hemisphere (defaults to Northern for Lofield)
 * @returns The current season
 */
export function getSeason(
  date: Date = new Date(),
  hemisphere: Hemisphere = "northern"
): Season {
  const month = date.getMonth(); // 0-indexed (0 = January, 11 = December)

  // Northern Hemisphere seasons
  // Winter: December (11), January (0), February (1)
  // Spring: March (2), April (3), May (4)
  // Summer: June (5), July (6), August (7)
  // Autumn: September (8), October (9), November (10)

  if (hemisphere === "northern") {
    if (month === 11 || month === 0 || month === 1) {
      return "winter";
    } else if (month >= 2 && month <= 4) {
      return "spring";
    } else if (month >= 5 && month <= 7) {
      return "summer";
    } else {
      return "autumn"; // months 8-10
    }
  } else {
    // Southern Hemisphere (seasons are opposite)
    if (month === 11 || month === 0 || month === 1) {
      return "summer";
    } else if (month >= 2 && month <= 4) {
      return "autumn";
    } else if (month >= 5 && month <= 7) {
      return "winter";
    } else {
      return "spring"; // months 8-10
    }
  }
}

/**
 * Get seasonal mood profile for the current season
 *
 * @param date - The date to check (defaults to current date)
 * @param hemisphere - Northern or Southern hemisphere (defaults to Northern)
 * @returns Seasonal mood profile with descriptors and biases
 */
export function getSeasonalMoodProfile(
  date: Date = new Date(),
  hemisphere: Hemisphere = "northern"
): SeasonalMoodProfile {
  const season = getSeason(date, hemisphere);
  return SEASONAL_MOOD_PROFILES[season];
}

/**
 * Get holidays for a specific date from configuration
 *
 * @param date - The date to check (defaults to current date)
 * @returns Array of holiday tags for the given date
 */
export function getHolidaysForDate(date: Date = new Date()): string[] {
  const config = loadTagsConfig();
  const dateString = formatDateISO(date);

  return config.holiday_tags[dateString] || [];
}

/**
 * Get all holidays within a date range
 *
 * @param startDate - Start of the date range
 * @param endDate - End of the date range
 * @returns Array of holiday information objects
 */
export function getHolidaysInRange(
  startDate: Date,
  endDate: Date
): HolidayInfo[] {
  const config = loadTagsConfig();
  const holidays: HolidayInfo[] = [];

  for (const [dateString, tags] of Object.entries(config.holiday_tags)) {
    const holidayDate = new Date(dateString);
    if (holidayDate >= startDate && holidayDate <= endDate) {
      holidays.push({ date: dateString, tags });
    }
  }

  return holidays.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Check if a given date is a holiday
 *
 * @param date - The date to check
 * @returns True if the date has associated holiday tags
 */
export function isHoliday(date: Date = new Date()): boolean {
  const holidays = getHolidaysForDate(date);
  return holidays.length > 0;
}

/**
 * Get seasonal tags from configuration
 *
 * @param season - The season to get tags for
 * @returns Array of seasonal topic tags
 */
export function getSeasonalTags(season: Season): string[] {
  const config = loadTagsConfig();
  return config.seasonal_tags[season] || [];
}

/**
 * Get all relevant context tags for a given date
 * Combines seasonal tags and holiday tags
 *
 * @param date - The date to get context for (defaults to current date)
 * @param hemisphere - Northern or Southern hemisphere (defaults to Northern)
 * @returns Combined array of seasonal and holiday tags
 */
export function getContextTags(
  date: Date = new Date(),
  hemisphere: Hemisphere = "northern"
): string[] {
  const season = getSeason(date, hemisphere);
  const seasonalTags = getSeasonalTags(season);
  const holidayTags = getHolidaysForDate(date);

  // Combine and deduplicate
  return [...new Set([...seasonalTags, ...holidayTags])];
}

/**
 * Format a date as ISO date string (YYYY-MM-DD)
 *
 * @param date - The date to format
 * @returns ISO date string
 */
function formatDateISO(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get a seasonal music mood descriptor
 * Returns a deterministic descriptor based on the day of year
 * This ensures consistency across multiple calls for the same date
 *
 * @param date - The date to check (defaults to current date)
 * @param hemisphere - Northern or Southern hemisphere (defaults to Northern)
 * @returns A mood descriptor string suitable for music generation
 */
export function getSeasonalMusicMood(
  date: Date = new Date(),
  hemisphere: Hemisphere = "northern"
): string {
  const profile = getSeasonalMoodProfile(date, hemisphere);

  // Calculate day of year for deterministic selection
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  const oneDay = 1000 * 60 * 60 * 24;
  const dayOfYear = Math.floor(diff / oneDay);

  // Use day of year to select a consistent mood descriptor
  const index = dayOfYear % profile.musicMood.length;
  return profile.musicMood[index];
}

/**
 * Apply seasonal bias to a music prompt
 * Enhances the prompt with seasonal mood descriptors using natural phrasing
 *
 * @param basePrompt - The original music prompt
 * @param date - The date to check (defaults to current date)
 * @param hemisphere - Northern or Southern hemisphere (defaults to Northern)
 * @returns Enhanced prompt with seasonal bias
 */
export function applySeasonalBiasToMusicPrompt(
  basePrompt: string,
  date: Date = new Date(),
  hemisphere: Hemisphere = "northern"
): string {
  const seasonalMood = getSeasonalMusicMood(date, hemisphere);
  return `${basePrompt}, with a ${seasonalMood}`;
}

/**
 * Generate understated holiday script guidance for presenters
 * Provides example lines that align with Lofield FM's dry, self-aware tone
 *
 * @param date - The date to check for holidays (defaults to current date)
 * @returns Holiday script guidance with examples, or null if no holiday
 */
export function getHolidayScriptGuidance(date: Date = new Date()): {
  holidayTags: string[];
  guidance: string;
  exampleLines: string[];
} | null {
  const holidayTags = getHolidaysForDate(date);

  if (holidayTags.length === 0) {
    return null;
  }

  // Generate understated, dry guidance based on the holiday
  const guidance =
    "Reference the holiday with restraint and dry wit. Acknowledge it matter-of-factly without forced cheerfulness. Focus on relatable remote work experiences during holidays.";

  // Example lines for common holidays (dry, understated, Lofield FM style)
  const exampleLines: string[] = [];

  for (const tag of holidayTags) {
    switch (tag) {
      case "new_year":
        exampleLines.push("New year, same video calls.");
        exampleLines.push("January 1st. The emails are still there.");
        break;
      case "christmas_day":
      case "christmas_eve":
        exampleLines.push("Christmas. Some of us are still online.");
        exampleLines.push(
          "Festive period. Your Slack status says 'away,' but we know better."
        );
        break;
      case "halloween":
        exampleLines.push("Halloween. The scariest thing today is your inbox.");
        exampleLines.push(
          "October 31st. Nothing quite as terrifying as a surprise meeting invite."
        );
        break;
      case "bonfire_night":
        exampleLines.push(
          "Bonfire Night. Remember, remember... that deadline in November."
        );
        exampleLines.push(
          "Guy Fawkes Night. Fireworks outside, deadlines inside."
        );
        break;
      case "valentines_day":
        exampleLines.push(
          "Valentine's Day. You, your laptop, and a questionable Wi-Fi connection."
        );
        exampleLines.push(
          "February 14th. Love is in the air. Deadline pressure is in the calendar."
        );
        break;
      case "easter":
      case "easter_monday":
        exampleLines.push(
          "Easter Monday. Bank holiday for some, another Monday for others."
        );
        exampleLines.push(
          "Easter. The only thing rising is your unread count."
        );
        break;
      default:
        // Generic understated holiday reference
        exampleLines.push(`${tag.replace(/_/g, " ")} today. Work continues.`);
    }
  }

  return {
    holidayTags,
    guidance,
    exampleLines,
  };
}
