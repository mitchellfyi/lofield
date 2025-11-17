"use client";

import { useState } from "react";
import { AudioPlayer } from "@/components/player/AudioPlayer";
import { TimeShift } from "@/components/player/TimeShift";
import { RequestForm } from "@/components/requests/RequestForm";
import { RequestFeed } from "@/components/requests/RequestFeed";

// Get stream URLs from environment variables with fallbacks
const STREAM_URL = process.env.NEXT_PUBLIC_STREAM_URL || "https://stream.lofield.fm/live.mp3";
const ARCHIVE_BASE_URL = process.env.NEXT_PUBLIC_ARCHIVE_BASE_URL || "https://stream.lofield.fm/archive";

export default function Home() {
  const [audioUrl, setAudioUrl] = useState(STREAM_URL);
  const [isLive, setIsLive] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleTimeShift = (minutesBack: number) => {
    if (minutesBack === 0) {
      // Go back to live
      setAudioUrl(STREAM_URL);
      setIsLive(true);
    } else {
      // Time-shifted URL (this would be provided by the API in a real implementation)
      const timestamp = Date.now() - minutesBack * 60 * 1000;
      setAudioUrl(
        `${ARCHIVE_BASE_URL}/${timestamp}.mp3`,
      );
      setIsLive(false);
    }
  };

  const handleRequestSubmitted = () => {
    // Refresh the request feed after successful submission
    setRefreshKey((prev) => prev + 1);
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Audio Player Section */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Now Playing</h2>
          <div className="space-y-4">
            <AudioPlayer audioUrl={audioUrl} isLive={isLive} />
            <TimeShift onTimeShift={handleTimeShift} maxMinutes={120} />
          </div>
        </section>

        {/* Request Form and Feed in responsive grid */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Request Form */}
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Request a Song</h2>
            <RequestForm onSubmitSuccess={handleRequestSubmitted} />
          </section>

          {/* Pending Requests Feed */}
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Pending Requests</h2>
            <div className="max-h-[600px] overflow-y-auto">
              <RequestFeed refreshKey={refreshKey} />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
