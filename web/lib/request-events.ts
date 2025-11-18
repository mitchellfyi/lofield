import { EventEmitter } from "events";

// Event types for request updates
export interface RequestEventData {
  id: string;
  type: string;
  text: string;
  upvotes: number;
  status: string;
  createdAt: string;
}

export interface RequestVotedData {
  id: string;
  votes: number;
}

export interface RequestStatusChangedData {
  id: string;
  status: string;
}

// Create a single instance of EventEmitter for request events
class RequestEventEmitter extends EventEmitter {
  emitRequestCreated(data: RequestEventData) {
    this.emit("request:created", data);
  }

  emitRequestVoted(data: RequestVotedData) {
    this.emit("request:voted", data);
  }

  emitRequestStatusChanged(data: RequestStatusChangedData) {
    this.emit("request:status-changed", data);
  }
}

// Export a singleton instance
export const requestEventEmitter = new RequestEventEmitter();
