// Request types
export interface Request {
  id: string;
  type: "music" | "talk";
  text: string;
  upvotes: number;
  status: "pending" | "approved" | "rejected" | "used";
  createdAt: string;
}

export interface CreateRequestData {
  type: "music" | "talk";
  text: string;
}

// Audio and streaming types
export interface AudioSource {
  url: string;
  isLive: boolean;
  timestamp?: number;
}

// Now playing metadata
export interface NowPlaying {
  segmentId: string;
  type: "music" | "talk" | "ident" | "handover";
  startTime: string;
  endTime: string;
  title?: string;
  artist?: string;
  showName?: string;
  requestText?: string;
  requesterName?: string;
}

// Queue item
export interface QueueItem {
  segmentId: string;
  type: "music" | "talk" | "ident" | "handover";
  scheduledTime: string;
  title?: string;
  duration: number;
}

// Archive metadata
export interface ArchiveSegment {
  id: string;
  showName: string;
  startTime: string;
  endTime: string;
  type: string;
  streamUrl?: string;
}

// Show and schedule types
export interface Presenter {
  id: string;
  name: string;
  voice_id: string;
  role: string;
  persona: string;
  shows: string[];
  quirks: string[];
}

export interface ShowSchedule {
  days: string[];
  start_time_utc: string;
  end_time_utc: string;
  duration_hours: number;
}

export interface ShowRatios {
  music_fraction: number;
  talk_fraction: number;
}

export interface ShowTone {
  keywords: string[];
  energy_level: string;
  mood: string;
}

export interface ShowTopics {
  primary_tags: string[];
  banned_tags?: string[];
  allow_listener_requests: boolean;
  typical_request_themes?: string[];
}

export interface Show {
  id: string;
  name: string;
  description: string;
  schedule: ShowSchedule;
  ratios: ShowRatios;
  presenters: {
    primary_duo: string[];
    duo_probability: number;
    solo_probability: number;
  };
  tone: ShowTone;
  topics: ShowTopics;
}

export interface ScheduleSlot {
  show: Show;
  startTime: string;
  endTime: string;
  dayOfWeek: number;
}
