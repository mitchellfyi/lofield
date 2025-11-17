import type { Metadata } from "next";
import { notFound } from "next/navigation";

interface ShowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

// List of valid show slugs
const VALID_SHOWS = [
  "afternoon_push",
  "early_hours",
  "evening_wind_down",
  "late_evening",
  "lunchtime_wind_down",
  "mid_morning_focus",
  "morning_commute",
  "night_shift",
];

// Generate metadata for SEO
export async function generateMetadata({
  params,
}: ShowPageProps): Promise<Metadata> {
  const { slug } = await params;
  const title = slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());

  return {
    title: `${title} – Lofield FM`,
    description: `Archive and information for ${title} on Lofield FM. Your co-working companion with 24/7 AI-generated lofi music.`,
  };
}

// Pre-generate pages for known shows
export async function generateStaticParams() {
  return VALID_SHOWS.map((slug) => ({ slug }));
}

export default async function ShowPage({ params }: ShowPageProps) {
  const { slug } = await params;

  // Redirect to 404 if the slug is not a valid show
  if (!VALID_SHOWS.includes(slug)) {
    notFound();
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight capitalize">
            {slug.replace(/-/g, " ")}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Show-specific archive and information
          </p>
        </div>

        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground">
            Show archive for &ldquo;{slug}&rdquo; will appear here
            <br />
            <span className="text-sm">(Show-specific content coming soon)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
