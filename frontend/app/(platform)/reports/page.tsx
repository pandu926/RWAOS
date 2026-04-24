import { assets, reportDistribution, reportTrend } from "@/lib/site-data";
import { DonutChart, TrendBars } from "@/components/charts";
import { Button, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export default function ReportsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business and compliance summary"
        title="Reports"
        description="Performance summary, compliance distribution, and asset overview that reinforce product narrative without compromising privacy posture."
        meta={<StatusBadge tone="accent">Last 30 days</StatusBadge>}
        actions={
          <>
            <Button variant="secondary">Change range</Button>
            <Button>Share report</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Total volume">
          <p className="text-3xl font-semibold tracking-tight text-foreground">$248.5M</p>
          <p className="mt-2 text-sm text-muted">Aggregated confidential movement</p>
        </SectionCard>
        <SectionCard title="Active assets">
          <p className="text-3xl font-semibold tracking-tight text-foreground">12</p>
          <p className="mt-2 text-sm text-muted">4 pending audit review</p>
        </SectionCard>
        <SectionCard title="Active holders">
          <p className="text-3xl font-semibold tracking-tight text-foreground">1,402</p>
          <p className="mt-2 text-sm text-muted">Verified institutional participants</p>
        </SectionCard>
        <SectionCard title="Compliance events">
          <p className="text-3xl font-semibold tracking-tight text-foreground">342</p>
          <p className="mt-2 text-sm text-muted">100% logged on-chain</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SectionCard
          title="Monthly activity trend"
          description="Simple visual placeholder that remains consistent with the enterprise visual language."
        >
          <TrendBars data={reportTrend} />
        </SectionCard>
        <SectionCard title="Compliance distribution" description="Status checks across automated and manual review paths.">
          <DonutChart segments={reportDistribution} />
        </SectionCard>
      </div>

      <SurfaceTable>
        <table className="min-w-[980px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Transfers (30d)</th>
              <th className="px-6 py-4">Confidential volume</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => (
              <tr key={asset.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                  <p className="mt-1 text-xs text-muted">{asset.symbol}</p>
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{asset.type}</td>
                <td className="px-6 py-5 text-sm text-foreground">
                  {Math.max(asset.holdersCount * 7, 48)}
                </td>
                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {formatCurrency(asset.confidentialAum)}
                </td>
                <td className="px-6 py-5">
                  <StatusBadge tone={asset.status === "Active" ? "success" : "warning"}>
                    {asset.status}
                  </StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
