import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { Button, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { getCompliancePassports } from "@/lib/api";
import { shortenAddress } from "@/lib/utils";
import { WALLET_SESSION_COOKIE, parseWalletSession } from "@/lib/web3/session";

export const dynamic = "force-dynamic";

function passportTone(status: string): "success" | "accent" | "neutral" {
  if (status === "Anchored") return "success";
  if (status === "Disclosed to Authorized") return "accent";
  return "neutral";
}

export default async function CompliancePassportsPage() {
  const cookieStore = await cookies();
  const session = parseWalletSession(cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? null);
  if (!session) {
    redirect("/login?next=%2Fcompliance%2Fpassports");
  }

  const passports = await getCompliancePassports();
  const anchored = passports.filter((item) => item.status === "Anchored").length;
  const disclosed = passports.filter((item) => item.status === "Disclosed to Authorized").length;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance Passport"
        title="Passports"
        description="Selective disclosure proofs for confidential transfers. Public ledger keeps privacy while authorized parties get verifiable evidence."
        actions={<Button variant="secondary">Issue passport</Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <SectionCard title="Total passports">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{passports.length}</p>
          <p className="mt-2 text-sm text-muted">Transfer-linked compliance records</p>
        </SectionCard>
        <SectionCard title="Anchored">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{anchored}</p>
          <p className="mt-2 text-sm text-muted">On-chain audit anchor committed</p>
        </SectionCard>
        <SectionCard title="Disclosed to authorized">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{disclosed}</p>
          <p className="mt-2 text-sm text-muted">Scoped disclosure active</p>
        </SectionCard>
      </div>

      <SurfaceTable>
        <table className="min-w-[1100px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Passport</th>
              <th className="px-6 py-4">Transfer</th>
              <th className="px-6 py-4">Policy hash</th>
              <th className="px-6 py-4">Anchor hash</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Created by</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {passports.map((passport) => (
              <tr key={passport.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <Link
                    href={`/compliance/passports/${passport.transferId.replace("TRF-", "")}`}
                    className="text-sm font-semibold text-foreground underline-offset-4 hover:underline"
                  >
                    {passport.id}
                  </Link>
                  <p className="mt-1 text-xs text-muted">{passport.createdAt}</p>
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{passport.transferId}</td>
                <td className="px-6 py-5 font-mono text-xs text-muted">{shortenAddress(passport.policyHash)}</td>
                <td className="px-6 py-5 font-mono text-xs text-muted">{shortenAddress(passport.anchorHash)}</td>
                <td className="px-6 py-5">
                  <StatusBadge tone={passportTone(passport.status)}>{passport.status}</StatusBadge>
                </td>
                <td className="px-6 py-5 text-sm text-foreground">
                  {passport.createdBy} ({passport.createdByRole})
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
