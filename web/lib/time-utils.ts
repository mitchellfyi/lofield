/**
 * Time utilities for formatting and displaying times in local timezone.
 * All times in the system are stored in UTC and converted to local time for display.
 */

/**
 * Format a UTC time string (HH:MM format) to local time.
 * @param utcTime - Time in HH:MM format (UTC)
 * @param includeTimezone - Whether to include timezone abbreviation
 * @returns Formatted local time string
 */
export function formatUTCTimeToLocal(
  utcTime: string,
  includeTimezone = false
): string {
  // Use a fixed reference date to avoid prerender issues
  // The actual date doesn't matter since we only care about time conversion
  const [hours, minutes] = utcTime.split(":").map(Number);

  const utcDate = new Date(Date.UTC(2024, 0, 1, hours, minutes));

  const timeString = utcDate.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });

  if (includeTimezone) {
    const timezone = new Intl.DateTimeFormat(undefined, {
      timeZoneName: "short",
    })
      .formatToParts(utcDate)
      .find((part) => part.type === "timeZoneName")?.value;
    return `${timeString} ${timezone}`;
  }

  return timeString;
}

/**
 * Format a date-time string to local date and time.
 * @param dateTime - ISO 8601 date-time string
 * @param options - Formatting options
 * @returns Formatted local date-time string
 */
export function formatDateTimeToLocal(
  dateTime: string,
  options?: {
    dateStyle?: "short" | "medium" | "long" | "full";
    timeStyle?: "short" | "medium" | "long" | "full";
  }
): string {
  const date = new Date(dateTime);
  return date.toLocaleString(undefined, {
    dateStyle: options?.dateStyle || "medium",
    timeStyle: options?.timeStyle || "short",
  });
}

/**
 * Format a duration in seconds to a readable string.
 * @param seconds - Duration in seconds
 * @returns Formatted duration string (e.g., "3 min 30 s" or "3.5 min")
 */
export function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  if (remainingSeconds === 0) {
    return `${minutes} min`;
  }

  if (remainingSeconds < 10) {
    // If less than 10 seconds, show as decimal
    return `${(seconds / 60).toFixed(1)} min`;
  }

  return `${minutes} min ${remainingSeconds} s`;
}
