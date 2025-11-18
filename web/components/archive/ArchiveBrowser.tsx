"use client";

import { useState } from "react";
import useSWR from "swr";
import { Show, ArchiveSegment } from "@/lib/types";
import { formatDateTimeToLocal } from "@/lib/time-utils";

interface ArchiveBrowserProps {
  shows: Show[];
}

interface ArchiveResponse {
  total: number;
  segments: ArchiveSegment[];
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

export function ArchiveBrowser({ shows }: ArchiveBrowserProps) {
  const [selectedShow, setSelectedShow] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (selectedShow) queryParams.set("show_id", selectedShow);
  if (startDate)
    queryParams.set("start_time", new Date(startDate).toISOString());
  if (endDate) queryParams.set("end_time", new Date(endDate).toISOString());
  queryParams.set("limit", "20");

  const { data, error, isLoading } = useSWR<ArchiveResponse>(
    `/api/archive?${queryParams.toString()}`,
    fetcher
  );

  const handleClearFilters = () => {
    setSelectedShow("");
    setStartDate("");
    setEndDate("");
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold">Filter Episodes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label
              htmlFor="show-filter"
              className="mb-2 block text-sm font-medium"
            >
              Show
            </label>
            <select
              id="show-filter"
              value={selectedShow}
              onChange={(e) => setSelectedShow(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              aria-label="Filter episodes by show"
            >
              <option value="">All Shows</option>
              {shows.map((show) => (
                <option key={show.id} value={show.id}>
                  {show.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="start-date"
              className="mb-2 block text-sm font-medium"
            >
              Start Date
            </label>
            <input
              type="date"
              id="start-date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              aria-label="Filter episodes from this date onwards"
            />
          </div>
          <div>
            <label
              htmlFor="end-date"
              className="mb-2 block text-sm font-medium"
            >
              End Date
            </label>
            <input
              type="date"
              id="end-date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border bg-background px-3 py-2 text-sm"
              aria-label="Filter episodes up to this date"
            />
          </div>
        </div>
        {(selectedShow || startDate || endDate) && (
          <div className="mt-4">
            <button
              onClick={handleClearFilters}
              className="text-sm text-muted-foreground hover:text-foreground"
              aria-label="Clear all filters"
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* Results */}
      <div className="rounded-lg border bg-card p-6 shadow-sm">
        {isLoading && (
          <div className="py-12 text-center text-muted-foreground">
            Loading archive...
          </div>
        )}

        {error && (
          <div className="py-12 text-center">
            <p className="text-sm text-red-600 dark:text-red-400">
              Failed to load archive. Please try again.
            </p>
          </div>
        )}

        {!isLoading && !error && data && data.segments.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No archived episodes found.
            <br />
            <span className="text-sm">
              Try adjusting your filters or check back later.
            </span>
          </div>
        )}

        {!isLoading && !error && data && data.segments.length > 0 && (
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">
              Showing {data.segments.length} episode
              {data.segments.length !== 1 ? "s" : ""}
            </div>
            <div className="space-y-3">
              {data.segments.map((segment) => (
                <div
                  key={segment.id}
                  className="rounded-lg border p-4 transition-colors hover:bg-accent/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h3 className="font-semibold">{segment.showName}</h3>
                      <div className="mt-1 flex items-center gap-3 text-sm text-muted-foreground">
                        <span>
                          {formatDateTimeToLocal(segment.startTime)}
                        </span>
                        <span>•</span>
                        <span className="capitalize">{segment.type}</span>
                      </div>
                    </div>
                    {segment.streamUrl && (
                      <button
                        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                        onClick={() => {
                          window.open(segment.streamUrl, "_blank");
                        }}
                        aria-label={`Play ${segment.showName} from ${formatDateTimeToLocal(segment.startTime)}`}
                      >
                        Play
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
