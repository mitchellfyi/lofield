import { ArchiveBrowser } from "@/components/archive/ArchiveBrowser";
import { loadShows } from "@/lib/shows";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Archive - Lofield FM",
  description:
    "Browse and listen to past shows and episodes from Lofield FM. Catch up on what you missed.",
};

export default function ArchivePage() {
  const shows = loadShows();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archive</h1>
          <p className="mt-2 text-muted-foreground">
            Browse past shows and episodes
          </p>
        </div>

        <ArchiveBrowser shows={shows} />
      </div>
    </div>
  );
}
