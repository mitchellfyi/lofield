"use client";

import { ScheduleSlot } from "@/lib/types";
import { ShowCard } from "./ShowCard";

interface ScheduleGridProps {
  schedule: ScheduleSlot[][];
}

const dayNames = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function ScheduleGrid({ schedule }: ScheduleGridProps) {
  return (
    <div className="grid gap-6 lg:grid-cols-7 md:grid-cols-3 sm:grid-cols-2">
      {schedule.map((daySlots, dayIndex) => (
        <div key={dayIndex} className="space-y-3">
          <h2 className="text-lg font-semibold border-b pb-2">
            {dayNames[dayIndex]}
          </h2>
          <div className="space-y-3">
            {daySlots.map((slot, slotIndex) => (
              <ShowCard key={slotIndex} slot={slot} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
