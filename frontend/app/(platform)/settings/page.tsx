import { settingsData } from "@/lib/site-data";
import { DetailList, InlineNotice, PageHeader, SectionCard, SurfaceTable } from "@/components/ui";
import {
  chainConfig,
  contractAddresses,
  getContractAbi,
  validatePublicWeb3Config,
} from "@/lib/web3/contracts";

export const dynamic = "force-dynamic";

export default function SettingsPage() {
  const web3Validation = validatePublicWeb3Config();
  const contractSummary = [
    {
      label: "Confidential RWA Token",
      address: contractAddresses.confidentialRwaToken,
      abiItems: getContractAbi("confidentialRwaToken").length,
    },
    {
      label: "Disclosure Registry",
      address: contractAddresses.disclosureRegistry,
      abiItems: getContractAbi("disclosureRegistry").length,
    },
    {
      label: "Transfer Controller",
      address: contractAddresses.transferController,
      abiItems: getContractAbi("transferController").length,
    },
    {
      label: "Audit Anchor",
      address: contractAddresses.auditAnchor,
      abiItems: getContractAbi("auditAnchor").length,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="System configuration"
        title="Settings"
        description="Organization configuration, role matrix, and system posture for this Confidential RWA OS instance."
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <SectionCard title="Organization settings" description="Static configuration summary for the dummy environment.">
            <DetailList
              items={[
                { label: "Organization", value: "Global Asset Custody Ltd." },
                { label: "Environment", value: settingsData.organizationSettings.environment },
                { label: "Support contact", value: settingsData.organizationSettings.supportEmail },
                { label: "Retention policy", value: settingsData.organizationSettings.retentionPolicy },
                { label: "Privacy mode", value: settingsData.organizationSettings.privacyMode },
              ]}
            />
          </SectionCard>

          <SurfaceTable>
            <table className="min-w-[780px] w-full text-left">
              <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
                <tr>
                  <th className="px-6 py-4">Role</th>
                  <th className="px-6 py-4">Permissions</th>
                  <th className="px-6 py-4">Members</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settingsData.roles.map((role) => (
                  <tr key={role.name} className="hover:bg-surface-soft/80">
                    <td className="px-6 py-5 text-sm font-semibold text-foreground">{role.name}</td>
                    <td className="px-6 py-5 text-sm text-foreground">{role.description}</td>
                    <td className="px-6 py-5 text-sm text-foreground">{role.members}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </SurfaceTable>
        </div>

        <div className="space-y-6">
          <SectionCard title="System" description="Health and network posture for operators and administrators.">
            <div className="space-y-4 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Active network</span>
                <span className="font-medium text-foreground">{settingsData.network.chain}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Settlement time</span>
                <span className="font-medium text-foreground">{settingsData.network.settlementTime}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Privacy method</span>
                <span className="font-medium text-foreground">{settingsData.network.privacyMethod}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-muted">System health</span>
                  <span className="font-medium text-foreground">
                    {settingsData.network.systemHealth}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-soft">
                  <div className="h-2 rounded-full bg-success" style={{ width: `${settingsData.network.systemHealth}%` }} />
                </div>
              </div>
            </div>
          </SectionCard>

          <InlineNotice
            title="Security note"
            description="Configuration access is restricted to high-clearance roles. In backend implementation, all sensitive setting changes must always generate audit events."
          />

          <SectionCard title="On-chain deployment" description="Arbitrum Sepolia contracts and ABI integration state for frontend runtime.">
            <div className="space-y-4">
              <div className="grid gap-3 rounded-2xl border border-border bg-surface-soft p-4 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Chain ID</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">{chainConfig.chainId}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">RPC endpoint</p>
                  <p className="mt-1 truncate text-sm font-semibold text-foreground">{chainConfig.rpcUrl}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">Config status</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    {web3Validation.ok ? "Ready" : "Needs env fix"}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-muted">ABI source</p>
                  <p className="mt-1 text-sm font-semibold text-foreground">/lib/web3/abi</p>
                </div>
              </div>
              <div className="space-y-3">
                {contractSummary.map((contract) => (
                  <div
                    key={contract.label}
                    className="rounded-2xl border border-border bg-surface-soft px-4 py-3"
                  >
                    <p className="text-sm font-semibold text-foreground">{contract.label}</p>
                    <p className="mt-1 break-all font-mono text-xs text-muted">{contract.address}</p>
                    <p className="mt-2 text-xs text-muted">ABI entries: {contract.abiItems}</p>
                  </div>
                ))}
              </div>
              {!web3Validation.ok && (
                <InlineNotice
                  title="Environment incomplete"
                  description={`Missing: ${web3Validation.missing.join(", ") || "-"} | Invalid: ${web3Validation.invalid.join(", ") || "-"}`}
                  tone="warning"
                />
              )}
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
