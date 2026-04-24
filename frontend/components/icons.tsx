import type { ReactNode, SVGProps } from "react";

import { cn } from "@/lib/utils";

export type IconName =
  | "dashboard"
  | "building"
  | "users"
  | "transfers"
  | "eye"
  | "shield"
  | "report"
  | "settings"
  | "search"
  | "bell"
  | "wallet"
  | "menu"
  | "close"
  | "plus"
  | "chevron-right"
  | "chevron-left"
  | "lock"
  | "sparkles"
  | "info"
  | "check"
  | "alert"
  | "file"
  | "calendar"
  | "key"
  | "user"
  | "filter"
  | "copy"
  | "trend"
  | "dots";

type IconProps = SVGProps<SVGSVGElement> & {
  name: IconName;
};

export function Icon({ name, className, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.8}
      aria-hidden="true"
      className={cn("size-5 shrink-0", className)}
      {...props}
    >
      {iconPaths[name]}
    </svg>
  );
}

const iconPaths: Record<IconName, ReactNode> = {
  dashboard: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="2" />
      <rect x="13" y="3" width="8" height="5" rx="2" />
      <rect x="13" y="10" width="8" height="11" rx="2" />
      <rect x="3" y="13" width="8" height="8" rx="2" />
    </>
  ),
  building: (
    <>
      <path d="M4 21h16" />
      <path d="M7 21V7l5-3 5 3v14" />
      <path d="M9 11h.01" />
      <path d="M9 15h.01" />
      <path d="M15 11h.01" />
      <path d="M15 15h.01" />
    </>
  ),
  users: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
      <circle cx="9.5" cy="7" r="3.5" />
      <path d="M19 21v-2a3.5 3.5 0 0 0-2.4-3.3" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4" />
    </>
  ),
  transfers: (
    <>
      <path d="M4 7h12" />
      <path d="m12 3 4 4-4 4" />
      <path d="M20 17H8" />
      <path d="m12 13-4 4 4 4" />
    </>
  ),
  eye: (
    <>
      <path d="M2 12s3.6-6 10-6 10 6 10 6-3.6 6-10 6S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 5 6v6c0 4.5 2.8 7.7 7 9 4.2-1.3 7-4.5 7-9V6l-7-3Z" />
      <path d="m9.5 12 1.8 1.8L14.8 10" />
    </>
  ),
  report: (
    <>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-8" />
      <path d="M22 20v-5" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.5 1.5 0 0 1 0 2.1 1.5 1.5 0 0 1-2.1 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V19a1.5 1.5 0 0 1-3 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.5 1.5 0 0 1-2.1 0 1.5 1.5 0 0 1 0-2.1l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H5a1.5 1.5 0 0 1 0-3h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.5 1.5 0 0 1 0-2.1 1.5 1.5 0 0 1 2.1 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V5a1.5 1.5 0 0 1 3 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.5 1.5 0 0 1 2.1 0 1.5 1.5 0 0 1 0 2.1l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H19a1.5 1.5 0 0 1 0 3h-.2a1 1 0 0 0-.9.6Z" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.5-3.5" />
    </>
  ),
  bell: (
    <>
      <path d="M15 18H5.5A1.5 1.5 0 0 1 4 16.5l1.2-1.9a4 4 0 0 0 .6-2.1V10a6.2 6.2 0 1 1 12.4 0v2.5a4 4 0 0 0 .6 2.1l1.2 1.9A1.5 1.5 0 0 1 18.5 18H15" />
      <path d="M10 21a2.5 2.5 0 0 0 4 0" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5A2.5 2.5 0 0 1 6.5 5H19a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H6.5A2.5 2.5 0 0 1 4 16.5v-9Z" />
      <path d="M4 9h16" />
      <path d="M16.5 14h.01" />
    </>
  ),
  menu: (
    <>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  "chevron-right": <path d="m9 6 6 6-6 6" />,
  "chevron-left": <path d="m15 6-6 6 6 6" />,
  lock: (
    <>
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V8a4 4 0 1 1 8 0v3" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3 1.7 4.3L18 9l-4.3 1.7L12 15l-1.7-4.3L6 9l4.3-1.7L12 3Z" />
      <path d="m19 14 .8 2 .2.8.8.2 2 .8-2 .8-.8.2-.2.8-.8 2-.8-2-.2-.8-.8-.2-2-.8 2-.8.8-.2.2-.8.8-2Z" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10v5" />
      <path d="M12 7h.01" />
    </>
  ),
  check: <path d="m5 12 4.5 4.5L19 7" />,
  alert: (
    <>
      <path d="M12 4 3.5 19h17L12 4Z" />
      <path d="M12 10v4" />
      <path d="M12 17h.01" />
    </>
  ),
  file: (
    <>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z" />
      <path d="M14 3v5h5" />
      <path d="M9 13h6" />
      <path d="M9 17h4" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M16 3v4" />
      <path d="M8 3v4" />
      <path d="M3 10h18" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="3.5" />
      <path d="M11 15.5h10" />
      <path d="M18 15.5V13" />
      <path d="M15 15.5V13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  filter: (
    <>
      <path d="M4 6h16" />
      <path d="M7 12h10" />
      <path d="M10 18h4" />
    </>
  ),
  copy: (
    <>
      <rect x="9" y="9" width="10" height="10" rx="2" />
      <path d="M15 9V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </>
  ),
  trend: (
    <>
      <path d="M4 16 10 10l4 4 6-7" />
      <path d="M15 7h5v5" />
    </>
  ),
  dots: (
    <>
      <circle cx="6" cy="12" r="1" />
      <circle cx="12" cy="12" r="1" />
      <circle cx="18" cy="12" r="1" />
    </>
  ),
};
