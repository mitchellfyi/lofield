/**
 * Real-time Updates Module
 *
 * Publishes "now playing" metadata, upcoming segments, and request info
 * for live display and voting on the frontend.
 */

import { EventEmitter } from "events";
import type { NowPlayingMetadata, QueuedSegment } from "./types";

// Event emitter for broadcasting updates
export const broadcastEmitter = new EventEmitter();

// Event types
export enum BroadcastEvent {
  NOW_PLAYING = "now_playing",
  QUEUE_UPDATE = "queue_update",
  REQUEST_PLAYED = "request_played",
  SHOW_CHANGE = "show_change",
}

/**
 * Publish now playing metadata
 */
export function publishNowPlaying(metadata: NowPlayingMetadata): void {
  broadcastEmitter.emit(BroadcastEvent.NOW_PLAYING, metadata);
  console.log(
    `[BROADCAST] Now playing: ${metadata.showName} - ${metadata.type}`
  );
}

/**
 * Publish queue update
 */
export function publishQueueUpdate(upcomingSegments: QueuedSegment[]): void {
  const summary = upcomingSegments.slice(0, 5).map((seg) => ({
    id: seg.id,
    type: seg.type,
    startTime: seg.startTime.toISOString(),
    trackId: seg.trackId,
    requestId: seg.requestId,
  }));

  broadcastEmitter.emit(BroadcastEvent.QUEUE_UPDATE, summary);
  console.log(
    `[BROADCAST] Queue updated with ${upcomingSegments.length} segments`
  );
}

/**
 * Publish request played notification
 */
export function publishRequestPlayed(
  requestId: string,
  trackTitle: string
): void {
  broadcastEmitter.emit(BroadcastEvent.REQUEST_PLAYED, {
    requestId,
    trackTitle,
    playedAt: new Date().toISOString(),
  });
  console.log(`[BROADCAST] Request ${requestId} played: ${trackTitle}`);
}

/**
 * Publish show change notification
 */
export function publishShowChange(
  previousShowId: string,
  newShowId: string,
  newShowName: string
): void {
  broadcastEmitter.emit(BroadcastEvent.SHOW_CHANGE, {
    previousShowId,
    newShowId,
    newShowName,
    changedAt: new Date().toISOString(),
  });
  console.log(
    `[BROADCAST] Show changed from ${previousShowId} to ${newShowName}`
  );
}

/**
 * Subscribe to broadcast events
 */
export function subscribeToBroadcast(
  event: BroadcastEvent,
  callback: (data: unknown) => void
): void {
  broadcastEmitter.on(event, callback);
}

/**
 * Unsubscribe from broadcast events
 */
export function unsubscribeFromBroadcast(
  event: BroadcastEvent,
  callback: (data: unknown) => void
): void {
  broadcastEmitter.off(event, callback);
}

/**
 * Get current listener count for an event
 */
export function getBroadcastListenerCount(event: BroadcastEvent): number {
  return broadcastEmitter.listenerCount(event);
}

/**
 * Format segment for SSE/WebSocket transmission
 */
export function formatSegmentForBroadcast(segment: QueuedSegment): object {
  return {
    id: segment.id,
    type: segment.type,
    startTime: segment.startTime.toISOString(),
    endTime: segment.endTime.toISOString(),
    showId: segment.showId,
    trackId: segment.trackId,
    requestId: segment.requestId,
    metadata: segment.metadata,
  };
}

/**
 * Create SSE message format
 */
export function createSSEMessage(event: BroadcastEvent, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * Broadcast stats for monitoring
 */
export function getBroadcastStats(): {
  activeEvents: string[];
  listenersByEvent: Record<string, number>;
  totalListeners: number;
} {
  const events = Object.values(BroadcastEvent);
  const stats = {
    activeEvents: [] as string[],
    listenersByEvent: {} as Record<string, number>,
    totalListeners: 0,
  };

  events.forEach((event) => {
    const count = getBroadcastListenerCount(event);
    if (count > 0) {
      stats.activeEvents.push(event);
      stats.listenersByEvent[event] = count;
      stats.totalListeners += count;
    }
  });

  return stats;
}
