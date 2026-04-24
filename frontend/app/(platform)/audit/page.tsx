import { auditTone } from "@/lib/site-data";
import { getAuditEvents } from "@/lib/api";
import { Button, FilterChip, InlineNotice, PageHeader, SearchField, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const auditEvents = await getAuditEvents();
  const verified = auditEvents.filter((item) => item.result === "Verified").length;
  const reviewRequired = auditEvents.filter((item) => item.result === "Review required").length;
  const rejected = auditEvents.filter((item) => item.result === "Rejected").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Evidence trail"
        title="Audit"
        description="Operational audit trail that remains readable for auditors without compromising the product’s confidentiality model."
        actions={
          <>
            <Button variant="secondary">Export evidence</Button>
            <Button>Verify bundle</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Verified">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{verified}</p>
          <p className="mt-2 text-sm text-muted">Proofs that passed validation</p>
        </SectionCard>
        <SectionCard title="Review required">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{reviewRequired}</p>
          <p className="mt-2 text-sm text-muted">Need operator or auditor attention</p>
        </SectionCard>
        <SectionCard title="Rejected">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{rejected}</p>
          <p className="mt-2 text-sm text-muted">Policy or integrity mismatch</p>
        </SectionCard>
        <SectionCard title="Proof freshness">
          <p className="text-3xl font-semibold tracking-tight text-foreground">4m</p>
          <p className="mt-2 text-sm text-muted">Last bundle update latency</p>
        </SectionCard>
      </div>

      <InlineNotice
        title="Auditability without full exposure"
        description="Events are segmented with consistent visibility labels: Confidential, Restricted, or Visible to authorized users only."
      />

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <SearchField placeholder="Search audit events..." />
            <div className="flex flex-wrap gap-3">
              <FilterChip>Result</FilterChip>
              <FilterChip>Actor</FilterChip>
              <FilterChip>Visibility</FilterChip>
            </div>
          </div>
        </div>
      </SectionCard>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <SurfaceTable>
          <table className="min-w-[980px] w-full text-left">
            <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              <tr>
                <th className="px-6 py-4">Event</th>
                <th className="px-6 py-4">Actor</th>
                <th className="px-6 py-4">Target</th>
                <th className="px-6 py-4">Visibility</th>
                <th className="px-6 py-4">Result</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {auditEvents.map((item) => (
                <tr key={item.id} className="hover:bg-surface-soft/80">
                  <td className="px-6 py-5">
                    <p className="text-sm font-semibold text-foreground">{item.eventType}</p>
                    <p className="mt-1 text-xs text-muted">{item.timestamp}</p>
                  </td>
                  <td className="px-6 py-5 text-sm text-foreground">{item.actor}</td>
                  <td className="px-6 py-5 text-sm text-foreground">{item.target}</td>
                  <td className="px-6 py-5">
                    <StatusBadge tone="accent">{item.visibility}</StatusBadge>
                  </td>
                  <td className="px-6 py-5">
                    <StatusBadge tone={auditTone(item.result)}>{item.result}</StatusBadge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SurfaceTable>

        <SectionCard title="Verification bundle" description="Context required by auditors to review logs quickly.">
          <div className="space-y-4">
            {auditEvents.slice(0, 3).map((event) => (
              <div key={event.id} className="rounded-2xl border border-border bg-surface-soft p-4">
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm font-semibold text-foreground">{event.reference}</p>
                  <StatusBadge tone={auditTone(event.result)}>{event.result}</StatusBadge>
                </div>
                <p className="mt-2 text-sm leading-6 text-muted">{event.target}</p>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </div>
  );
}
