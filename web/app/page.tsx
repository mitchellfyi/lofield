export default function Home() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Audio Player Placeholder */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Now Playing</h2>
          <div className="flex items-center justify-center rounded-md bg-muted p-12 text-muted-foreground">
            <p className="text-center">
              Audio player will go here
              <br />
              <span className="text-sm">(Live stream coming soon)</span>
            </p>
          </div>
        </section>

        {/* Request UI Placeholder */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Request a Song</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-center rounded-md bg-muted p-8 text-muted-foreground">
              <p className="text-center">
                Song request form will go here
                <br />
                <span className="text-sm">
                  (Submit and vote on requests coming soon)
                </span>
              </p>
            </div>
          </div>
        </section>

        {/* Recent Activity Feed Placeholder */}
        <section className="rounded-lg border bg-card p-6 shadow-sm">
          <h2 className="mb-4 text-xl font-semibold">Recent Activity</h2>
          <div className="flex items-center justify-center rounded-md bg-muted p-8 text-muted-foreground">
            <p className="text-center">
              Activity feed will go here
              <br />
              <span className="text-sm">
                (Recent requests and plays coming soon)
              </span>
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
