import Link from "next/link";
import type { ButtonHTMLAttributes, HTMLAttributes, ReactNode } from "react";

import { Icon, type IconName } from "@/components/icons";
import type { StatusTone } from "@/lib/site-data";
import { cn } from "@/lib/utils";

type ButtonProps = {
  children: ReactNode;
  href?: string;
  icon?: IconName;
  trailingIcon?: IconName;
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md" | "lg";
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>;

const buttonStyles = {
  base: "inline-flex items-center justify-center gap-2 rounded-xl border font-medium transition-all focus:outline-none focus:ring-2 focus:ring-primary/15",
  variant: {
    primary:
      "border-primary bg-primary !text-white shadow-card hover:-translate-y-0.5 hover:shadow-soft",
    secondary:
      "border-border bg-surface text-foreground hover:border-border-strong hover:bg-surface-soft",
    ghost: "border-transparent bg-transparent text-foreground hover:bg-surface-soft",
  },
  size: {
    sm: "px-3 py-2 text-xs sm:px-3.5 sm:text-sm",
    md: "px-3.5 py-2.5 text-sm sm:px-4",
    lg: "px-4 py-2.5 text-sm sm:px-6 sm:py-3 sm:text-base",
  },
};

export function Button({
  children,
  href,
  icon,
  trailingIcon,
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ButtonProps) {
  const classes = cn(
    buttonStyles.base,
    buttonStyles.variant[variant],
    buttonStyles.size[size],
    className,
  );

  const content = (
    <>
      {icon ? <Icon name={icon} className="size-4" /> : null}
      <span>{children}</span>
      {trailingIcon ? <Icon name={trailingIcon} className="size-4" /> : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type={type} className={classes} {...props}>
      {content}
    </button>
  );
}

export function StatusBadge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: StatusTone;
  className?: string;
}) {
  const styles: Record<StatusTone, string> = {
    neutral: "bg-surface-muted text-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent text-foreground",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold sm:px-3 sm:text-xs",
        styles[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function SectionCard({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: string;
  description?: string;
  action?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-[1.5rem] border border-border bg-surface shadow-card",
        className,
      )}
    >
      {title || action ? (
        <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:px-6 sm:py-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            {title ? <h2 className="text-base font-semibold text-foreground sm:text-lg">{title}</h2> : null}
            {description ? <p className="max-w-2xl text-sm text-muted">{description}</p> : null}
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </div>
      ) : null}
      <div className="px-4 py-4 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
}: {
  eyebrow?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  meta?: ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:gap-5 lg:flex-row lg:items-end lg:justify-between">
      <div className="space-y-3">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-xs sm:tracking-[0.24em]">
            {eyebrow}
          </p>
        ) : null}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
              {title}
            </h1>
            {meta}
          </div>
          <p className="max-w-3xl text-sm leading-6 text-muted">
            {description}
          </p>
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-3">{actions}</div> : null}
    </header>
  );
}

export function StatCard({
  title,
  value,
  detail,
  icon,
  tone = "neutral",
}: {
  title: string;
  value: string;
  detail: string;
  icon: IconName;
  tone?: StatusTone;
}) {
  const iconStyles: Record<StatusTone, string> = {
    neutral: "bg-surface-muted text-foreground",
    success: "bg-success-soft text-success",
    warning: "bg-warning-soft text-warning",
    danger: "bg-danger-soft text-danger",
    accent: "bg-accent text-foreground",
  };

  return (
    <article className="rounded-[1.25rem] border border-border bg-surface p-4 shadow-card sm:rounded-[1.5rem] sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div className={cn("rounded-2xl p-3", iconStyles[tone])}>
          <Icon name={icon} className="size-5" />
        </div>
        <StatusBadge tone={tone}>{title}</StatusBadge>
      </div>
      <div className="mt-4 space-y-2 sm:mt-6">
        <p className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{value}</p>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </article>
  );
}

export function SearchField({
  placeholder,
  className,
}: {
  placeholder: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "relative flex min-w-0 w-full flex-1 items-center rounded-xl border border-border bg-surface-soft",
        className,
      )}
    >
      <Icon name="search" className="ml-3 size-4 text-muted" />
      <input
        readOnly
        value=""
        placeholder={placeholder}
        className="w-full bg-transparent px-3 py-3 text-sm text-foreground outline-none placeholder:text-muted"
      />
    </label>
  );
}

export function FilterChip({
  icon,
  children,
}: {
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-muted transition-colors hover:border-border-strong hover:text-foreground"
    >
      {icon ? <Icon name={icon} className="size-4" /> : null}
      <span>{children}</span>
    </button>
  );
}

export function InlineNotice({
  title,
  description,
  tone = "accent",
  icon = "info",
}: {
  title: string;
  description: string;
  tone?: StatusTone;
  icon?: IconName;
}) {
  const styles: Record<StatusTone, string> = {
    neutral: "border-border bg-surface-soft",
    success: "border-success/15 bg-success-soft",
    warning: "border-warning/15 bg-warning-soft",
    danger: "border-danger/15 bg-danger-soft",
    accent: "border-accent-strong/35 bg-accent",
  };

  return (
    <div className={cn("flex gap-4 rounded-2xl border p-5", styles[tone])}>
      <div className="rounded-2xl bg-surface p-3 text-foreground shadow-sm">
        <Icon name={icon} className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="text-sm leading-6 text-muted">{description}</p>
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-[1.5rem] border border-dashed border-border-strong bg-surface-soft px-6 py-10 text-center">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-4">
        <div className="rounded-full bg-surface p-4 shadow-card">
          <Icon name="sparkles" className="size-6 text-foreground" />
        </div>
        <div className="space-y-2">
          <h3 className="text-lg font-semibold text-foreground">{title}</h3>
          <p className="text-sm leading-6 text-muted">{description}</p>
        </div>
        {action}
      </div>
    </div>
  );
}

export function DetailList({
  items,
  columns = 2,
}: {
  items: Array<{ label: string; value: ReactNode }>;
  columns?: 1 | 2;
}) {
  return (
    <dl className={cn("grid gap-6", columns === 2 ? "md:grid-cols-2" : "grid-cols-1")}>
      {items.map((item) => (
        <div key={item.label} className="space-y-2">
          <dt className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            {item.label}
          </dt>
          <dd className="text-sm leading-6 text-foreground">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function SurfaceTable({
  children,
  className,
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("overflow-hidden rounded-[1.5rem] border border-border bg-surface shadow-card", className)}>
      <div className="overflow-x-auto">{children}</div>
    </div>
  );
}
