"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { Icon } from "@/components/icons";
import { Button, StatusBadge } from "@/components/ui";
import { WalletConnectButton } from "@/components/wallet-connect-button";
import { navigation, organization } from "@/lib/site-data";
import { cn, shortenAddress } from "@/lib/utils";
import { getWalletSessionFromDocumentCookie } from "@/lib/web3/session";

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [walletSession] = useState(() => getWalletSessionFromDocumentCookie());
  const walletAddress = walletSession?.address;
  const walletRole = walletSession?.role ? walletSession.role.toUpperCase() : "No active wallet";

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <div
        className={cn(
          "fixed inset-0 z-40 bg-primary/25 backdrop-blur-sm transition-opacity lg:hidden",
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setMobileOpen(false)}
      />

      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-[17.25rem] flex-col border-r border-border bg-surface px-3.5 pb-4 pt-3.5 shadow-soft transition-transform sm:w-[18rem] sm:px-4 sm:pb-5 sm:pt-4 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-4 px-2 py-2">
          <Link
            href="/dashboard"
            className="flex items-center gap-3"
            onClick={() => setMobileOpen(false)}
          >
            <div className="flex size-11 items-center justify-center rounded-2xl bg-primary text-primary-foreground">
              <Icon name="shield" className="size-5" />
            </div>
            <div>
              <p className="text-lg font-semibold tracking-tight text-foreground">RWA OS</p>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted sm:text-[11px] sm:tracking-[0.24em]">
                Confidential layer
              </p>
            </div>
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="rounded-xl border border-border p-2 text-muted transition-colors hover:text-foreground lg:hidden"
            aria-label="Close navigation"
          >
            <Icon name="close" className="size-4" />
          </button>
        </div>

        <div className="mt-6 rounded-[1.5rem] border border-border bg-surface-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            Organization
          </p>
          <p className="mt-2 text-sm font-semibold text-foreground">{organization.name}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <StatusBadge tone="success">{organization.networkName}</StatusBadge>
            <StatusBadge tone="accent">{organization.environmentLabel}</StatusBadge>
          </div>
        </div>

        <nav className="mt-6 flex-1 space-y-1">
          {navigation.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-medium transition-all",
                  active
                    ? "bg-primary text-white shadow-card [&>*]:text-white"
                    : "text-muted hover:bg-surface-soft hover:text-foreground",
                )}
              >
                <Icon name={item.icon} className="size-4" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="rounded-[1.5rem] border border-border bg-surface-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-muted">Session</p>
          <div className="mt-3 flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-full bg-surface shadow-sm">
              <Icon name="user" className="size-4 text-foreground" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-foreground">
                {walletAddress ? "Wallet session" : "Not connected"}
              </p>
              <p className="truncate text-xs text-muted">{walletRole}</p>
            </div>
          </div>
          <p className="mt-3 font-mono text-xs text-muted">
            {walletAddress ? shortenAddress(walletAddress) : "Connect wallet to start session"}
          </p>
        </div>
      </aside>

      <div className="lg:pl-[18rem]">
        <header className="sticky top-0 z-30 border-b border-border bg-white/95 backdrop-blur-xl">
          <div className="mx-auto flex max-w-[1600px] items-center justify-between gap-2 px-3 py-3.5 sm:gap-4 sm:px-6 sm:py-4 lg:px-8">
            <div className="flex min-w-0 items-center gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="rounded-xl border border-border bg-surface p-2 text-muted transition-colors hover:text-foreground lg:hidden"
                aria-label="Open navigation"
              >
                <Icon name="menu" className="size-4" />
              </button>
              <p className="truncate text-sm font-semibold text-foreground sm:hidden">RWA OS</p>
              <div className="hidden items-center gap-3 rounded-2xl border border-border bg-surface-soft px-3 py-2 sm:flex">
                <Icon name="search" className="size-4 text-muted" />
                <span className="text-sm text-muted">Search confidential assets...</span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <Button href="/onboarding" variant="secondary" size="sm" className="hidden sm:inline-flex">
                Onboarding
              </Button>
              <WalletConnectButton mode="header" />
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
