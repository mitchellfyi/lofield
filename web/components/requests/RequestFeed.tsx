"use client";

import { useState } from "react";
import useSWR from "swr";
import { ArrowUp, Music, MessageSquare } from "lucide-react";
import type { Request } from "@/lib/types";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

interface RequestFeedProps {
  refreshKey?: number;
}

export function RequestFeed({ refreshKey = 0 }: RequestFeedProps) {
  const { data, error, mutate } = useSWR<Request[]>(
    `/api/requests?status=pending&_key=${refreshKey}`,
    fetcher,
    {
      refreshInterval: 30000, // Refresh every 30 seconds
    },
  );

  const [votingIds, setVotingIds] = useState<Set<string>>(new Set());

  const handleVote = async (requestId: string) => {
    if (votingIds.has(requestId)) return;

    setVotingIds((prev) => new Set(prev).add(requestId));

    try {
      // Optimistic update
      mutate(
        (currentData) =>
          currentData?.map((req) =>
            req.id === requestId ? { ...req, upvotes: req.upvotes + 1 } : req,
          ),
        false,
      );

      const response = await fetch(`/api/requests/${requestId}/vote`, {
        method: "POST",
      });

      if (!response.ok) {
        throw new Error("Failed to vote");
      }

      // Revalidate to get the actual data from server
      await mutate();
    } catch (err) {
      console.error("Failed to vote:", err);
      // Revert optimistic update on error
      await mutate();
    } finally {
      setVotingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(requestId);
        return newSet;
      });
    }
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200">
        Failed to load requests. Please try again later.
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="animate-pulse rounded-lg border bg-card p-4"
          >
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

  if (data.length === 0) {
    return (
      <div className="rounded-lg border bg-muted/50 p-8 text-center">
        <p className="text-muted-foreground">
          No pending requests yet. Be the first to submit one!
        </p>
      </div>
    );
  }

  // Sort by upvotes (descending)
  const sortedRequests = [...data].sort((a, b) => b.upvotes - a.upvotes);

  return (
    <div className="space-y-3">
      {sortedRequests.map((request) => (
        <div
          key={request.id}
          className="group rounded-lg border bg-card p-4 transition-shadow hover:shadow-md"
        >
          <div className="flex items-start gap-3">
            {/* Upvote Button */}
            <button
              onClick={() => handleVote(request.id)}
              disabled={votingIds.has(request.id)}
              className="flex flex-col items-center gap-1 rounded-md px-2 py-1.5 transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={`Upvote request (${request.upvotes} votes)`}
            >
              <ArrowUp
                size={20}
                className="text-muted-foreground transition-colors group-hover:text-primary"
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
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                {request.text}
              </p>
              <p className="text-xs text-muted-foreground">
                Submitted {new Date(request.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
