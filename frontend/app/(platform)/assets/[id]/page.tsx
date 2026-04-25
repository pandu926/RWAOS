import Link from "next/link";
import { notFound } from "next/navigation";

import { assetTone, disclosureTone, transferTone } from "@/lib/site-data";
import { getAssets, getDisclosures, getTransfers } from "@/lib/api";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { formatCurrency, formatPercentage } from "@/lib/utils";
import { contractAddresses } from "@/lib/web3/contracts";

export const dynamic = "force-dynamic";

export default async function AssetDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assets, transfers, disclosures] = await Promise.all([
    getAssets(),
    getTransfers(),
    getDisclosures(),
  ]);

  const asset = assets.find((item) => item.id === id);

  if (!asset) {
    notFound();
  }

  const relatedTransfers = transfers.filter((transfer) => transfer.assetId === asset.id);
  const relatedDisclosures = disclosures.filter((disclosure) => disclosure.assetId === asset.id);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-sm text-muted">
        <Link href="/assets" className="transition-colors hover:text-foreground">
          Assets
        </Link>
        <span>/</span>
        <span className="font-medium text-foreground">{asset.name}</span>
      </div>

      <PageHeader
        eyebrow="Asset detail"
        title={asset.name}
        description={asset.description}
        meta={
          <>
            <StatusBadge tone="neutral">{asset.symbol}</StatusBadge>
            <StatusBadge tone={assetTone(asset.status)}>{asset.status}</StatusBadge>
          </>
        }
        actions={
          <>
            <Button href="/audit" variant="secondary">
              View audit trail
            </Button>
            <Button href="/transfers/new">Create transfer</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Confidential AUM">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatCurrency(asset.confidentialAum)}
          </p>
          <p className="mt-2 text-sm text-muted">From transfer records for this asset</p>
        </SectionCard>
        <SectionCard title="Transfers tracked">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {relatedTransfers.length}
          </p>
          <p className="mt-2 text-sm text-muted">Current backend records</p>
        </SectionCard>
        <SectionCard title="Yield">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatPercentage(asset.yield)}
          </p>
          <p className="mt-2 text-sm text-muted">Current mapped value</p>
        </SectionCard>
        <SectionCard title="Disclosures">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {relatedDisclosures.length}
          </p>
          <p className="mt-2 text-sm text-muted">Visibility grants linked to this asset</p>
        </SectionCard>
      </div>

      <SectionCard
        title="Overview"
        description="Metadata and confidentiality context for this asset."
        action={
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="accent">Overview</StatusBadge>
            <StatusBadge tone="neutral">Activity</StatusBadge>
            <StatusBadge tone="neutral">Disclosure</StatusBadge>
          </div>
        }
      >
        <div className="space-y-6">
          <InlineNotice
            title="Confidentiality note"
            description="This asset uses disclosure scopes to limit who can view amount and sensitive metadata."
          />
          <DetailList
            items={[
              { label: "Asset type", value: asset.type },
              { label: "Issuer", value: asset.issuer },
              { label: "Jurisdiction", value: asset.jurisdiction },
              { label: "Last activity", value: asset.lastActivity },
              {
                label: "Token contract",
                value: <code className="rounded bg-surface-soft px-2 py-1 font-mono text-xs">{contractAddresses.confidentialRwaToken}</code>,
              },
            ]}
          />
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SurfaceTable>
          <table className="min-w-[760px] w-full text-left">
            <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              <tr>
                <th className="px-6 py-4">Transfer</th>
                <th className="px-6 py-4">From</th>
                <th className="px-6 py-4">To</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {relatedTransfers.map((transfer) => (
                <tr key={transfer.id} className="hover:bg-surface-soft/80">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-foreground">{transfer.id}</p>
                    <p className="mt-1 text-xs text-muted">{transfer.submittedAt}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{transfer.from}</td>
                  <td className="px-6 py-4 text-sm text-foreground">{transfer.to}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-foreground">
                    {formatCurrency(transfer.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone={transferTone(transfer.status)}>{transfer.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SurfaceTable>

        <SectionCard title="Active disclosure permissions" description="Scopes currently active for this asset.">
          <div className="space-y-4">
            {relatedDisclosures.map((disclosure) => (
              <div key={disclosure.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{disclosure.grantee}</p>
                    <p className="text-xs text-muted">{disclosure.scope}</p>
                  </div>
                  <StatusBadge tone={disclosureTone(disclosure.status)}>
                    {disclosure.status}
                  </StatusBadge>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {disclosure.grantedBy} • Expires {disclosure.expiresAt}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
