"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <div className="flex flex-col items-center justify-center space-y-6 text-center">
        <div className="space-y-2">
          <h1 className="text-6xl font-bold tracking-tight">Oops!</h1>
          <h2 className="text-2xl font-semibold tracking-tight">
            Something Went Wrong
          </h2>
          <p className="text-muted-foreground">
            The broadcast has been interrupted.
            <br />
            We&apos;re experiencing technical difficulties.
          </p>
        </div>

        <div className="rounded-lg border bg-card p-8 shadow-sm">
          <p className="mb-6 text-muted-foreground">
            Don&apos;t worry, even Lofield FM has off days. The Wi-Fi in town is
            terrible.
          </p>

          <div className="space-x-4">
            <button
              onClick={reset}
              className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow hover:bg-primary/90"
            >
              Try Again
            </button>
            <Link
              href="/"
              className="inline-flex items-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm hover:bg-accent hover:text-accent-foreground"
            >
              Back to Home
            </Link>
          </div>
        </div>

        {error.digest && (
          <p className="text-xs text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
