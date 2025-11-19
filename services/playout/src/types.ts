/**
 * Playout Service - Type Definitions
 */

export interface PlayoutConfig {
  streamOutputPath: string;
  archiveOutputPath: string;
  hlsSegmentDuration: number;
  hlsListSize: number;
  crossfadeMusicToMusic: number;
  crossfadeMusicToTalk: number;
  crossfadeTalkToMusic: number;
  audioBitrate: string;
  audioSampleRate: number;
  pollInterval: number;
  archiveRetentionDays: number;
}

export interface SegmentInfo {
  id: string;
  filePath: string;
  type: "music" | "talk" | "ident" | "handover";
  startTime: Date;
  endTime: Date;
  showId: string;
  trackId?: string;
  requestId?: string;
}

export interface ArchiveIndex {
  timestamp: string;
  segmentPath: string;
  duration: number;
  showId: string;
  segmentType: string;
  trackId?: string;
  segmentId: string;
}

export interface HLSManifest {
  version: number;
  targetDuration: number;
  mediaSequence: number;
  segments: HLSSegment[];
}

export interface HLSSegment {
  duration: number;
  path: string;
}

export interface StreamHealth {
  status: "healthy" | "degraded" | "unhealthy";
  playoutService: "running" | "stopped" | "error";
  liveStreamAge: number;
  queueDepth: number;
  lastSegmentAt: string | null;
  archiveStorage: {
    available: string;
    used: string;
  };
}
