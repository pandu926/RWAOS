import { getDashboardData } from "@/lib/api";
import { Icon } from "@/components/icons";
import { Button, InlineNotice, PageHeader, SectionCard, StatCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { auditTone, transferTone } from "@/lib/site-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const {
    metrics: dashboardMetrics,
    alerts: dashboardAlerts,
    transfers,
    auditEvents,
  } = await getDashboardData();
  const hasLiveData = transfers.length > 0 || auditEvents.length > 0;
  const healthStatus = hasLiveData
    ? "Live data"
    : "No records";
  const latestAuditAt = auditEvents.at(-1)?.timestamp ?? "No audit events yet";
  const uniqueTransferAssets = new Set(transfers.map((item) => item.assetId)).size;
  const uniqueAuditActors = new Set(auditEvents.map((item) => item.actor)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Operations overview"
        title="Dashboard"
        description="Operational summary for confidential assets, active transfers, disclosure scope, and the organization’s audit posture."
        meta={<StatusBadge tone={healthStatus === "Live data" ? "success" : "warning"}>{healthStatus}</StatusBadge>}
        actions={
          <>
            <Button href="/disclosures" variant="secondary">
              Review disclosures
            </Button>
            <Button href="/transfers/new">Create transfer</Button>
          </>
        }
      />

      <InlineNotice
        title="Live backend snapshot"
        description={`Transfers: ${transfers.length}. Audit events: ${auditEvents.length}. Latest audit timestamp: ${latestAuditAt}.`}
        tone="neutral"
        icon="alert"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {dashboardMetrics.map((metric) => (
          <StatCard key={metric.title} {...metric} />
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <SectionCard
          title="Operations queue"
          description="Highest-priority actions affecting transfer execution, compliance, and demonstration readiness."
          action={<Button href="/audit" variant="secondary">Open audit trail</Button>}
        >
          <div className="space-y-4">
            {dashboardAlerts.map((alert) => (
              <div key={alert} className="flex gap-4 rounded-2xl bg-surface-soft p-4">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-warning-soft text-warning shadow-sm">
                  <span className="sr-only">Alert priority</span>
                  <Icon name="alert" className="size-4" />
                </div>
                <p className="text-sm leading-6 text-foreground">{alert}</p>
              </div>
            ))}
          </div>
        </SectionCard>

        <SectionCard
          title="Compliance posture"
          description="Critical compliance signals that must be visible immediately after sign-in."
        >
          <div className="space-y-5">
            <div className="rounded-2xl bg-primary p-5 text-primary-foreground">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/60">
                Data readiness
              </p>
              <p className="mt-3 text-3xl font-semibold">{healthStatus}</p>
              <p className="mt-2 text-sm leading-6 text-white/72">
                Snapshot derived from currently reachable backend endpoints without client-side fabrication.
              </p>
            </div>
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-soft px-4 py-3">
                <span className="text-sm text-muted">Assets represented in transfers</span>
                <StatusBadge tone="accent">{uniqueTransferAssets}</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-soft px-4 py-3">
                <span className="text-sm text-muted">Unique audit actors</span>
                <StatusBadge tone="neutral">{uniqueAuditActors}</StatusBadge>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-border bg-surface-soft px-4 py-3">
                <span className="text-sm text-muted">Latest audit event</span>
                <StatusBadge tone="neutral">{latestAuditAt}</StatusBadge>
              </div>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_.75fr]">
        <SurfaceTable>
          <table className="min-w-[760px] w-full text-left">
            <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              <tr>
                <th className="px-6 py-4">Transfer</th>
                <th className="px-6 py-4">Asset</th>
                <th className="px-6 py-4">Amount</th>
                <th className="px-6 py-4">Visibility</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {transfers.slice(0, 4).map((transfer) => (
                <tr key={transfer.id} className="hover:bg-surface-soft/80">
                  <td className="px-6 py-4">
                    <p className="text-sm font-semibold text-foreground">{transfer.id}</p>
                    <p className="mt-1 text-xs text-muted">{transfer.submittedAt}</p>
                  </td>
                  <td className="px-6 py-4 text-sm text-foreground">{transfer.assetName}</td>
                  <td className="px-6 py-4 text-sm font-semibold text-foreground">
                    {formatCurrency(transfer.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone="neutral">{transfer.amountVisibility}</StatusBadge>
                  </td>
                  <td className="px-6 py-4">
                    <StatusBadge tone={transferTone(transfer.status)}>{transfer.status}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SurfaceTable>

        <SectionCard title="Audit pulse" description="Recent events that reinforce trust and compliance posture.">
          <div className="space-y-4">
            {auditEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-foreground">{event.eventType}</p>
                    <p className="text-xs text-muted">{event.target}</p>
                  </div>
                  <StatusBadge tone={auditTone(event.result)}>{event.result}</StatusBadge>
                </div>
                <p className="mt-3 text-xs text-muted">
                  {event.actor} • {event.timestamp}
                </p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
