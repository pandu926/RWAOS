import { DonutChart, TrendBars } from "@/components/charts";
import { Button, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { getAssets, getAuditEvents, getDisclosures, getInvestors, getTransfers } from "@/lib/api";
import { assetTone } from "@/lib/site-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ReportsPage() {
  const [assets, transfers, investors, disclosures, auditEvents] = await Promise.all([
    getAssets(),
    getTransfers(),
    getInvestors(),
    getDisclosures(),
    getAuditEvents(),
  ]);

  const activeAssets = assets.filter((asset) => asset.status === "Active").length;
  const verifiedInvestors = investors.filter((investor) => investor.whitelistStatus === "Verified").length;
  const complianceEvents = disclosures.length + auditEvents.length;
  const latestTransferLabel = transfers.at(-1)?.reference ?? "No transfer hash yet";
  const visibleTransfers = transfers.filter((transfer) => transfer.amountVisibility.startsWith("Visible"));
  const visibleVolume = visibleTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);

  const recentTransfers = transfers.slice(-6);
  const trendData = recentTransfers.map((item, index) => ({
    label: `T${index + 1}`,
    value: item.txHash ? 1 : 0.5,
  }));
  const safeTrendData =
    trendData.length > 0 ? trendData : [{ label: "No data", value: 1 }];

  const totalDisclosures = Math.max(disclosures.length, 1);
  const activeDisclosures = disclosures.filter((item) => item.status === "Active").length;
  const revokedDisclosures = disclosures.filter((item) => item.status === "Revoked").length;
  const expiredDisclosures = disclosures.filter((item) => item.status === "Expired").length;
  const distribution = [
    { label: "Active", value: Math.round((activeDisclosures / totalDisclosures) * 100), color: "#3ABFF8" },
    { label: "Revoked", value: Math.round((revokedDisclosures / totalDisclosures) * 100), color: "#FB7185" },
    { label: "Expired", value: Math.round((expiredDisclosures / totalDisclosures) * 100), color: "#A78BFA" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Business and compliance summary"
        title="Reports"
        description="Live summary generated from current backend registries and operational records."
        meta={<StatusBadge tone="accent">Live data</StatusBadge>}
        actions={
          <>
            <Button variant="secondary" href="/reports?range=30d">Change range</Button>
            <Button href="/api/exports/report-summary">Share report</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Confidential volume">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {visibleTransfers.length > 0 ? formatCurrency(visibleVolume) : "Encrypted"}
          </p>
          <p className="mt-2 text-sm text-muted">
            {visibleTransfers.length > 0 ? "Visible to connected authorized wallet" : "Amounts are disclosure-gated, not public report data"}
          </p>
        </SectionCard>
        <SectionCard title="Active assets">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{activeAssets}</p>
          <p className="mt-2 text-sm text-muted">From asset registry</p>
        </SectionCard>
        <SectionCard title="Verified holders">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{verifiedInvestors}</p>
          <p className="mt-2 text-sm text-muted">From investor registry</p>
        </SectionCard>
        <SectionCard title="Compliance events">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{complianceEvents}</p>
          <p className="mt-2 text-sm text-muted">Disclosures + audit events</p>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_.8fr]">
        <SectionCard title="Recent transfer activity" description="Shows recent confidential transfer activity without exposing amounts.">
          <TrendBars data={safeTrendData} />
          <p className="mt-4 text-sm text-muted">Latest transfer reference: {latestTransferLabel}</p>
        </SectionCard>
        <SectionCard title="Disclosure distribution" description="Based on current disclosure status values.">
          <DonutChart segments={distribution} />
        </SectionCard>
      </div>

      <SurfaceTable>
        <table className="min-w-[980px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4">Transfers tracked</th>
              <th className="px-6 py-4">Confidential volume</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {assets.map((asset) => {
              const transferCount = transfers.filter((transfer) => transfer.assetId === asset.id).length;
              return (
                <tr key={asset.id} className="hover:bg-surface-soft/80">
                  <td className="px-6 py-5">
                    <p className="text-sm font-semibold text-foreground">{asset.name}</p>
                    <p className="mt-1 text-xs text-muted">{asset.symbol}</p>
                  </td>
                  <td className="px-6 py-5 text-sm text-foreground">{asset.type}</td>
                  <td className="px-6 py-5 text-sm text-foreground">{transferCount}</td>
                  <td className="px-6 py-5 text-sm font-semibold text-foreground">
                    {transfers
                      .filter((transfer) => transfer.assetId === asset.id && transfer.amountVisibility.startsWith("Visible"))
                      .reduce((sum, transfer) => sum + transfer.amount, 0) > 0
                      ? formatCurrency(
                          transfers
                            .filter((transfer) => transfer.assetId === asset.id && transfer.amountVisibility.startsWith("Visible"))
                            .reduce((sum, transfer) => sum + transfer.amount, 0),
                        )
                      : "Encrypted payloads"}
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge tone={assetTone(asset.status)}>{asset.status}</StatusBadge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
