"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, isHex, type Address } from "viem";
import { useAccount, useChainId, useSwitchChain, useWalletClient, useWriteContract } from "wagmi";

import { TARGET_CHAIN_ID, decodeWeb3FlowError, isBytes32Hex } from "@/app/_lib/onchain-flow";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { web3PublicClient } from "@/lib/web3/client";
import { getContractAbi } from "@/lib/web3/contracts";
import { computeAssetAnchorHash } from "@/lib/web3/domain-hashes";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof, getProofReadinessItems } from "@/lib/web3/proof";
import { fetchTenantBundleRuntime, type TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";

type Envelope = {
  success: boolean;
  error?: string | null;
  data?: {
    id: number;
    name: string;
    asset_type: string;
    metadata_uri?: string | null;
    issuance_wallet?: string | null;
    initial_supply?: number | null;
    anchor_hash?: string | null;
    anchor_tx_hash?: string | null;
    issuance_tx_hash?: string | null;
  };
};

type TransferFormOptionsEnvelope = {
  success: boolean;
  data?: {
    investors: Array<{
      id: number;
      name: string;
      wallet_address: string | null;
    }>;
  };
  error?: string | null;
};

type AssetCreationResult = {
  assetId: number;
  anchorHash: string;
  anchorTxHash: string;
  issuanceTxHash: string;
  beneficiaryWallet: string;
  initialSupply: string;
  metadataUri: string;
  holderInvestorId: number | null;
  holderInvestorCreated: boolean;
};

function defaultMetadataUri(name: string, assetType: string): string {
  const normalized = `${name.trim()}-${assetType.trim()}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized ? `asset://${normalized}` : "asset://new-issuance";
}

async function ensureHolderInvestorMapping(params: {
  assetName: string;
  beneficiaryWallet: string;
}): Promise<{ investorId: number | null; created: boolean }> {
  const normalizedWallet = params.beneficiaryWallet.trim().toLowerCase();
  const optionsResponse = await fetch("/api/transfer-form-options", { cache: "no-store" });
  const optionsPayload = (await optionsResponse.json()) as TransferFormOptionsEnvelope;
  if (optionsResponse.ok && optionsPayload.success && optionsPayload.data) {
    const existing = optionsPayload.data.investors.find(
      (investor) => investor.wallet_address?.trim().toLowerCase() === normalizedWallet,
    );
    if (existing) {
      return { investorId: existing.id, created: false };
    }
  }

  const response = await fetch("/api/investors", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      legal_name: `Initial Holder - ${params.assetName}`,
      jurisdiction: "US",
      wallet_address: normalizedWallet,
    }),
  });
  const payload = (await response.json()) as { success: boolean; data?: { id?: number }; error?: string | null };
  if (!response.ok || !payload.success) {
    throw new Error(payload.error || "Failed to create investor mapping for the issuance holder.");
  }

  return { investorId: payload.data?.id ?? null, created: true };
}

