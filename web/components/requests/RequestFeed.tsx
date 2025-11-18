"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowUp, Music, MessageSquare, CheckCircle2, XCircle } from "lucide-react";
import type { Request } from "@/lib/types";
import { formatDateTimeToLocal } from "@/lib/time-utils";
import {
  getVotedRequests,
  addVotedRequest,
  hasVotedForRequest,
} from "@/lib/vote-storage";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "";

interface RequestFeedProps {
  refreshKey?: number;
}

export function RequestFeed({ refreshKey = 0 }: RequestFeedProps) {
  const [requests, setRequests] = useState<Request[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());
  const [votedIds, setVotedIds] = useState<Set<string>>(new Set());
  const [voteErrors, setVoteErrors] = useState<Map<string, string>>(new Map());

  // Load voted IDs from localStorage on mount
  useEffect(() => {
    setVotedIds(getVotedRequests());
  }, []);

  // Fetch initial data and setup SSE connection
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    const setupSSE = () => {
      try {
        eventSource = new EventSource(`${API_URL}/api/requests/events`);

        eventSource.addEventListener("connected", () => {
          console.log("Connected to request events stream");
        });

        eventSource.addEventListener("requests-update", (event) => {
          if (!isMounted) return;
          try {
            const data = JSON.parse(event.data);
            setRequests(data.requests || []);
            setLoading(false);
            setError(null);
          } catch (err) {
            console.error("Error parsing requests-update:", err);
          }
        });

        eventSource.addEventListener("request-created", (event) => {
          if (!isMounted) return;
          try {
            const newRequest = JSON.parse(event.data);
            setRequests((prev) => {
              // Check if request already exists
              if (prev.some((r) => r.id === newRequest.id)) {
                return prev;
              }
              // Add to the list and sort
              return [...prev, newRequest].sort((a, b) => {
                if (b.upvotes !== a.upvotes) {
                  return b.upvotes - a.upvotes;
                }
                return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
              });
            });
          } catch (err) {
            console.error("Error parsing request-created:", err);
          }
        });

        eventSource.addEventListener("request-voted", (event) => {
          if (!isMounted) return;
          try {
            const { id, votes } = JSON.parse(event.data);
            setRequests((prev) =>
              prev
                .map((req) => (req.id === id ? { ...req, upvotes: votes } : req))
                .sort((a, b) => {
                  if (b.upvotes !== a.upvotes) {
                    return b.upvotes - a.upvotes;
                  }
                  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
                })
            );
          } catch (err) {
            console.error("Error parsing request-voted:", err);
          }
        });

        eventSource.addEventListener("request-status-changed", (event) => {
          if (!isMounted) return;
          try {
            const { id, status } = JSON.parse(event.data);
            if (status !== "pending") {
              // Remove non-pending requests from the feed
              setRequests((prev) => prev.filter((req) => req.id !== id));
            }
          } catch (err) {
            console.error("Error parsing request-status-changed:", err);
          }
        });

        eventSource.addEventListener("error", (event) => {
          if (!isMounted) return;
          console.error("SSE error:", event);
          setError("Connection error. Retrying...");
          // EventSource will automatically reconnect
        });

        eventSource.onerror = () => {
          if (!isMounted) return;
          setLoading(false);
          // EventSource will automatically reconnect
        };
      } catch (err) {
        console.error("Error setting up SSE:", err);
        setError("Failed to connect to live updates");
        setLoading(false);
      }
    };

    setupSSE();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
    };
  }, [refreshKey]);

  const handleVote = useCallback(
    async (requestId: string) => {
      // Check if already voted
      if (hasVotedForRequest(requestId)) {
        setVoteErrors((prev) => new Map(prev).set(requestId, "You've already voted for this request"));
        setTimeout(() => {
          setVoteErrors((prev) => {
            const newMap = new Map(prev);
            newMap.delete(requestId);
            return newMap;
          });
        }, 3000);
        return;
      }

      if (votingIds.has(requestId)) return;

      setVotingIds((prev) => new Set(prev).add(requestId));
      setVoteErrors((prev) => {
        const newMap = new Map(prev);
        newMap.delete(requestId);
        return newMap;
      });

      try {
        // Optimistic update
        setRequests((prev) =>
          prev.map((req) =>
            req.id === requestId ? { ...req, upvotes: req.upvotes + 1 } : req
          )
        );

        const response = await fetch(`${API_URL}/api/requests/${requestId}/vote`, {
          method: "POST",
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || "Failed to vote");
        }

        // Mark as voted in localStorage
        addVotedRequest(requestId);
        setVotedIds((prev) => new Set(prev).add(requestId));
      } catch (err) {
        console.error("Failed to vote:", err);
        const errorMessage = err instanceof Error ? err.message : "Failed to vote";
        setVoteErrors((prev) => new Map(prev).set(requestId, errorMessage));

        // Revert optimistic update on error
        setRequests((prev) =>
          prev.map((req) =>
            req.id === requestId ? { ...req, upvotes: req.upvotes - 1 } : req
          )
        );

        setTimeout(() => {
          setVoteErrors((prev) => {
            const newMap = new Map(prev);
            newMap.delete(requestId);
            return newMap;
          });
        }, 5000);
      } finally {
        setVotingIds((prev) => {
          const newSet = new Set(prev);
          newSet.delete(requestId);
          return newSet;
        });
      }
    },
    [votingIds]
  );

  if (error && loading) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        {error}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse rounded-lg border bg-card p-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-md bg-muted"></div>
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 rounded bg-muted"></div>
                <div className="h-3 w-1/2 rounded bg-muted"></div>
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">
          No pending requests yet. Be the first to submit one!
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((request) => {
        const hasVoted = votedIds.has(request.id);
        const voteError = voteErrors.get(request.id);

        return (
          <div
            key={request.id}
            className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              {/* Upvote Button */}
              <button
                onClick={() => handleVote(request.id)}
                disabled={votingIds.has(request.id) || hasVoted}
                className={`flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors ${
                  hasVoted
                    ? "cursor-not-allowed bg-muted text-muted-foreground/50"
                    : "hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                }`}
                aria-label={`Upvote request (${request.upvotes} votes)`}
                title={hasVoted ? "You've already voted" : "Upvote this request"}
              >
                <ArrowUp
                  size={20}
                  className={`transition-colors ${
                    hasVoted
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground group-hover:text-primary"
                  }`}
                />
                <span className="text-sm font-medium tabular-nums">
                  {request.upvotes}
                </span>
              </button>

              {/* Request Content */}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  {request.type === "music" ? (
                    <Music size={16} className="text-primary" />
                  ) : (
                    <MessageSquare size={16} className="text-primary" />
                  )}
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {request.type}
                  </span>
                  {request.status === "used" && (
                    <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 size={14} />
                      <span>Played</span>
                    </span>
                  )}
                  {request.status === "rejected" && (
                    <span className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
                      <XCircle size={14} />
                      <span>Rejected</span>
                    </span>
                  )}
                </div>
                <p className="text-sm leading-relaxed text-foreground">
                  {request.text}
                </p>
                <p className="text-xs text-muted-foreground">
                  Submitted {formatDateTimeToLocal(request.createdAt)}
                </p>
                {voteError && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    {voteError}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
