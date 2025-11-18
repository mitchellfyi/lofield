/**
 * Queue Builder Module
 * 
 * Handles building segment queues with proper talk/music ratio enforcement.
 */

import type { Show, ShowConfig, QueuedSegment } from "./types";
import { getShowConfig } from "./show-manager";

export interface QueueStats {
  totalDurationMinutes: number;
  musicDurationMinutes: number;
  talkDurationMinutes: number;
  musicFraction: number;
  talkFraction: number;
  segmentCounts: {
    music: number;
    talk: number;
    ident: number;
    handover: number;
  };
}

/**
 * Calculate statistics for a queue of segments
 */
export function calculateQueueStats(segments: QueuedSegment[]): QueueStats {
  let totalDuration = 0;
  let musicDuration = 0;
  let talkDuration = 0;
  
  const counts = {
    music: 0,
    talk: 0,
    ident: 0,
    handover: 0,
  };

  for (const segment of segments) {
    const duration = (segment.endTime.getTime() - segment.startTime.getTime()) / 1000;
    totalDuration += duration;

    if (segment.type === "music") {
      musicDuration += duration;
      counts.music++;
    } else if (segment.type === "talk") {
      talkDuration += duration;
      counts.talk++;
    } else if (segment.type === "ident") {
      talkDuration += duration; // Idents count as talk
      counts.ident++;
    } else if (segment.type === "handover") {
      talkDuration += duration; // Handovers count as talk
      counts.handover++;
    }
  }

  const totalMinutes = totalDuration / 60;
  const musicMinutes = musicDuration / 60;
  const talkMinutes = talkDuration / 60;

  return {
    totalDurationMinutes: totalMinutes,
    musicDurationMinutes: musicMinutes,
    talkDurationMinutes: talkMinutes,
    musicFraction: totalDuration > 0 ? musicDuration / totalDuration : 0,
    talkFraction: totalDuration > 0 ? talkDuration / totalDuration : 0,
    segmentCounts: counts,
  };
}

/**
 * Check if queue meets the show's talk/music ratio requirements
 */
export async function validateQueueRatios(
  segments: QueuedSegment[],
  show: Show
): Promise<{ valid: boolean; stats: QueueStats; message?: string }> {
  const showConfig = await getShowConfig(show.id);
  if (!showConfig) {
    return {
      valid: false,
      stats: calculateQueueStats(segments),
      message: "Show config not found",
    };
  }

  const stats = calculateQueueStats(segments);

  // Check music doesn't exceed maximum (60%)
  if (stats.musicFraction > showConfig.ratios.music_fraction + 0.05) {
    return {
      valid: false,
      stats,
      message: `Music fraction ${stats.musicFraction.toFixed(2)} exceeds target ${showConfig.ratios.music_fraction.toFixed(2)}`,
    };
  }

  // Check talk meets minimum (40%)
  if (stats.talkFraction < showConfig.ratios.talk_fraction - 0.05) {
    return {
      valid: false,
      stats,
      message: `Talk fraction ${stats.talkFraction.toFixed(2)} below target ${showConfig.ratios.talk_fraction.toFixed(2)}`,
    };
  }

  return { valid: true, stats };
}

/**
 * Determine what type of segment should be generated next
 * to maintain proper ratios over the hour
 */
export async function determineNextSegmentType(
  currentQueue: QueuedSegment[],
  show: Show,
  hoursSinceShowStart: number = 0
): Promise<"music" | "talk" | "balanced"> {
  const showConfig = await getShowConfig(show.id);
  if (!showConfig) {
    return "balanced";
  }

  const stats = calculateQueueStats(currentQueue);

  // Calculate target ratios for this point in the show
  const targetMusicFraction = showConfig.ratios.music_fraction;
  const targetTalkFraction = showConfig.ratios.talk_fraction;

  // If we're significantly below music target, generate music
  if (stats.musicFraction < targetMusicFraction - 0.10) {
    return "music";
  }

  // If we're significantly below talk target, generate talk
  if (stats.talkFraction < targetTalkFraction - 0.10) {
    return "talk";
  }

  // If we're within acceptable range, prefer balanced approach
  // with slight bias based on current ratios
  const musicDeficit = targetMusicFraction - stats.musicFraction;
  const talkDeficit = targetTalkFraction - stats.talkFraction;

  if (musicDeficit > talkDeficit) {
    return "music";
  } else if (talkDeficit > musicDeficit) {
    return "talk";
  }

  return "balanced";
}

