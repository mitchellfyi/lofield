import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import type { Show, Presenter, ScheduleSlot } from "./types";

let showsCache: Show[] | null = null;

/**
 * Get the path to the config directory.
 */
function getConfigPath(filename: string): string {
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

  return join(process.cwd(), "..", "config", filename);
}

/**
 * Get the path to the shows directory.
 */
function getShowsDirectory(): string {
  const possiblePaths = [
    join(process.cwd(), "..", "config", "shows"),
    join(process.cwd(), "config", "shows"),
  ];

  for (const path of possiblePaths) {
    try {
      readdirSync(path);
      return path;
    } catch {
      continue;
    }
  }

  return join(process.cwd(), "..", "config", "shows");
}

/**
 * Load all shows from the config/shows directory.
 */
export function loadShows(): Show[] {
  if (showsCache) {
    return showsCache;
  }

  const showsDir = getShowsDirectory();
  const files = readdirSync(showsDir).filter((f) => f.endsWith(".json"));

  const shows: Show[] = [];
  for (const file of files) {
    const filePath = join(showsDir, file);
    const content = readFileSync(filePath, "utf-8");
    const showData = JSON.parse(content);
    shows.push({
      ...showData,
      id: showData.id || file.replace(".json", ""),
    });
  }

  // Sort shows by start time
  shows.sort((a, b) => {
    const timeA = a.schedule.start_time_utc;
    const timeB = b.schedule.start_time_utc;
    return timeA.localeCompare(timeB);
  });

  showsCache = shows;
  return shows;
}

/**
 * Get a show by its ID.
 */
export function getShowById(id: string): Show | null {
  const shows = loadShows();
  return shows.find((show) => show.id === id) || null;
}

/**
 * Load presenters from config/presenters.json.
 */
export function loadPresenters(): Presenter[] {
  const configPath = getConfigPath("presenters.json");
  const content = readFileSync(configPath, "utf-8");
  const data = JSON.parse(content);
  return data.presenters;
}

/**
 * Get presenters for a specific show.
 */
export function getPresentersForShow(show: Show): Presenter[] {
  const allPresenters = loadPresenters();
  const presenterIds = show.presenters.primary_duo;
  return allPresenters.filter((p) => presenterIds.includes(p.id));
}

/**
 * Generate a weekly schedule with shows for each day.
 * Returns an array of 7 days (Mon-Sun), each containing the shows for that day.
 */
export function generateWeeklySchedule(): ScheduleSlot[][] {
  const shows = loadShows();
  const weekSchedule: ScheduleSlot[][] = Array.from({ length: 7 }, () => []);
  const dayMap: Record<string, number> = {
    mon: 0,
    tue: 1,
    wed: 2,
    thu: 3,
    fri: 4,
    sat: 5,
    sun: 6,
  };

  for (const show of shows) {
    for (const day of show.schedule.days) {
      const dayIndex = dayMap[day.toLowerCase()];
      if (dayIndex !== undefined) {
        weekSchedule[dayIndex].push({
          show,
          startTime: show.schedule.start_time_utc,
          endTime: show.schedule.end_time_utc,
          dayOfWeek: dayIndex,
        });
      }
    }
  }

  // Sort each day's shows by start time
  for (const daySlots of weekSchedule) {
    daySlots.sort((a, b) => a.startTime.localeCompare(b.startTime));
  }

  return weekSchedule;
}

/**
 * Get the currently playing show based on UTC time.
 */
export function getCurrentShow(now = new Date()): Show | null {
  const shows = loadShows();
  const currentTime = `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  const dayIndex = (now.getUTCDay() + 6) % 7; // Convert Sunday=0 to Monday=0
  const dayNames = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  const currentDay = dayNames[dayIndex];

  for (const show of shows) {
    if (!show.schedule.days.includes(currentDay)) {
      continue;
    }

    const startTime = show.schedule.start_time_utc;
    const endTime = show.schedule.end_time_utc;

    // Handle shows that cross midnight
    if (endTime < startTime) {
      if (currentTime >= startTime || currentTime < endTime) {
        return show;
      }
    } else {
      if (currentTime >= startTime && currentTime < endTime) {
        return show;
      }
    }
  }

  return null;
}

/**
 * Clear the shows cache. Useful for testing.
 */
export function clearShowsCache(): void {
  showsCache = null;
}
