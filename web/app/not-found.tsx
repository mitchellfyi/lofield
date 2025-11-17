import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight">404</h1>
          <h2 className="text-2xl font-semibold tracking-tight">
            Page Not Found
          </h2>
          <p className="text-muted-foreground">
            Looks like you&apos;ve tuned into a frequency that doesn&apos;t
            exist.
            <br />
            Even for Lofield FM, that&apos;s saying something.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <p className="mb-4 text-muted-foreground">
            The page you&apos;re looking for is either:
          </p>
          <ul className="mb-6 space-y-1 text-left text-sm text-muted-foreground">
            <li>• Lost somewhere in the Lofield roadworks</li>
            <li>• Stuck in a meeting that could have been an email</li>
            <li>• Never existed in the first place</li>
          </ul>

          <Link
            href="/"
            className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
