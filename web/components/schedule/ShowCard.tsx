"use client";

import Link from "next/link";
import { ScheduleSlot } from "@/lib/types";

interface ShowCardProps {
  slot: ScheduleSlot;
}

export function ShowCard({ slot }: ShowCardProps) {
  const { show, startTime, endTime } = slot;
  const musicPercentage = Math.round(show.ratios.music_fraction * 100);
  const talkPercentage = Math.round(show.ratios.talk_fraction * 100);

  return (
    <Link href={`/shows/${show.id}`}>
      <div className="rounded-lg border bg-card p-4 shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground">
        <div className="space-y-2">
          <div className="text-sm text-muted-foreground">
            {startTime} - {endTime}
          </div>
          <h3 className="font-semibold leading-tight">{show.name}</h3>
          <div className="flex gap-2 text-xs">
            <span className="rounded-md bg-primary/10 px-2 py-1">
              {musicPercentage}% music
            </span>
            <span className="rounded-md bg-secondary/10 px-2 py-1">
              {talkPercentage}% talk
            </span>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {show.description}
          </p>
        </div>
      </div>
    </Link>
  );
}
