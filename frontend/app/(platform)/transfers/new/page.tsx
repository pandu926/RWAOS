import Link from "next/link";

import { organization } from "@/lib/site-data";
import { Button, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";

export default function NewTransferPage() {
  return (
    <div className="space-y-6">
      <Link href="/transfers" className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground">
        Back to transfers
      </Link>

      <PageHeader
        eyebrow="Transfer execution"
        title="Create transfer"
        description="Provide recipient, amount, and reference notes within a shell consistent with other pages. Dummy data is used so flow and layout can be reviewed end-to-end."
        meta={<StatusBadge tone="accent">Zero-knowledge enabled</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <SectionCard title="Transfer form" description="All fields have clear labels and are ready to be mapped to real backend form handling.">
            <form className="grid gap-5 md:grid-cols-2">
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="asset" className="text-sm font-medium text-foreground">
                  Select asset
                </label>
                <select
                  id="asset"
                  defaultValue="Institutional Treasury"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  <option>Institutional Treasury</option>
                  <option>Prime Real Estate Fund</option>
                  <option>Green Energy Debt II</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="recipient" className="text-sm font-medium text-foreground">
                  Recipient address / investor
                </label>
                <input
                  id="recipient"
                  placeholder="Enter whitelisted wallet address"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
                />
                <p className="text-xs leading-5 text-muted">
                  Address must exist in the institutional registry before transfer execution.
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="amount" className="text-sm font-medium text-foreground">
                  Amount
                </label>
                <input
                  id="amount"
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="shield-amount" className="text-sm font-medium text-foreground">
                  Amount visibility
                </label>
                <select
                  id="shield-amount"
                  defaultValue="Visible to authorized users only"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  <option>Visible to authorized users only</option>
                  <option>Restricted</option>
                  <option>Hidden</option>
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="reference-note" className="text-sm font-medium text-foreground">
                  Reference note
                </label>
                <textarea
                  id="reference-note"
                  rows={4}
                  placeholder="Add internal context for the transfer..."
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
                />
              </div>
            </form>
          </SectionCard>

          <InlineNotice
            title="Compliance verification passed"
            description="This dummy state simulates whitelist checks, disclosure scope validation, and policy limits before smart contract submission."
            tone="success"
          />
        </div>

        <div className="space-y-6">
          <SectionCard title="Transfer preview">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Asset</span>
                <span className="text-sm font-semibold text-foreground">
                  Institutional Treasury
                </span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Recipient</span>
                <span className="text-sm font-semibold text-foreground">Northbridge Capital</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Amount</span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">$12,500.00</p>
                  <p className="text-xs text-muted">Encrypted amount</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Estimated gas fee</span>
                <span className="text-sm font-semibold text-foreground">~0.0004 ETH</span>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-surface-soft p-4">
              <p className="text-sm leading-6 text-muted">
                Only the sender, recipient, and authorized reviewers can view the amount after
                settlement.
              </p>
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button className="w-full justify-center">Initiate confidential transfer</Button>
              <Button variant="secondary" className="w-full justify-center">
                Save as draft
              </Button>
            </div>
          </SectionCard>

          <SectionCard title="Network information">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Network</span>
                <span className="font-medium text-foreground">{organization.networkName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Settlement time</span>
                <span className="font-medium text-foreground">&lt; 2 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Privacy method</span>
                <span className="font-medium text-foreground">zk-SNARKs</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
