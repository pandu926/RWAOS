import { getTransfers } from "@/lib/api";
import { Button, FilterChip, PageHeader, SearchField, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { transferTone } from "@/lib/site-data";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

function formatTransferAmount(transfer: { amount: number; amountVisibility: string }) {
  return transfer.amountVisibility.startsWith("Visible")
    ? formatCurrency(transfer.amount)
    : "Encrypted payload";
}

export default async function TransfersPage() {
  const transfers = await getTransfers();
  const confirmedTransfers = transfers.filter((transfer) => transfer.status === "Confirmed").length;
  const pendingTransfers = transfers.filter((transfer) => transfer.status === "Pending" || transfer.status === "Submitted").length;
  const failedTransfers = transfers.filter((transfer) => transfer.status === "Failed" || transfer.status === "Rejected").length;
  const uniqueAssets = new Set(transfers.map((transfer) => transfer.assetId)).size;
  const uniqueParticipants = new Set(
    transfers
      .flatMap((transfer) => [transfer.from, transfer.to])
      .filter((value) => value && value !== "N/A"),
  ).size;
  const visibleTransfers = transfers.filter((transfer) => transfer.amountVisibility.startsWith("Visible"));
  const visibleVolume = visibleTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Transfer lifecycle"
        title="Transfers"
        description="Confidential transfer history with consistent visibility labels, giving operators and auditors clear context for each event."
        actions={
          <>
            <Button variant="secondary" href="/api/exports/transfers">Export log</Button>
            <Button href="/transfers/new">New transfer</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SectionCard title="Confirmed">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{confirmedTransfers}</p>
          <p className="mt-2 text-sm text-muted">Receipt status success</p>
        </SectionCard>
        <SectionCard title="Pending">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{pendingTransfers}</p>
          <p className="mt-2 text-sm text-muted">Awaiting final on-chain receipt</p>
        </SectionCard>
        <SectionCard title="Failed">
          <p className="text-3xl font-semibold tracking-tight text-foreground">{failedTransfers}</p>
          <p className="mt-2 text-sm text-muted">Receipt status reverted</p>
        </SectionCard>
        <SectionCard title="Coverage">
          <p className="text-3xl font-semibold tracking-tight text-foreground">
            {uniqueAssets}
          </p>
          <p className="mt-2 text-sm text-muted">
            {uniqueParticipants} unique participants, {visibleTransfers.length ? `${formatCurrency(visibleVolume)} visible to this wallet` : "amounts encrypted"}
          </p>
        </SectionCard>
      </div>

      <SectionCard>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-4 md:flex-row">
            <SearchField placeholder="Search transfers..." />
            <div className="flex flex-wrap gap-3">
              <FilterChip>All assets</FilterChip>
              <FilterChip>All statuses</FilterChip>
              <FilterChip>Visibility</FilterChip>
            </div>
          </div>
        </div>
      </SectionCard>

      <SurfaceTable>
        <table className="min-w-[1100px] w-full text-left">
          <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
            <tr>
              <th className="px-6 py-4">Transfer</th>
              <th className="px-6 py-4">Asset</th>
              <th className="px-6 py-4">From</th>
              <th className="px-6 py-4">To</th>
              <th className="px-6 py-4">Confidential amount</th>
              <th className="px-6 py-4">Visibility</th>
              <th className="px-6 py-4">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {transfers.map((transfer) => (
              <tr key={transfer.id} className="hover:bg-surface-soft/80">
                <td className="px-6 py-5">
                  <p className="text-sm font-semibold text-foreground">{transfer.id}</p>
                  <p className="mt-1 text-xs text-muted">{transfer.submittedAt}</p>
                  {transfer.txHash ? (
                    <p className="mt-1 font-mono text-[11px] text-muted">{transfer.txHash}</p>
                  ) : null}
                  {transfer.disclosureDataId ? (
                    <p className="mt-1 font-mono text-[11px] text-muted">Disclosure: {transfer.disclosureDataId}</p>
                  ) : null}
                  {transfer.failureReason ? (
                    <p className="mt-1 text-[11px] text-danger">{transfer.failureReason}</p>
                  ) : null}
                </td>
                <td className="px-6 py-5 text-sm text-foreground">{transfer.assetName}</td>
                <td className="px-6 py-5 font-mono text-xs text-muted">{transfer.from}</td>
                <td className="px-6 py-5 font-mono text-xs text-muted">{transfer.to}</td>
                <td className="px-6 py-5 text-sm font-semibold text-foreground">
                  {formatTransferAmount(transfer)}
                </td>
                <td className="px-6 py-5">
                  <StatusBadge tone={transfer.amountVisibility === "Hidden" ? "warning" : "neutral"}>
                    {transfer.amountVisibility}
                  </StatusBadge>
                </td>
                <td className="px-6 py-5">
                  <StatusBadge tone={transferTone(transfer.status)}>{transfer.status}</StatusBadge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </SurfaceTable>
    </div>
  );
}