export default function NewAssetPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("fund");
  const [initialSupply, setInitialSupply] = useState("25000");
  const [beneficiaryWallet, setBeneficiaryWallet] = useState("");
  const [metadataUri, setMetadataUri] = useState("");
  const [encryptedAmount, setEncryptedAmount] = useState("");
  const [inputProof, setInputProof] = useState("");
  const [proofForKey, setProofForKey] = useState<string | null>(null);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [busy, setBusy] = useState(false);
  const [runtimeLoading, setRuntimeLoading] = useState(true);
  const [runtime, setRuntime] = useState<TenantBundleRuntime>({
    state: "missing",
    configured: false,
    bundle: null,
    error: null,
  });
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AssetCreationResult | null>(null);

  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const ownerWallet = runtime.bundle?.ownerWallet ?? null;
  const runtimeContracts = runtime.bundle?.contracts ?? null;
  const tenantReady =
    runtime.state === "configured" &&
    runtime.bundle?.chainId === TARGET_CHAIN_ID &&
    runtime.bundle.mode === "tenant-factory";

  const nameTrimmed = name.trim();
  const metadataUriTrimmed = metadataUri.trim() || defaultMetadataUri(nameTrimmed, assetType);
  const initialSupplyTrimmed = initialSupply.trim();
  const initialSupplyBigInt = /^\d+$/.test(initialSupplyTrimmed) ? BigInt(initialSupplyTrimmed) : null;
  const amountValid = initialSupplyBigInt !== null && initialSupplyBigInt > BigInt(0);
  const beneficiaryWalletDisplayValue = beneficiaryWallet.trim() || ownerWallet || "";
  const beneficiaryWalletTrimmed = (beneficiaryWallet.trim() || ownerWallet || "").trim();
  const beneficiaryValid = isAddress(beneficiaryWalletTrimmed);
  const hasWallet = Boolean(address);
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const proofReadiness = getProofReadinessItems({
    hasWallet,
    onTargetChain,
    amountValid,
    adapterReady: Boolean(proofAdapter),
  });
  const proofInputKey =
    hasWallet && onTargetChain && amountValid && runtimeContracts
      ? `${address?.toLowerCase()}:${TARGET_CHAIN_ID}:${runtimeContracts.confidentialRwaToken.toLowerCase()}:${initialSupplyBigInt?.toString()}`
      : null;
  const proofReadyForInput =
    Boolean(proofInputKey) &&
    proofForKey === proofInputKey &&
    isBytes32Hex(encryptedAmount.trim()) &&
    isHex(inputProof.trim());
  const anchorHashPreview =
    beneficiaryValid && amountValid && nameTrimmed
      ? computeAssetAnchorHash({
          chainId: TARGET_CHAIN_ID,
          assetName: nameTrimmed,
          assetType,
          beneficiaryWallet: beneficiaryWalletTrimmed as Address,
          initialSupply: initialSupplyBigInt,
          metadataUri: metadataUriTrimmed,
        })
      : null;
  const readinessItems = [
    {
      label: "Tenant runtime",
      ready: tenantReady,
      detail: tenantReady
        ? "Tenant-owned token bundle is ready."
        : runtimeLoading
          ? "Loading tenant-owned runtime bundle."
          : runtime.error || "Complete onboarding and save the tenant-owned bundle first.",
    },
    {
      label: "Owner wallet",
      ready: Boolean(ownerWallet && address && ownerWallet.toLowerCase() === address.toLowerCase()),
      detail:
        ownerWallet && address && ownerWallet.toLowerCase() === address.toLowerCase()
          ? "Connected wallet matches the tenant token owner."
          : "Connect the tenant owner wallet used during onboarding.",
    },
    {
      label: "Beneficiary wallet",
      ready: beneficiaryValid,
      detail: beneficiaryValid
        ? "Initial confidential mint will be sent to this wallet."
        : "Enter a valid EVM wallet that should receive the initial confidential issuance.",
    },
    {
      label: "Asset anchor hash",
      ready: Boolean(anchorHashPreview),
      detail: anchorHashPreview ? "Anchor hash can be committed on-chain." : "Asset name, beneficiary wallet, and initial supply are required.",
    },
    {
      label: "NOX proof",
      ready: proofReadyForInput,
      detail: proofReadyForInput
        ? "Encrypted amount and proof are ready for confidential mint."
        : "Browser NOX proof must be generated for the current issuance amount.",
    },
  ];

  useEffect(() => {
    let active = true;

    async function loadRuntime() {
      setRuntimeLoading(true);
      const nextRuntime = await fetchTenantBundleRuntime();
      if (!active) {
        return;
      }
      setRuntime(nextRuntime);
      setRuntimeLoading(false);
    }

    void loadRuntime();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!proofInputKey) {
      return;
    }
    if (proofForKey === proofInputKey) {
      return;
    }
    const timer = setTimeout(() => {
      void generateProof();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofInputKey, proofForKey]);

  async function generateProof() {
    setError(null);

    if (!proofInputKey) {
      setEncryptedAmount("");
      setInputProof("");
      setProofForKey(null);
      return;
    }
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available for issuance proof generation.");
      return;
    }
    if (!amountValid || initialSupplyBigInt === null) {
      setError("Initial supply must be a positive integer to generate NOX proof.");
      return;
    }
    if (!hasWallet) {
      setError("Connect wallet before generating issuance proof.");
      return;
    }
    if (!onTargetChain) {
      setError("Switch wallet to Arbitrum Sepolia before generating issuance proof.");
      return;
    }

    setProofGenerating(true);
    try {
      const generated = await generateEncryptedAmountAndProof(
        {
          amount: initialSupplyBigInt,
          contractAddress: runtimeContracts.confidentialRwaToken as Address,
          chainId: TARGET_CHAIN_ID,
        },
        proofAdapter,
      );

      if (!generated.ok) {
        throw new Error([generated.message, generated.detail, generated.action].filter(Boolean).join(" "));
      }

      setEncryptedAmount(generated.encryptedAmount);
      setInputProof(generated.inputProof);
      setProofForKey(proofInputKey);
      setSuccess(`NOX proof generated for confidential issuance via ${generated.adapter}.`);
    } catch (proofError) {
      setProofForKey(null);
      setEncryptedAmount("");
      setInputProof("");
      setError(decodeWeb3FlowError(proofError, "Failed to generate confidential mint proof."));
    } finally {
      setProofGenerating(false);
    }
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!nameTrimmed) {
      setError("Asset name is required.");
      return;
    }
    if (!address) {
      setError("Connect wallet first before issuing a confidential asset position.");
      return;
    }
    if (!tenantReady || !runtime.bundle || !runtimeContracts) {
      setError("Tenant runtime is not configured. Open onboarding and deploy/save your tenant bundle first.");
      return;
    }
    if (!onTargetChain) {
      setError("Switch wallet to Arbitrum Sepolia to match your tenant deployment.");
      return;
    }
    if (!ownerWallet || address.toLowerCase() !== ownerWallet.toLowerCase()) {
      setError("Connected wallet does not match the tenant bundle owner wallet.");
      return;
    }
    if (!beneficiaryValid) {
      setError("Beneficiary wallet must be a valid EVM address.");
      return;
    }
    if (!amountValid || initialSupplyBigInt === null) {
      setError("Initial supply must be a positive integer.");
      return;
    }
    if (!anchorHashPreview) {
      setError("Asset anchor hash could not be derived from the current input.");
      return;
    }
    if (!proofReadyForInput || !proofInputKey || proofForKey !== proofInputKey) {
      setError("NOX proof is missing or stale. Wait for confidential mint proof generation to complete.");
      return;
    }

    setBusy(true);
    try {
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }

      const anchorTxHash = await writeContractAsync({
        address: runtimeContracts.auditAnchor as Address,
        abi: getContractAbi("auditAnchor"),
        functionName: "commitAnchor",
        args: [anchorHashPreview, metadataUriTrimmed],
        chainId: TARGET_CHAIN_ID,
      });

      const anchorReceipt = await web3PublicClient.waitForTransactionReceipt({
        hash: anchorTxHash,
        confirmations: 1,
      });
      if (anchorReceipt.status !== "success") {
        throw new Error(`Asset anchor transaction reverted. Tx hash: ${anchorTxHash}`);
      }

      const issuanceTxHash = await writeContractAsync({
        address: runtimeContracts.confidentialRwaToken as Address,
        abi: getContractAbi("confidentialRwaToken"),
        functionName: "mint",
        args: [
          beneficiaryWalletTrimmed as Address,
          encryptedAmount.trim() as `0x${string}`,
          inputProof.trim() as `0x${string}`,
        ],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(900000),
      });

      const issuanceReceipt = await web3PublicClient.waitForTransactionReceipt({
        hash: issuanceTxHash,
        confirmations: 1,
      });
      if (issuanceReceipt.status !== "success") {
        throw new Error(`Confidential mint reverted. Tx hash: ${issuanceTxHash}`);
      }

      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: nameTrimmed,
          asset_type: assetType,
          metadata_uri: metadataUriTrimmed,
          issuance_wallet: beneficiaryWalletTrimmed,
          initial_supply: Number(initialSupplyBigInt),
          anchor_hash: anchorHashPreview,
          anchor_tx_hash: anchorTxHash,
          issuance_tx_hash: issuanceTxHash,
        }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to persist issued asset.");
      }
      if (!payload.data?.id) {
        throw new Error("Backend create response did not contain asset ID.");
      }

      const holderMapping = await ensureHolderInvestorMapping({
        assetName: nameTrimmed,
        beneficiaryWallet: beneficiaryWalletTrimmed,
      });

      setResult({
        assetId: payload.data.id,
        anchorHash: anchorHashPreview,
        anchorTxHash,
        issuanceTxHash,
        beneficiaryWallet: beneficiaryWalletTrimmed,
        initialSupply: initialSupplyBigInt.toString(),
        metadataUri: metadataUriTrimmed,
        holderInvestorId: holderMapping.investorId,
        holderInvestorCreated: holderMapping.created,
      });
      setSuccess(
        holderMapping.created
          ? "Asset issued and the initial holder investor mapping was created."
          : "Asset issued and the initial holder investor mapping already exists.",
      );
    } catch (submitError) {
      setError(decodeWeb3FlowError(submitError, "Failed to create confidential asset issuance."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Asset issuance"
        title="Create asset"
        description="This step anchors asset metadata on-chain and issues initial confidential supply through the tenant-owned ERC-7984 token."
        meta={<StatusBadge tone={tenantReady && proofReadyForInput ? "success" : "warning"}>{tenantReady && proofReadyForInput ? "Ready to issue" : "Needs input"}</StatusBadge>}
      />

      <InlineNotice
        title="What happens here"
        description="No new contracts are deployed on this page. The connected tenant owner commits an asset metadata hash to AuditAnchor, generates a NOX proof in-browser, mints confidential supply on the tenant token, and then saves the asset record to backend."
        tone="accent"
      />

      {!tenantReady ? (
        <InlineNotice
          title="Tenant runtime required"
          description={
            runtimeLoading
              ? "Loading current tenant runtime..."
              : runtime.error || "Complete onboarding and save a tenant-owned bundle from TenantFactory before issuing assets."
          }
          tone="danger"
        />
      ) : null}

      <SectionCard title="Asset issuance form" description="Anchor metadata and mint the initial confidential position for this asset.">
        <div className="grid gap-4">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Asset name"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <select
            value={assetType}
            onChange={(event) => setAssetType(event.target.value)}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          >
            <option value="fund">fund</option>
            <option value="debt">debt</option>
            <option value="equity">equity</option>
            <option value="revenue-share">revenue-share</option>
          </select>
          <input
            value={initialSupply}
            onChange={(event) => setInitialSupply(event.target.value)}
            placeholder="Initial supply (integer)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <input
            value={beneficiaryWalletDisplayValue}
            onChange={(event) => setBeneficiaryWallet(event.target.value)}
            placeholder="Issuance recipient wallet (defaults to tenant owner)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
          />
          <div className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-xs text-muted">
            <p>
              Beneficiary wallet = the wallet that receives the initial confidential mint for this asset.
            </p>
            <p className="mt-1">
              If you leave it unchanged, the default recipient is the tenant owner wallet:
              <span className="ml-1 font-mono text-foreground">{ownerWallet ?? "Unknown"}</span>
            </p>
          </div>
          <input
            value={metadataUri}
            onChange={(event) => setMetadataUri(event.target.value)}
            placeholder="Metadata URI (optional)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <input
            value={anchorHashPreview ?? ""}
            readOnly
            placeholder="Asset anchor hash (auto-derived)"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
          />
          <input
            value={encryptedAmount}
            readOnly
            placeholder={proofGenerating ? "Generating confidential issuance proof..." : "Encrypted amount (auto-generated)"}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
          />
          <textarea
            value={inputProof}
            readOnly
            rows={3}
            placeholder={proofGenerating ? "Generating confidential issuance proof..." : "Input proof (auto-generated)"}
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
          />
          <div className="rounded-xl border border-border bg-surface-soft px-4 py-3 text-xs text-muted">
            <p>
              Connected wallet: <span className="font-mono text-foreground">{address ?? "Not connected"}</span>
            </p>
            <p className="mt-1">
              Tenant owner wallet: <span className="font-mono text-foreground">{ownerWallet ?? "Unknown"}</span>
            </p>
            <p className="mt-1">
              Chain: <span className="font-mono text-foreground">{chainId ?? "unknown"}</span>
              {!onTargetChain ? " (switch required to 421614)" : " (Arbitrum Sepolia)"}
            </p>
            <p className="mt-1">
              Metadata URI used for anchor: <span className="font-mono text-foreground">{metadataUriTrimmed}</span>
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="secondary"
              onClick={() => void generateProof()}
              disabled={!tenantReady || !hasWallet || !onTargetChain || !amountValid || proofGenerating}
            >
              {proofGenerating ? "Generating NOX proof..." : "Regenerate NOX proof"}
            </Button>
            <Button onClick={() => void submit()} disabled={busy || runtimeLoading || !tenantReady || !proofReadyForInput}>
              {busy ? "Issuing asset..." : "Anchor and issue asset"}
            </Button>
            <Button variant="secondary" href="/onboarding">Open onboarding</Button>
            <Button variant="secondary" href="/assets">Cancel</Button>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Readiness" description="This checklist blocks issuance before the on-chain steps can revert.">
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
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {proofReadiness.map((item) => (
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

      {runtime.bundle ? (
        <SectionCard title="Tenant bundle context" description="Live tenant-owned bundle currently loaded from backend runtime.">
          <DetailList
            columns={1}
            items={[
              { label: "Owner wallet", value: <span className="font-mono text-xs">{runtime.bundle.ownerWallet}</span> },
              { label: "Deployment mode", value: runtime.bundle.mode },
              { label: "Token contract", value: <span className="font-mono text-xs">{runtime.bundle.contracts.confidentialRwaToken}</span> },
              { label: "Transfer controller", value: <span className="font-mono text-xs">{runtime.bundle.contracts.transferController}</span> },
              { label: "Audit anchor", value: <span className="font-mono text-xs">{runtime.bundle.contracts.auditAnchor}</span> },
            ]}
          />
        </SectionCard>
      ) : null}

      {success ? <InlineNotice title="Create asset succeeded" description={success} tone="success" /> : null}
      {result ? (
        <SectionCard title="Issuance result" description="Backend asset record and the supporting on-chain issuance references.">
          <DetailList
            columns={1}
            items={[
              { label: "Asset ID (backend)", value: `#${result.assetId}` },
              { label: "Beneficiary wallet", value: <span className="font-mono text-xs">{result.beneficiaryWallet}</span> },
              { label: "Initial supply", value: result.initialSupply },
              {
                label: "Holder investor mapping",
                value: result.holderInvestorId
                  ? `#${result.holderInvestorId}${result.holderInvestorCreated ? " created" : " existing"}`
                  : result.holderInvestorCreated
                    ? "Created"
                    : "Existing",
              },
              { label: "Metadata URI", value: <span className="font-mono text-xs">{result.metadataUri}</span> },
              { label: "Anchor hash", value: <span className="font-mono text-xs">{result.anchorHash}</span> },
              { label: "Anchor tx hash", value: <span className="font-mono text-xs">{result.anchorTxHash}</span> },
              { label: "Issuance tx hash", value: <span className="font-mono text-xs">{result.issuanceTxHash}</span> },
            ]}
          />
          <div className="mt-5 flex gap-3">
            <Button href="/assets">View assets</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Issue another asset</Button>
          </div>
        </SectionCard>
      ) : null}
      {error ? <InlineNotice title="Create asset failed" description={error} tone="danger" /> : null}
    </div>
  );
}
