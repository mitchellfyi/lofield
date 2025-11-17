"use client";

import { useState, useRef, useEffect } from "react";
import { Play, Pause, Volume2, VolumeX } from "lucide-react";

interface AudioPlayerProps {
  audioUrl: string;
  isLive?: boolean;
}

export function AudioPlayer({ audioUrl, isLive = true }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    // Update audio source when URL changes
    if (audioRef.current && audioUrl) {
      const wasPlaying = isPlaying;
      audioRef.current.pause();
      audioRef.current.load();
      setError(null); // Clear any previous errors
      if (wasPlaying) {
        audioRef.current.play().catch((err) => {
          console.error("Failed to play audio:", err);
          setError("Failed to load audio stream. Please try again.");
          setIsPlaying(false);
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audioUrl]);

  const togglePlay = async () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      try {
        setError(null); // Clear any previous errors
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (err) {
        console.error("Failed to play audio:", err);
        setError(
          "Failed to play audio. Please check your connection and try again."
        );
        setIsPlaying(false);
      }
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (newVolume > 0 && isMuted) {
      setIsMuted(false);
    }
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  return (
    <div className="space-y-4">
      <audio
        ref={audioRef}
        src={audioUrl}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onError={(e) => {
          console.error("Audio error:", e);
          setError(
            "Audio playback error occurred. Please try refreshing the page."
          );
          setIsPlaying(false);
        }}
      />

      {/* Error Message */}
      {error && (
        <div
          className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-950 dark:text-red-200"
          role="alert"
        >
          <p className="font-medium">Playback Error</p>
          <p>{error}</p>
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* Play/Pause Button */}
        <button
          onClick={togglePlay}
          className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all hover:scale-105 hover:shadow-lg"
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? <Pause size={24} /> : <Play size={24} />}
        </button>

        {/* Live Indicator */}
        {isLive && (
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              <span
                className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${isPlaying ? "bg-red-500" : "bg-gray-400"}`}
              ></span>
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${isPlaying ? "bg-red-600" : "bg-gray-500"}`}
              ></span>
            </span>
            <span className="text-sm font-medium text-foreground">LIVE</span>
          </div>
        )}

        {/* Volume Control */}
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={toggleMute}
            className="text-muted-foreground transition-colors hover:text-foreground"
            aria-label={isMuted ? "Unmute" : "Mute"}
          >
            {isMuted || volume === 0 ? (
              <VolumeX size={20} />
            ) : (
              <Volume2 size={20} />
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={isMuted ? 0 : volume}
            onChange={handleVolumeChange}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
            aria-label={`Volume: ${Math.round((isMuted ? 0 : volume) * 100)}%`}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round((isMuted ? 0 : volume) * 100)}
          />
        </div>
      </div>
    </div>
  );
}
