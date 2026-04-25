import { investorTone } from "@/lib/site-data";
import { getInvestors } from "@/lib/api";
import { Button, FilterChip, PageHeader, SearchField, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
  const investors = await getInvestors();
  const verified = investors.filter((investor) => investor.whitelistStatus === "Verified").length;
  const pending = investors.filter((investor) => investor.whitelistStatus === "Pending review").length;
  const restricted = investors.filter((investor) => investor.whitelistStatus === "Restricted").length;
  const visibleAllocation = investors.reduce((sum, investor) => sum + investor.allocation, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investor directory"
        title="Investors"
        description="Directory of holders and counterparties within the organization’s operational scope, including whitelist status and activity history."
        meta={<StatusBadge tone="accent">{investors.length} tracked</StatusBadge>}
        actions={
          <>
            <Button variant="secondary" href="/api/exports/investor-template">Import addresses</Button>
            <Button href="/investors/new">Invite investor</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Verified">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{verified}</p>
          <p className="mt-2 text-sm text-muted">Ready for transfer activity</p>
        </SectionCard>
        <SectionCard title="Pending review">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{pending}</p>
          <p className="mt-2 text-sm text-muted">Need credential refresh or approval</p>
        </SectionCard>
        <SectionCard title="Restricted">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{restricted}</p>
          <p className="mt-2 text-sm text-muted">Visibility reduced by policy</p>
        </SectionCard>
        <SectionCard title="Visible allocation">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {formatCurrency(visibleAllocation)}
          </p>
          <p className="mt-2 text-sm text-muted">Role-scoped, not public</p>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <SearchField placeholder="Search investors..." />
            <div className="flex flex-wrap gap-3">
              <FilterChip>Whitelist status</FilterChip>
              <FilterChip>Role</FilterChip>
              <FilterChip>Asset exposure</FilterChip>
            </div>
          </div>
        </div>
      </SectionCard>

      <SurfaceTable>
        <table className="min-w-[980px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Entity</th>
              <th className="px-6 py-4">Address</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Assets</th>
              <th className="px-6 py-4">Allocation</th>
              <th className="px-6 py-4">Last activity</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {investors.map((investor) => (
              <tr key={investor.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">{investor.name}</p>
                </td>
                <td className="px-6 py-5 font-mono text-xs text-muted">
                  {investor.address}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{investor.role}</td>
                <td className="px-6 py-5 text-sm text-foreground">{investor.assetsCount}</td>
                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {formatCurrency(investor.allocation)}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{investor.lastActivity}</td>
                <td className="px-6 py-5">
                  <StatusBadge tone={investorTone(investor.whitelistStatus)}>
                    {investor.whitelistStatus}
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
