import { generateWeeklySchedule } from "@/lib/shows";
import { ScheduleGrid } from "@/components/schedule/ScheduleGrid";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Schedule - Lofield FM",
  description:
    "Browse the daily and weekly schedule for Lofield FM. Background noise for people just trying to make it through the day.",
};

export default function SchedulePage() {
  const weekSchedule = generateWeeklySchedule();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="mt-2 text-muted-foreground">
            24-hour programming schedule. All times shown in UTC.
          </p>
        </div>

        <ScheduleGrid schedule={weekSchedule} />
      </div>
    </div>
  );
}
