export default function ArchivePage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Archive</h1>
          <p className="mt-2 text-muted-foreground">
            Browse past shows and episodes
          </p>
        </div>

        <div className="rounded-lg border bg-card p-12 text-center shadow-sm">
          <p className="text-muted-foreground">
            Archived shows will appear here
            <br />
            <span className="text-sm">(Archive browsing coming soon)</span>
          </p>
        </div>
      </div>
    </div>
  );
}
