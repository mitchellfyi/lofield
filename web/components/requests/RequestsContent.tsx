"use client";

import { RequestForm } from "@/components/requests/RequestForm";
import { RequestFeedPage } from "@/components/requests/RequestFeedPage";

export function RequestsContent() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Requests</h1>
          <p className="mt-2 text-muted-foreground">
            Request a song or topic for the presenters. Vote on requests
            you&apos;d like to hear.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Request Form */}
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Submit a Request</h2>
            <RequestForm onSubmitSuccess={() => {}} />
          </section>

          {/* Pending Requests Feed */}
          <section className="rounded-lg border bg-card p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Pending Requests</h2>
            <RequestFeedPage />
          </section>
        </div>
      </div>
    </div>
  );
}
