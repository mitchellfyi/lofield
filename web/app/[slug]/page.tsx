import { Suspense } from "react";

interface ShowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function ShowContent({ params }: ShowPageProps) {
  const { slug } = await params;

  return (
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
  );
}

export default function ShowPage({ params }: ShowPageProps) {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <Suspense
        fallback={
          <div className="flex h-96 items-center justify-center">
            <p className="text-muted-foreground">Loading...</p>
          </div>
        }
      >
        <ShowContent params={params} />
      </Suspense>
    </div>
  );
}
