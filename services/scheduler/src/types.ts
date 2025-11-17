/**
 * Type definitions for the scheduler service
 */

export interface SchedulerConfig {
  bufferMinutes: number;
  checkIntervalSeconds: number;
  audioStoragePath: string;
  archivePath: string;
  minQueueDepthMinutes: number;
}

export interface QueuedSegment {
  id: string;
  showId: string;
  type: "music" | "talk" | "ident" | "handover";
  filePath: string;
  startTime: Date;
  endTime: Date;
  requestId?: string;
  trackId?: string;
  metadata?: Record<string, unknown>;
}

export interface Show {
  id: string;
  name: string;
  description: string | null;
  startHour: number;
  durationHours: number;
  talkFraction: number;
  musicFraction: number;
  presenterIds: string;
  configJson: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShowConfig {
  id: string;
  name: string;
  description: string;
  schedule: {
    days: string[];
    start_time_utc: string;
    end_time_utc: string;
    duration_hours: number;
  };
  ratios: {
    music_fraction: number;
    talk_fraction: number;
  };
  timing: {
    max_link_seconds: number;
    min_gap_between_links_seconds: number;
    typical_track_length_seconds: number;
  };
  presenters: {
    primary_duo: string[];
    duo_probability: number;
    solo_probability: number;
  };
  tone: {
    keywords: string[];
    energy_level: string;
    mood: string;
  };
  topics: {
    primary_tags: string[];
    banned_tags: string[];
  };
}

export interface Request {
  id: string;
  userId: string | null;
  type: string;
  rawText: string;
  normalized: string | null;
  votes: number;
  status: string;
  createdAt: Date;
  usedAt: Date | null;
  moderationStatus: string;
}

export interface ArchiveIndex {
  segmentId: string;
  filePath: string;
  offset: number;
  duration: number;
  startTime: Date;
  endTime: Date;
  showId: string;
  type: string;
}

export interface NowPlayingMetadata {
  segmentId: string;
  type: string;
  showId: string;
  showName: string;
  startTime: Date;
  endTime: Date;
  trackId?: string;
  trackTitle?: string;
  requestId?: string;
  requester?: string;
}
