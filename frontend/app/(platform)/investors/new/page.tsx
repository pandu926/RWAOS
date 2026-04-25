"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { isAddress } from "viem";

import { decodeWeb3FlowError } from "@/app/_lib/onchain-flow";
import { Button, InlineNotice, PageHeader, SectionCard } from "@/components/ui";

type Envelope = { success: boolean; error?: string | null };

export default function NewInvestorPage() {
  const router = useRouter();
  const [legalName, setLegalName] = useState("");
  const [jurisdiction, setJurisdiction] = useState("US");
  const [walletAddress, setWalletAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);

    const legalNameTrimmed = legalName.trim();
    const jurisdictionTrimmed = jurisdiction.trim().toUpperCase();
    const walletAddressTrimmed = walletAddress.trim();

    if (!legalNameTrimmed) {
      setError("Legal name is required.");
      return;
    }
    if (!jurisdictionTrimmed) {
      setError("Jurisdiction code is required.");
      return;
    }
    if (walletAddressTrimmed && !isAddress(walletAddressTrimmed)) {
      setError("Wallet address must be a valid EVM address in `0x...` format.");
      return;
    }

    setBusy(true);
    try {
      const response = await fetch("/api/investors", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          legal_name: legalNameTrimmed,
          jurisdiction: jurisdictionTrimmed,
          ...(walletAddressTrimmed ? { wallet_address: walletAddressTrimmed } : {}),
        }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create investor.");
      }
      router.push("/investors");
      router.refresh();
    } catch (submitError) {
      setError(decodeWeb3FlowError(submitError, "Failed to create investor."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Investor directory"
        title="Invite investor"
        description="Create a new investor in the backend registry, with optional wallet mapping for downstream transfer, disclosure, and passport flows."
      />
      <SectionCard title="Investor form" description="Wallet address is optional, but adding it removes manual wallet entry in later operational flows.">
        <div className="grid gap-4">
          <input
            value={legalName}
            onChange={(event) => setLegalName(event.target.value)}
            placeholder="Legal name"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <input
            value={jurisdiction}
            onChange={(event) => setJurisdiction(event.target.value.toUpperCase())}
            placeholder="Jurisdiction code (e.g. US)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <div className="space-y-2">
            <input
              value={walletAddress}
              onChange={(event) => setWalletAddress(event.target.value)}
              placeholder="Wallet address (optional, 0x...)"
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
            />
            <p className="text-xs leading-5 text-muted">
              Stored as investor wallet mapping and reused by transfer, disclosure, and passport forms.
            </p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => void submit()} disabled={busy}>
              {busy ? "Creating..." : "Create investor"}
            </Button>
            <Button variant="secondary" href="/investors">Cancel</Button>
          </div>
        </div>
      </SectionCard>
      {error ? <InlineNotice title="Create investor failed" description={error} tone="danger" /> : null}
    </div>
  );
}
