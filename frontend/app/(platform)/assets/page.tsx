import Link from "next/link";

import { assetTone } from "@/lib/site-data";
import { getAssets } from "@/lib/api";
import { Button, FilterChip, PageHeader, SearchField, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { formatCompactNumber, formatCurrency, formatPercentage } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AssetsPage() {
  const assets = await getAssets();
  const activeAssets = assets.filter((asset) => asset.status === "Active").length;
  const restrictedAssets = assets.filter((asset) => asset.status === "Restricted").length;
  const averageYield =
    assets.reduce((sum, asset) => sum + asset.yield, 0) / Math.max(assets.length, 1);
  const ownerVisibleAum = assets
    .filter((asset) => asset.aumVisibility === "Visible to owner")
    .reduce((sum, asset) => sum + asset.confidentialAum, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asset registry"
        title="Assets"
        description="Directory of confidential assets across the organization, including status, issuer, holders, and operationally relevant performance indicators."
        meta={<StatusBadge tone="accent">{assets.length} total</StatusBadge>}
        actions={
          <>
            <Button variant="secondary" href="/api/exports/assets">Export list</Button>
            <Button href="/assets/new">Create asset</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Live assets">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{activeAssets}</p>
          <p className="mt-2 text-sm text-muted">Actively transferable today</p>
        </SectionCard>
        <SectionCard title="Restricted">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{restrictedAssets}</p>
          <p className="mt-2 text-sm text-muted">Need disclosure or policy action</p>
        </SectionCard>
        <SectionCard title="Average yield">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {assets.some((asset) => asset.yield > 0) ? formatPercentage(averageYield) : "Derived on issuance"}
          </p>
          <p className="mt-2 text-sm text-muted">Across visible product set</p>
        </SectionCard>
        <SectionCard title="Confidential AUM">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {ownerVisibleAum > 0 ? formatCompactNumber(ownerVisibleAum) : "Encrypted"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {ownerVisibleAum > 0 ? "Visible to connected tenant owner" : "Disclosure-gated amount data"}
          </p>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <SearchField placeholder="Search assets..." />
            <div className="flex flex-wrap gap-3">
              <FilterChip>All statuses</FilterChip>
              <FilterChip>All types</FilterChip>
              <FilterChip icon="filter">High priority</FilterChip>
            </div>
          </div>
          <Button variant="secondary" href="/assets">Refresh data</Button>
        </div>
      </SectionCard>

      <SurfaceTable>
        <table className="min-w-[980px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Issuer</th>
              <th className="px-6 py-4">Holders</th>
              <th className="px-6 py-4">Confidential AUM</th>
              <th className="px-6 py-4">Yield</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <Link href={`/assets/${asset.id}`} className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                    <p className="text-xs text-muted">{asset.symbol}</p>
                  </Link>
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{asset.type}</td>
                <td className="px-6 py-5 text-sm text-foreground">{asset.issuer}</td>
                <td className="px-6 py-5 text-sm text-foreground">{asset.holdersCount}</td>
                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {asset.aumVisibility === "Visible to owner" ? formatCurrency(asset.confidentialAum) : "Encrypted payload"}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">
                  {formatPercentage(asset.yield)}
                </td>
                <td className="px-6 py-5">
                  <StatusBadge tone={assetTone(asset.status)}>{asset.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
