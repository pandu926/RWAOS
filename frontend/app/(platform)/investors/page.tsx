import { getInvestors } from "@/lib/api";
import { Button, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function InvestorsPage() {
  const investors = await getInvestors();
  const mappedWallets = investors.filter((investor) => investor.walletMapped).length;
  const missingWallets = investors.length - mappedWallets;
  const initialHolders = investors.filter((investor) => investor.initialHolderAssetsCount > 0).length;
  const usedInTransfers = investors.filter(
    (investor) => investor.sentTransfers > 0 || investor.receivedTransfers > 0,
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investor directory"
        title="Investors"
        description="Investor records map a legal entity to a wallet address. Transfer, disclosure, and passport flows reuse this mapping so users do not need to type raw addresses on every operation."
        meta={<StatusBadge tone="accent">{investors.length} tracked</StatusBadge>}
        actions={
          <>
            <Button variant="secondary" href="/api/exports/investor-template">Import addresses</Button>
            <Button href="/investors/new">Add investor</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Wallet mapped">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{mappedWallets}</p>
          <p className="mt-2 text-sm text-muted">Ready for transfer activity</p>
        </SectionCard>
        <SectionCard title="Missing wallet">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{missingWallets}</p>
          <p className="mt-2 text-sm text-muted">Cannot be used as sender/recipient until mapped</p>
        </SectionCard>
        <SectionCard title="Initial holders">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{initialHolders}</p>
          <p className="mt-2 text-sm text-muted">Wallets that received initial confidential issuance</p>
        </SectionCard>
        <SectionCard title="Used in transfers">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{usedInTransfers}</p>
          <p className="mt-2 text-sm text-muted">Already referenced by at least one transfer record</p>
        </SectionCard>
      </div>

      <SectionCard title="How this page is used" description="Keep the registry aligned with actual on-chain holder wallets.">
        <div className="grid gap-3 text-sm text-muted md:grid-cols-3">
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="font-semibold text-foreground">Asset issuance</p>
            <p className="mt-2">If an asset is minted to a wallet, create or update the investor record with that same wallet. The first transfer must originate from that mapped holder.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="font-semibold text-foreground">Disclosure</p>
            <p className="mt-2">Disclosure grantee selection can prefill wallet addresses from this registry, but the wallet still needs to be correct for the caller or recipient.</p>
          </div>
          <div className="rounded-2xl border border-border bg-surface-soft p-4">
            <p className="font-semibold text-foreground">Transfers and passports</p>
            <p className="mt-2">Transfer sender/recipient and passport context use investor IDs from this registry, then resolve to wallet mappings for on-chain actions.</p>
          </div>
        </div>
      </SectionCard>

      <SurfaceTable>
        <table className="min-w-[1100px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Investor</th>
              <th className="px-6 py-4">Wallet mapping</th>
              <th className="px-6 py-4">Jurisdiction</th>
              <th className="px-6 py-4">Initial holder</th>
              <th className="px-6 py-4">Transfer usage</th>
              <th className="px-6 py-4">Disclosure grants</th>
              <th className="px-6 py-4">Readiness</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {investors.map((investor) => (
              <tr key={investor.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">{investor.name}</p>
                  <p className="mt-1 text-xs text-muted">{investor.lastActivity}</p>
                </td>
                <td className="px-6 py-5 font-mono text-xs text-muted">
                  {investor.walletMapped ? investor.address : "Wallet not mapped"}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{investor.jurisdiction}</td>
                <td className="px-6 py-5 text-sm text-foreground">
                  {investor.initialHolderAssetsCount > 0
                    ? `${investor.initialHolderAssetsCount} asset${investor.initialHolderAssetsCount === 1 ? "" : "s"}`
                    : "No"}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">
                  <span className="font-semibold">{investor.sentTransfers}</span>
                  {" sent / "}
                  <span className="font-semibold">{investor.receivedTransfers}</span>
                  {" received"}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{investor.disclosureGrants}</td>
                <td className="px-6 py-5">
                  <StatusBadge tone={investor.walletMapped ? "success" : "warning"}>
                    {investor.readiness}
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
