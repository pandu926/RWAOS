export default function Loading() {
  return (
    <main className="min-h-screen bg-background px-6 py-12">
      <div className="mx-auto max-w-6xl animate-pulse space-y-8">
        <div className="h-14 w-48 rounded-full bg-surface-muted" />
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-[420px] rounded-[2rem] bg-surface-muted" />
          <div className="h-[420px] rounded-[2rem] bg-surface-muted" />
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="h-36 rounded-[1.5rem] bg-surface-muted" />
          <div className="h-36 rounded-[1.5rem] bg-surface-muted" />
          <div className="h-36 rounded-[1.5rem] bg-surface-muted" />
        </div>
      </div>
    </main>
  );
}
