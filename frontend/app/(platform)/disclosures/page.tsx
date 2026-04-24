import { disclosureTone } from "@/lib/site-data";
import { getDisclosures } from "@/lib/api";
import { Button, FilterChip, InlineNotice, PageHeader, SearchField, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function DisclosuresPage() {
  const disclosures = await getDisclosures();
  const active = disclosures.filter((item) => item.status === "Active").length;
  const revoked = disclosures.filter((item) => item.status === "Revoked").length;
  const assetsCovered = new Set(disclosures.map((item) => item.assetId)).size;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access governance"
        title="Disclosures"
        description="Manage grant and revoke access to sensitive data using consistent terminology, status semantics, and information architecture across operational pages."
        actions={
          <>
            <Button variant="secondary">Export grants</Button>
            <Button>Grant access</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Active grants">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{active}</p>
          <p className="mt-2 text-sm text-muted">Currently visible to grantees</p>
        </SectionCard>
        <SectionCard title="Assets covered">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{assetsCovered}</p>
          <p className="mt-2 text-sm text-muted">Mapped to disclosure scopes</p>
        </SectionCard>
        <SectionCard title="Revoked">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{revoked}</p>
          <p className="mt-2 text-sm text-muted">No longer active</p>
        </SectionCard>
        <SectionCard title="Recent changes">
          <p className="text-3xl font-semibold tracking-tight text-foreground">3</p>
          <p className="mt-2 text-sm text-muted">Last 24 hours</p>
        </SectionCard>
      </div>

      <InlineNotice
        title="Why this page matters"
        description="Disclosure flow must remain clear because it is a core product value: privacy is preserved while auditability remains intact."
      />

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <SearchField placeholder="Search grants..." />
            <div className="flex flex-wrap gap-3">
              <FilterChip>Active</FilterChip>
              <FilterChip>Scope</FilterChip>
              <FilterChip>Asset</FilterChip>
            </div>
          </div>
        </div>
      </SectionCard>

      <SurfaceTable>
        <table className="min-w-[1100px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Grantee</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">Scope</th>
              <th className="px-6 py-4">Granted by</th>
              <th className="px-6 py-4">Granted at</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {disclosures.map((item) => (
              <tr key={item.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">{item.grantee}</p>
                  <p className="mt-1 font-mono text-xs text-muted">{item.granteeAddress}</p>
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{item.assetName}</td>
                <td className="px-6 py-5 text-sm text-foreground">{item.scope}</td>
                <td className="px-6 py-5 text-sm text-foreground">{item.grantedBy}</td>
                <td className="px-6 py-5 text-sm text-foreground">{item.grantedAt}</td>
                <td className="px-6 py-5">
                  <StatusBadge tone={disclosureTone(item.status)}>{item.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
