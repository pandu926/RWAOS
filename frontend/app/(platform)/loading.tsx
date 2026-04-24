export default function PlatformLoading() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-10 w-56 rounded-full bg-surface-muted" />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-40 rounded-[1.5rem] bg-surface-muted" />
        ))}
      </div>
      <div className="h-[440px] rounded-[1.5rem] bg-surface-muted" />
    </div>
  );
}
