/**
 * Show Scheduler Module
 * 
 * Handles show selection based on daily schedule, seasonal overrides,
 * and holiday tags.
 */

import { PrismaClient } from "@prisma/client";
import type { Show, ShowConfig } from "./types";

const prisma = new PrismaClient();

const DAY_MAP: { [key: number]: string } = {
  0: "sun",
  1: "mon",
  2: "tue",
  3: "wed",
  4: "thu",
  5: "fri",
  6: "sat",
};

/**
 * Get the currently active show based on current day and time
 */
export async function getCurrentShow(): Promise<Show | null> {
  try {
    const now = new Date();
    const currentDay = now.getUTCDay(); // 0 = Sunday, 1 = Monday, etc.
    const currentHour = now.getUTCHours();
    const currentMinute = now.getUTCMinutes();
    const currentTimeMinutes = currentHour * 60 + currentMinute;

    const currentDayStr = DAY_MAP[currentDay];

    console.log(
      `Looking for show active on ${currentDayStr} at ${String(currentHour).padStart(2, "0")}:${String(currentMinute).padStart(2, "0")} UTC`
    );

    // Get all shows
    const shows = await prisma.show.findMany();

    // Find the show that matches current time
    for (const show of shows) {
      try {
        const config: ShowConfig = JSON.parse(show.configJson);
        const schedule = config.schedule;

        // Check if current day is in the show's schedule
        if (!schedule.days.includes(currentDayStr)) {
          continue;
        }

        // Parse start and end times (format: "HH:MM")
        const [startHour, startMinute] = schedule.start_time_utc
          .split(":")
          .map(Number);
        const [endHour, endMinute] = schedule.end_time_utc.split(":").map(Number);

        const startTimeMinutes = startHour * 60 + startMinute;
        const endTimeMinutes = endHour * 60 + endMinute;

        // Check if current time is within show time range
        // Handle case where show spans midnight (e.g., 21:00 to 03:00)
        const isInRange =
          endTimeMinutes > startTimeMinutes
            ? currentTimeMinutes >= startTimeMinutes &&
              currentTimeMinutes < endTimeMinutes
            : currentTimeMinutes >= startTimeMinutes ||
              currentTimeMinutes < endTimeMinutes;

        if (isInRange) {
          console.log(
            `Found active show: ${show.name} (${schedule.start_time_utc} - ${schedule.end_time_utc} UTC)`
          );
          return show;
        }
      } catch (error) {
        console.error(`Error parsing config for show ${show.id}:`, error);
      }
    }

    console.log("No show found for current time");
    return null;
  } catch (error) {
    console.error("Error in getCurrentShow:", error);
    throw error;
  }
}

/**
 * Get the next show after the current one
 */
export async function getNextShow(currentShow: Show): Promise<Show | null> {
  try {
    const config: ShowConfig = JSON.parse(currentShow.configJson);
    const schedule = config.schedule;

    // Calculate the end time of the current show
    const [startHour, startMinute] = schedule.start_time_utc
      .split(":")
      .map(Number);
    const startTimeMinutes = startHour * 60 + startMinute;
    const endTimeMinutes = startTimeMinutes + schedule.duration_hours * 60;

    // Get all shows
    const shows = await prisma.show.findMany();

    // Find the show that starts when this one ends
    for (const show of shows) {
      try {
        const nextConfig: ShowConfig = JSON.parse(show.configJson);
        const nextSchedule = nextConfig.schedule;

        // Check if any day overlaps
        const daysOverlap = schedule.days.some((day) =>
          nextSchedule.days.includes(day)
        );
        if (!daysOverlap) {
          continue;
        }

        const [nextStartHour, nextStartMinute] = nextSchedule.start_time_utc
          .split(":")
          .map(Number);
        const nextStartTimeMinutes = nextStartHour * 60 + nextStartMinute;

        // Check if this show starts when current show ends
        // Handle midnight wraparound
        const startsAfterCurrent =
          (nextStartTimeMinutes === endTimeMinutes % (24 * 60)) ||
          (endTimeMinutes >= 24 * 60 && nextStartTimeMinutes === endTimeMinutes - 24 * 60);

        if (startsAfterCurrent) {
          console.log(`Next show: ${show.name}`);
          return show;
        }
      } catch (error) {
        console.error(`Error parsing config for show ${show.id}:`, error);
      }
    }

    console.log("No next show found (wrapping around or gap in schedule)");
    return null;
  } catch (error) {
    console.error("Error in getNextShow:", error);
    throw error;
  }
}

/**
 * Calculate when the current show ends
 */
export function getShowEndTime(show: Show): Date {
  const config: ShowConfig = JSON.parse(show.configJson);
  const schedule = config.schedule;

  const now = new Date();
  const [startHour, startMinute] = schedule.start_time_utc.split(":").map(Number);

  // Calculate today's show start time
  const todayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    startHour,
    startMinute,
    0
  ));

  // If show already started today, use that; otherwise, it started yesterday
  if (todayStart > now) {
    todayStart.setUTCDate(todayStart.getUTCDate() - 1);
  }

  // Add duration to get end time
  const endTime = new Date(todayStart);
  endTime.setUTCHours(endTime.getUTCHours() + schedule.duration_hours);

  return endTime;
}

/**
 * Check if we're near a show transition (within specified minutes)
 */
export function isNearShowTransition(show: Show, minutesThreshold: number = 10): boolean {
  const endTime = getShowEndTime(show);
  const now = new Date();
  const minutesUntilEnd = (endTime.getTime() - now.getTime()) / (1000 * 60);

  return minutesUntilEnd > 0 && minutesUntilEnd <= minutesThreshold;
}

/**
 * Get seasonal context for content generation
 */
export function getSeasonalContext(date: Date = new Date()): {
  season: string;
  month: number;
  isHoliday: boolean;
  holidayName?: string;
} {
  const month = date.getUTCMonth() + 1; // 1-12

  let season = "spring";
  if ([12, 1, 2].includes(month)) season = "winter";
  else if ([3, 4, 5].includes(month)) season = "spring";
  else if ([6, 7, 8].includes(month)) season = "summer";
  else if ([9, 10, 11].includes(month)) season = "autumn";

  // Simple holiday detection (can be extended)
  const day = date.getUTCDate();
  let isHoliday = false;
  let holidayName: string | undefined;

  if (month === 12 && day >= 24 && day <= 26) {
    isHoliday = true;
    holidayName = "Christmas";
  } else if (month === 1 && day === 1) {
    isHoliday = true;
    holidayName = "New Year";
  } else if (month === 10 && day === 31) {
    isHoliday = true;
    holidayName = "Halloween";
  }

  return { season, month, isHoliday, holidayName };
}

export { prisma };
