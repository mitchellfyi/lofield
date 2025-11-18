"use client";

import Link from "next/link";
import { Show, Presenter } from "@/lib/types";
import { formatUTCTimeToLocal } from "@/lib/time-utils";

interface ShowDetailContentProps {
  show: Show;
  presenters: Presenter[];
}

const dayNames: Record<string, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export function ShowDetailContent({ show, presenters }: ShowDetailContentProps) {
  const musicPercentage = Math.round(show.ratios.music_fraction * 100);
  const talkPercentage = Math.round(show.ratios.talk_fraction * 100);
  const daysDisplay = show.schedule.days
    .map((d) => dayNames[d] || d)
    .join(", ");
  
  const localStartTime = formatUTCTimeToLocal(show.schedule.start_time_utc, true);
  const localEndTime = formatUTCTimeToLocal(show.schedule.end_time_utc, true);

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <Link
            href="/schedule"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Back to Schedule
          </Link>
          <div>
            <h1 className="text-4xl font-bold tracking-tight">{show.name}</h1>
            <p className="mt-3 text-lg text-muted-foreground">
              {show.description}
            </p>
          </div>
        </div>

        {/* Schedule Info */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Show Schedule</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Air Time
              </div>
              <div className="mt-1 text-lg">
                {localStartTime} - {localEndTime}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Days
              </div>
              <div className="mt-1 text-lg">{daysDisplay}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Duration
              </div>
              <div className="mt-1 text-lg">
                {show.schedule.duration_hours} hours
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Music / Talk Ratio
              </div>
              <div className="mt-1 flex gap-2">
                <span className="rounded-md bg-primary/10 px-3 py-1 text-sm font-medium">
                  {musicPercentage}% music
                </span>
                <span className="rounded-md bg-secondary/10 px-3 py-1 text-sm font-medium">
                  {talkPercentage}% talk
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Presenters */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Presenters</h2>
          <div className="space-y-4">
            {presenters.map((presenter) => (
              <div key={presenter.id} className="border-b pb-4 last:border-b-0 last:pb-0">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="font-semibold">{presenter.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {presenter.role}
                    </p>
                  </div>
                </div>
                <p className="mt-2 text-sm">{presenter.persona}</p>
                {presenter.quirks && presenter.quirks.length > 0 && (
                  <div className="mt-2">
                    <ul className="list-inside list-disc space-y-1 text-sm text-muted-foreground">
                      {presenter.quirks.map((quirk, idx) => (
                        <li key={idx}>{quirk}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Tone and Mood */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Tone & Mood</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Energy Level
              </div>
              <div className="mt-1 capitalize">{show.tone.energy_level}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Mood
              </div>
              <div className="mt-1">{show.tone.mood}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Keywords
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {show.tone.keywords.map((keyword, idx) => (
                  <span
                    key={idx}
                    className="rounded-md bg-muted px-2 py-1 text-xs"
                  >
                    {keyword}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Topics */}
        <div className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Topics & Themes</h2>
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Primary Topics
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {show.topics.primary_tags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="rounded-md border bg-background px-3 py-1 text-sm"
                  >
                    {tag.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </div>
            {show.topics.typical_request_themes &&
              show.topics.typical_request_themes.length > 0 && (
                <div>
                  <div className="text-sm font-medium text-muted-foreground">
                    Typical Request Themes
                  </div>
                  <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
                    {show.topics.typical_request_themes.map((theme, idx) => (
                      <li key={idx}>{theme}</li>
                    ))}
                  </ul>
                </div>
              )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Listener Requests
              </div>
              <div className="mt-1">
                {show.topics.allow_listener_requests ? (
                  <span className="text-sm text-green-600 dark:text-green-400">
                    ✓ Enabled
                  </span>
                ) : (
                  <span className="text-sm text-muted-foreground">
                    Not accepted
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
