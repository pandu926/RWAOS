import { cn } from "@/lib/utils";

export function TrendBars({
  data,
}: {
  data: Array<{ label: string; value: number }>;
}) {
  const max = Math.max(...data.map((item) => item.value));

  return (
    <div className="space-y-5">
      <div className="flex h-64 items-end gap-3 rounded-[1.5rem] bg-surface-soft px-4 pb-4 pt-12">
        {data.map((item, index) => {
          const height = `${Math.max((item.value / max) * 100, 18)}%`;

          return (
            <div key={item.label} className="flex flex-1 flex-col items-center justify-end gap-3">
              <div className="flex h-full w-full items-end">
                <div
                  className={cn(
                    "w-full rounded-t-2xl",
                    index === 3 ? "bg-primary" : "bg-surface-strong",
                  )}
                  style={{ height }}
                />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
                {item.label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DonutChart({
  segments,
}: {
  segments: Array<{ label: string; value: number; color: string }>;
}) {
  const gradient = `conic-gradient(${segments
    .map((segment, index) => {
      const start = segments
        .slice(0, index)
        .reduce((sum, current) => sum + current.value, 0);
      const end = start + segment.value;
      return `${segment.color} ${start}% ${end}%`;
    })
    .join(", ")})`;

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:items-center">
      <div className="relative mx-auto flex size-52 items-center justify-center rounded-full" style={{ background: gradient }}>
        <div className="absolute inset-6 rounded-full bg-surface shadow-inner" />
        <div className="relative text-center">
          <p className="text-3xl font-semibold text-foreground">94%</p>
          <p className="mt-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-muted">
            compliant
          </p>
        </div>
      </div>
      <div className="flex-1 space-y-3">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="size-3 rounded-full" style={{ backgroundColor: segment.color }} />
              <span className="text-sm text-foreground">{segment.label}</span>
            </div>
            <span className="text-sm font-semibold text-foreground">{segment.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
