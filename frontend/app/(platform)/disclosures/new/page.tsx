"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, type Address } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";

import {
  TARGET_CHAIN_ID,
  decodeWeb3FlowError,
  formatUnixTimestamp,
  isBytes32Hex,
  runOptionalWeb3Precheck,
  type OptionalWeb3FlowAdapter,
} from "@/app/_lib/onchain-flow";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { contractAddresses, getContractAbi } from "@/lib/web3/contracts";

type Envelope = { success: boolean; error?: string | null };

type InvestorOption = {
  id: number;
  name: string;
  wallet_address: string | null;
};

type OptionsEnvelope = {
  success: boolean;
  data?: {
    assets: Array<{ id: number; name: string }>;
    investors: InvestorOption[];
    transfers: Array<unknown>;
  };
  error?: string | null;
};

type DisclosurePrecheckInput = {
  disclosure_data_id: `0x${string}`;
  grantee_wallet: `0x${string}`;
  expires_at_unix: number;
  title: string;
};

type DisclosureResult = {
  txHash: string;
  disclosureDataId: string;
  granteeWallet: string;
  granteeName: string;
  expiresAtUnix: number;
};

const disclosureFlowAdapter: OptionalWeb3FlowAdapter<DisclosurePrecheckInput> | undefined = undefined;

