"use client";

import { useState, useEffect } from "react";
import { AudioPlayer } from "./AudioPlayer";
import { TimeShift } from "./TimeShift";

interface StreamPlayerProps {
  liveStreamUrl?: string;
  enableTimeShift?: boolean;
  maxTimeShiftMinutes?: number;
}

export function StreamPlayer({
  liveStreamUrl = "/api/stream/live.m3u8",
  enableTimeShift = true,
  maxTimeShiftMinutes = 120,
}: StreamPlayerProps) {
  const [currentUrl, setCurrentUrl] = useState(liveStreamUrl);
  const [isLive, setIsLive] = useState(true);
  const [nowPlaying, setNowPlaying] = useState<{
    title?: string;
    artist?: string;
    showName?: string;
    presenters?: string[];
  } | null>(null);

  // Subscribe to now-playing updates
  useEffect(() => {
    const eventSource = new EventSource("/api/events");

    eventSource.addEventListener("now-playing", (e) => {
      try {
        const data = JSON.parse(e.data);
        setNowPlaying({
          title: data.title,
          artist: data.artist,
          showName: data.showName,
          presenters: data.presenters,
        });
      } catch (error) {
        console.error("Error parsing now-playing data:", error);
      }
    });

    eventSource.onerror = () => {
      console.error("SSE connection error");
      eventSource.close();
    };

    return () => {
      eventSource.close();
    };
  }, []);

  const handleTimeShift = (minutesBack: number, timestamp: string | null) => {
    if (minutesBack === 0 || timestamp === null) {
      // Go back to live
      setCurrentUrl(liveStreamUrl);
      setIsLive(true);
    } else {
      // Switch to time-shifted playback
      const archiveUrl = `/api/archive/time?ts=${timestamp}&duration=60`;
      setCurrentUrl(archiveUrl);
      setIsLive(false);
    }
  };

  return (
    <div className="w-full space-y-6 rounded-lg border border-border bg-card p-6 shadow-lg">
      {/* Now Playing Display */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-foreground">
            {isLive ? "Now Playing" : "Playing from Archive"}
          </h2>
          {!isLive && (
            <span className="text-sm text-muted-foreground">
              (Time-shifted)
            </span>
          )}
        </div>

        {nowPlaying && (
          <div className="space-y-1">
            {nowPlaying.title && (
              <p className="text-base font-medium text-foreground">
                {nowPlaying.title}
              </p>
            )}
            {nowPlaying.artist && (
              <p className="text-sm text-muted-foreground">
                {nowPlaying.artist}
              </p>
            )}
            {nowPlaying.showName && (
              <p className="text-sm text-muted-foreground">
                {nowPlaying.showName}
              </p>
            )}
          </div>
        )}

        {!nowPlaying && isLive && (
          <p className="text-sm text-muted-foreground">
            Connecting to live stream...
          </p>
        )}
      </div>

      {/* Audio Player */}
      <AudioPlayer audioUrl={currentUrl} isLive={isLive} />

      {/* Time-Shift Controls */}
      {enableTimeShift && (
        <div className="border-t border-border pt-6">
          <TimeShift
            onTimeShift={handleTimeShift}
            maxMinutes={maxTimeShiftMinutes}
          />
        </div>
      )}
    </div>
  );
}
