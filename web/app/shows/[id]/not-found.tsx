import Link from "next/link";

export default function ShowNotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold tracking-tight">
            Show Not Found
          </h2>
          <p className="text-muted-foreground">
            This show doesn&apos;t exist in our lineup.
            <br />
            Maybe it&apos;s stuck in the Lofield roadworks.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <p className="mb-4 text-muted-foreground">
            The show you&apos;re looking for is either:
          </p>
          <ul className="mb-6 space-y-1 text-left text-sm text-muted-foreground">
            <li>• Not part of our 24/7 schedule</li>
            <li>• Never made it past the planning meeting</li>
            <li>• Lost in the archive somewhere</li>
          </ul>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/schedule"
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              View Schedule
            </Link>
            <Link
              href="/"
              className="inline-flex items-center justify-center rounded-md border bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