/**
 * Calculate how many more segments of each type are needed
 * to fill a target duration while maintaining ratios
 */
export async function calculateSegmentNeeds(
  currentQueue: QueuedSegment[],
  show: Show,
  targetDurationMinutes: number,
  averageMusicDuration: number = 180, // 3 minutes
  averageTalkDuration: number = 30 // 30 seconds
): Promise<{
  musicSegmentsNeeded: number;
  talkSegmentsNeeded: number;
  totalDurationNeeded: number;
}> {
  const showConfig = await getShowConfig(show.id);
  if (!showConfig) {
    return {
      musicSegmentsNeeded: 0,
      talkSegmentsNeeded: 0,
      totalDurationNeeded: 0,
    };
  }

  const stats = calculateQueueStats(currentQueue);
  const currentDurationSeconds = stats.totalDurationMinutes * 60;
  const targetDurationSeconds = targetDurationMinutes * 60;
  const remainingDurationSeconds = targetDurationSeconds - currentDurationSeconds;

  if (remainingDurationSeconds <= 0) {
    return {
      musicSegmentsNeeded: 0,
      talkSegmentsNeeded: 0,
      totalDurationNeeded: 0,
    };
  }

  // Calculate target music and talk seconds for the remaining duration
  const targetMusicSeconds = remainingDurationSeconds * showConfig.ratios.music_fraction;
  const targetTalkSeconds = remainingDurationSeconds * showConfig.ratios.talk_fraction;

  // Calculate how many segments we need
  const musicSegmentsNeeded = Math.ceil(targetMusicSeconds / averageMusicDuration);
  const talkSegmentsNeeded = Math.ceil(targetTalkSeconds / averageTalkDuration);

  return {
    musicSegmentsNeeded,
    talkSegmentsNeeded,
    totalDurationNeeded: remainingDurationSeconds,
  };
}

/**
 * Get the minimum gap duration between presenter links from show config
 */
export async function getMinGapBetweenLinks(show: Show): Promise<number> {
  const showConfig = await getShowConfig(show.id);
  if (!showConfig) {
    return 180; // Default 3 minutes
  }
  return showConfig.timing.min_gap_between_links_seconds;
}

/**
 * Check if enough time has passed since last talk segment
 */
export async function canAddTalkSegment(
  currentQueue: QueuedSegment[],
  show: Show
): Promise<boolean> {
  const minGap = await getMinGapBetweenLinks(show);
  
  // Find the last talk segment
  let lastTalkEndTime: Date | null = null;
  for (let i = currentQueue.length - 1; i >= 0; i--) {
    if (currentQueue[i].type === "talk" || currentQueue[i].type === "ident") {
      lastTalkEndTime = currentQueue[i].endTime;
      break;
    }
  }

  if (!lastTalkEndTime) {
    return true; // No talk segments yet, can add
  }

  // Check if enough time has passed
  const now = new Date();
  const timeSinceLastTalk = (now.getTime() - lastTalkEndTime.getTime()) / 1000;
  
  return timeSinceLastTalk >= minGap;
}

/**
 * Generate a summary of queue status for logging
 */
export function formatQueueSummary(stats: QueueStats): string {
  return [
    `Queue: ${stats.totalDurationMinutes.toFixed(1)} min total`,
    `Music: ${stats.musicDurationMinutes.toFixed(1)} min (${(stats.musicFraction * 100).toFixed(1)}%)`,
    `Talk: ${stats.talkDurationMinutes.toFixed(1)} min (${(stats.talkFraction * 100).toFixed(1)}%)`,
    `Segments: ${stats.segmentCounts.music}M ${stats.segmentCounts.talk}T ${stats.segmentCounts.ident}I ${stats.segmentCounts.handover}H`,
  ].join(" | ");
}
