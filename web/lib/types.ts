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
