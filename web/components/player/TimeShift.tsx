"use client";

import { useState } from "react";
import { SkipBack, RotateCcw } from "lucide-react";

interface TimeShiftProps {
  onTimeShift: (minutesBack: number) => void;
  maxMinutes?: number;
}

export function TimeShift({
  onTimeShift,
  maxMinutes = 120,
}: TimeShiftProps) {
  const [minutesBack, setMinutesBack] = useState(0);

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value);
    setMinutesBack(value);
    onTimeShift(value);
  };

  const goLive = () => {
    setMinutesBack(0);
    onTimeShift(0);
  };

  const formatTime = (minutes: number) => {
    if (minutes === 0) return "Live";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m ago`;
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

      <div className="flex items-center gap-3">
        <input
          type="range"
          min="0"
          max={maxMinutes}
          step="5"
          value={minutesBack}
          onChange={handleSliderChange}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
          aria-label="Time shift slider"
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