export default function NewDisclosurePage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [assets, setAssets] = useState<Array<{ id: number; name: string }>>([]);
  const [investors, setInvestors] = useState<InvestorOption[]>([]);
  const [assetId, setAssetId] = useState(0);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [disclosureDataId, setDisclosureDataId] = useState("");
  const [granteeInvestorId, setGranteeInvestorId] = useState(0);
  const [granteeWalletOverride, setGranteeWalletOverride] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<DisclosureResult | null>(null);
  const [currentUnix] = useState(() => Math.floor(Date.now() / 1000));

  const selectedInvestor = investors.find((investor) => investor.id === granteeInvestorId) ?? null;
  const granteeWallet = granteeWalletOverride || selectedInvestor?.wallet_address || "";
  const disclosureDataIdTrimmed = disclosureDataId.trim();
  const disclosureDataIdValid = isBytes32Hex(disclosureDataIdTrimmed);
  const granteeWalletTrimmed = granteeWallet.trim();
  const granteeValid = isAddress(granteeWalletTrimmed);
  const expiresAtValue = Number(expiresAt);
  const expiresAtValid = Number.isInteger(expiresAtValue) && expiresAtValue > 0;
  const hasWallet = Boolean(address);
  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const expiresInFuture = expiresAtValid && expiresAtValue > currentUnix;
  const formReady = Boolean(assetId) && Boolean(title.trim()) && Boolean(content.trim()) && disclosureDataIdValid && granteeValid && expiresInFuture;
  const readinessItems = [
    {
      label: "Wallet",
      ready: hasWallet,
      detail: hasWallet ? "Wallet connected." : "Connect wallet before granting disclosure.",
    },
    {
      label: "Network",
      ready: onTargetChain,
      detail: onTargetChain ? "Arbitrum Sepolia active." : "Switch wallet to Arbitrum Sepolia.",
    },
    {
      label: "Grantee wallet",
      ready: granteeValid,
      detail: granteeValid ? "Grantee wallet is valid." : "Select investor with wallet mapping or enter valid wallet.",
    },
    {
      label: "Disclosure ID",
      ready: disclosureDataIdValid,
      detail: disclosureDataIdValid ? "Bytes32 disclosure ID is ready." : "Disclosure data ID must be bytes32.",
    },
    {
      label: "Expiry",
      ready: expiresInFuture,
      detail: expiresInFuture ? "Grant expiry is in the future." : "Expiry must be a future UNIX timestamp.",
    },
  ];

  const granteeWalletHint = useMemo(() => {
    if (selectedInvestor?.wallet_address) {
      return `Auto-filled from investor #${selectedInvestor.id} wallet mapping.`;
    }
    if (selectedInvestor) {
      return `Investor #${selectedInvestor.id} has no wallet mapping yet. Enter wallet manually for the on-chain grant.`;
    }
    return "Select investor to reuse backend wallet mapping.";
  }, [selectedInvestor]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/transfer-form-options", { cache: "no-store" });
        const payload = (await response.json()) as OptionsEnvelope;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Failed to load disclosure form options.");
        }
        if (!active) {
          return;
        }
        setAssets(payload.data.assets);
        setInvestors(payload.data.investors);
        setAssetId(payload.data.assets[0]?.id || 0);
        const preferredInvestor = payload.data.investors.find((investor) => investor.wallet_address) ?? payload.data.investors[0];
        setGranteeInvestorId(preferredInvestor?.id || 0);
        setExpiresAt((current) => current || String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30));
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(decodeWeb3FlowError(loadError, "Failed to load disclosure form options."));
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, []);

  async function submit() {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!assetId || !title.trim() || !content.trim()) {
      setError("Asset, title, and content are required.");
      return;
    }
    if (!hasWallet || !address) {
      setError("Connect wallet before granting disclosure.");
      return;
    }
    if (!disclosureDataIdValid) {
      setError("Disclosure data ID must be bytes32 (`0x` + 64 hex chars).");
      return;
    }
    if (!granteeValid) {
      setError("Grantee wallet must be a valid EVM address.");
      return;
    }
    if (!expiresAtValid || !expiresInFuture) {
      setError("Expiry must be a future UNIX timestamp.");
      return;
    }

    setBusy(true);
    try {
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }

      const prechecked = await runOptionalWeb3Precheck(disclosureFlowAdapter, {
        disclosure_data_id: disclosureDataIdTrimmed as `0x${string}`,
        grantee_wallet: granteeWalletTrimmed as `0x${string}`,
        expires_at_unix: expiresAtValue,
        title: title.trim(),
      });

      const disclosureTxHash = await writeContractAsync({
        address: contractAddresses.disclosureRegistry,
        abi: getContractAbi("disclosureRegistry"),
        functionName: "grantDisclosure",
        args: [
          prechecked.disclosure_data_id,
          prechecked.grantee_wallet as Address,
          BigInt(prechecked.expires_at_unix),
          prechecked.title,
        ],
        chainId: TARGET_CHAIN_ID,
      });

      const response = await fetch("/api/disclosures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          asset_id: assetId,
          title: title.trim(),
          content: content.trim(),
          ...(granteeInvestorId > 0 ? { grantee_investor_id: granteeInvestorId } : {}),
          grantee_wallet_address: prechecked.grantee_wallet,
          disclosure_data_id: prechecked.disclosure_data_id,
          expires_at_unix: prechecked.expires_at_unix,
          grant_tx_hash: disclosureTxHash,
        }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(`${payload.error || "Failed to create disclosure."} Grant tx: ${disclosureTxHash}`);
      }

      setSuccess("Disclosure record created and on-chain grant submitted.");
      setResult({
        txHash: disclosureTxHash,
        disclosureDataId: prechecked.disclosure_data_id,
        granteeWallet: prechecked.grantee_wallet,
        granteeName: selectedInvestor?.name || `Investor #${granteeInvestorId}`,
        expiresAtUnix: prechecked.expires_at_unix,
      });
    } catch (submitError) {
      setError(decodeWeb3FlowError(submitError, "Failed to create disclosure.", disclosureFlowAdapter));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Access governance"
        title="Grant access"
        description="Create the backend disclosure record and submit the on-chain grant with investor wallet mapping when available."
        meta={<StatusBadge tone={formReady && hasWallet && onTargetChain ? "success" : "warning"}>{formReady && hasWallet && onTargetChain ? "Ready to grant" : "Needs input"}</StatusBadge>}
      />
      <SectionCard title="Disclosure form" description="Wallet fields are reduced to investor selection first. Manual wallet input remains as fallback when the mapping is missing.">
        <div className="grid gap-4">
          <select
            value={assetId}
            onChange={(event) => setAssetId(Number(event.target.value))}
            disabled={loadingOptions || !assets.length}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          >
            {assets.map((asset) => (
              <option key={asset.id} value={asset.id}>{asset.name}</option>
            ))}
          </select>
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Disclosure title"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Disclosure content"
            rows={4}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <select
            value={granteeInvestorId}
            onChange={(event) => {
              setGranteeInvestorId(Number(event.target.value));
              setGranteeWalletOverride("");
            }}
            disabled={loadingOptions || !investors.length}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          >
            {investors.map((investor) => (
              <option key={investor.id} value={investor.id}>{`#${investor.id} - ${investor.name}`}</option>
            ))}
          </select>
          <div className="space-y-2">
            <input
              value={granteeWallet}
              onChange={(event) => setGranteeWalletOverride(event.target.value)}
              placeholder="Grantee wallet (0x...)"
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
            />
            <p className="text-xs leading-5 text-muted">{granteeWalletHint}</p>
          </div>
          <input
            value={disclosureDataId}
            onChange={(event) => setDisclosureDataId(event.target.value)}
            placeholder="Disclosure data ID (bytes32)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
          />
          <input
            value={expiresAt}
            onChange={(event) => setExpiresAt(event.target.value)}
            placeholder="Expiry UNIX timestamp (e.g. 1767225600)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => setExpiresAt(String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 7))}>Set +7 days</Button>
            <Button type="button" variant="secondary" onClick={() => setExpiresAt(String(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30))}>Set +30 days</Button>
            <p className="text-xs leading-5 text-muted">Grant on-chain akan memakai timestamp ini apa adanya. Pilih expiry yang masih berlaku saat demo.</p>
          </div>
          <div className="flex gap-3">
            <Button onClick={() => void submit()} disabled={busy || loadingOptions}>{busy ? "Creating..." : "Create disclosure"}</Button>
            <Button variant="secondary" href="/disclosures">Cancel</Button>
          </div>
          {!hasWallet ? <p className="text-sm text-danger">Wallet not connected.</p> : null}
          {hasWallet && !onTargetChain ? <p className="text-sm text-danger">Wrong network. Use Arbitrum Sepolia.</p> : null}
        </div>
      </SectionCard>
      {error ? <InlineNotice title="Create disclosure failed" description={error} tone="danger" /> : null}
      {success ? <InlineNotice title="Disclosure submitted" description={success} tone="success" /> : null}
      {result ? (
        <SectionCard title="On-chain grant summary" description="Backend disclosure metadata is now stored, and the same grant fields are surfaced here immediately after submission.">
          <DetailList
            items={[
              { label: "Grant tx hash", value: <span className="font-mono text-xs">{result.txHash}</span> },
              { label: "Disclosure data ID", value: <span className="font-mono text-xs">{result.disclosureDataId}</span> },
              { label: "Grantee", value: result.granteeName },
              { label: "Grantee wallet", value: <span className="font-mono text-xs">{result.granteeWallet}</span> },
              { label: "Expiry", value: formatUnixTimestamp(result.expiresAtUnix) },
            ]}
          />
          <div className="mt-5 flex gap-3">
            <Button href="/disclosures">View disclosures</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Create another disclosure</Button>
          </div>
        </SectionCard>
      ) : null}
      <SectionCard title="Readiness" description="Checklist ini memperjelas blocker sebelum grant dikirim saat demo.">
        <div className="grid gap-3 md:grid-cols-2">
          {readinessItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-surface-soft p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-foreground">{item.label}</span>
                <StatusBadge tone={item.ready ? "success" : "warning"}>{item.ready ? "Ready" : "Blocked"}</StatusBadge>
              </div>
              <p className="mt-2 text-xs leading-5 text-muted">{item.detail}</p>
            </div>
          ))}
        </div>
      </SectionCard>
      <InlineNotice
        title="Future helper seam"
        description="This page already routes pre-check and error decoding through a local adapter seam so shared frontend/lib/web3 helpers can replace it later without rewriting the form."
        tone="neutral"
      />
    </div>
  );
}
