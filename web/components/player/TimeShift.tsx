"use client";

import { useState } from "react";
import { SkipBack, RotateCcw } from "lucide-react";

// Time-shift configuration
const DEFAULT_STEP_SIZE_MINUTES = 5;

interface TimeShiftProps {
  onTimeShift: (minutesBack: number, timestamp: string | null) => void;
  maxMinutes?: number;
  stepSize?: number;
}

export function TimeShift({
  onTimeShift,
  maxMinutes = 120,
  stepSize = DEFAULT_STEP_SIZE_MINUTES,
}: TimeShiftProps) {
  const [minutesBack, setMinutesBack] = useState(0);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setMinutesBack(value);

    // Calculate timestamp for time-shifted playback
    const timestamp =
      value > 0 ? new Date(Date.now() - value * 60 * 1000).toISOString() : null;

    onTimeShift(value, timestamp);
  };

  const goLive = () => {
    setMinutesBack(0);
    onTimeShift(0, null);
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return "Live";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;

    if (hours > 0 && mins > 0) {
      return `${hours}h ${mins}m ago`;
    } else if (hours > 0) {
      return `${hours}h ago`;
    }
    return `${mins}m ago`;
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SkipBack size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Time Travel
          </span>
        </div>
        <span className="text-sm text-muted-foreground">
          {formatTime(minutesBack)}
        </span>
      </div>

      {/* Screen reader help text */}
      <p className="text-xs text-muted-foreground" id="timeshift-description">
        Rewind the stream to listen to earlier content. Drag the slider or use
        arrow keys to navigate.
      </p>

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={maxMinutes}
          step={stepSize}
          value={minutesBack}
          onChange={handleSliderChange}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          aria-label={`Time shift slider: ${formatTime(minutesBack)}`}
          aria-describedby="timeshift-description"
          aria-valuemin={0}
          aria-valuemax={maxMinutes}
          aria-valuenow={minutesBack}
          aria-valuetext={formatTime(minutesBack)}
        />
        <button
          onClick={goLive}
          disabled={minutesBack === 0}
          className="flex items-center gap-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Go to live"
        >
          <RotateCcw size={14} />
          <span>Live</span>
        </button>
      </div>
    </div>
  );
}
