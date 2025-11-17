export interface Request {
  id: string;
  type: "music" | "talk";
  text: string;
  upvotes: number;
  status: "pending" | "approved" | "rejected";
  createdAt: string;
}

export interface CreateRequestData {
  type: "music" | "talk";
  text: string;
}

export interface AudioSource {
  url: string;
  isLive: boolean;
  timestamp?: number;
}
