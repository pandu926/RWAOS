"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, isHex, type Address, type Hex } from "viem";
import { useAccount, useChainId, useSwitchChain, useWalletClient, useWriteContract } from "wagmi";

import {
  TARGET_CHAIN_ID,
  decodeWeb3FlowError,
  isBytes32Hex,
  parsePositiveInteger,
  runOptionalWeb3Precheck,
  type OptionalWeb3FlowAdapter,
} from "@/app/_lib/onchain-flow";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { web3PublicClient } from "@/lib/web3/client";
import { getContractAbi } from "@/lib/web3/contracts";
import { computePassportAnchorHash, computePassportPolicyHash, computeTransferIdOnchain } from "@/lib/web3/domain-hashes";
import { decodeTransferControllerError } from "@/lib/web3/errors";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof, getProofReadinessItems } from "@/lib/web3/proof";
import { fetchTenantBundleRuntime, type TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";
import { getTenantRuntimePrecheckStatus } from "@/lib/web3/prechecks";

type Envelope = { success: boolean; error?: string | null };

type OptionsEnvelope = {
  success: boolean;
  data?: {
    assets: Array<{ id: number; name: string }>;
    investors: Array<{ id: number; name: string; wallet_address: string | null }>;
    transfers: Array<{
      id: number;
      asset_id: number;
      asset_name: string;
      from_investor_id: number;
      from_investor_name: string;
      from_investor_wallet_address: string | null;
      to_investor_id: number;
      to_investor_name: string;
      to_investor_wallet_address: string | null;
      amount: number;
      tx_hash?: string | null;
    }>;
  };
  error?: string | null;
};

type DisclosureOptionsEnvelope = {
  success: boolean;
  data?: Array<{
    id: number;
    asset_id: number;
    title: string;
    data_id?: string | null;
    grantee?: string | null;
    expires_at?: number | null;
  }>;
  error?: string | null;
};

type PassportPrecheckInput = {
  from_address: `0x${string}`;
  to_address: `0x${string}`;
  encrypted_amount: `0x${string}`;
  input_proof: `0x${string}`;
  disclosure_data_id: `0x${string}`;
  policy_hash: `0x${string}`;
  anchor_hash: `0x${string}`;
  transfer_id_onchain: `0x${string}`;
};

type PassportResult = {
  transferRecordId: number;
  transferIdOnchain: string;
  transferTxHash: string;
  anchorTxHash: string;
  senderWallet: string;
  recipientWallet: string;
  policyHash: string;
  disclosureDataId: string;
  anchorHash: string;
};

export default function NewPassportPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [transferOptions, setTransferOptions] = useState<NonNullable<OptionsEnvelope["data"]>["transfers"]>([]);
  const [disclosureOptions, setDisclosureOptions] = useState<NonNullable<DisclosureOptionsEnvelope["data"]>>([]);
  const [transferRecordId, setTransferRecordId] = useState("");
  const [disclosureDataId, setDisclosureDataId] = useState("");
  const [encryptedAmount, setEncryptedAmount] = useState("");
  const [inputProof, setInputProof] = useState("");
  const [scope, setScope] = useState("auditor,regulator,counterparty");
  const [reason, setReason] = useState("Routine compliance issuance");
  const [busy, setBusy] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<PassportResult | null>(null);
  const [proofForKey, setProofForKey] = useState<string | null>(null);
  const [tenantRuntime, setTenantRuntime] = useState<TenantBundleRuntime | null>(null);
  const [currentUnix] = useState(() => Math.floor(Date.now() / 1000));

  const hasWallet = Boolean(address);
  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const selectedTransfer = transferOptions.find((item) => String(item.id) === transferRecordId) ?? null;
  const sourceWallet = selectedTransfer?.from_investor_wallet_address || "";
  const sourceWalletTrimmed = sourceWallet.trim();
  const sourceWalletValid = isAddress(sourceWalletTrimmed);
  const sourceMatchesConnectedWallet =
    Boolean(address && sourceWalletValid && address.toLowerCase() === sourceWalletTrimmed.toLowerCase());
  const toAddress = selectedTransfer?.to_investor_wallet_address || "";
  const transferRecordIdNumber = parsePositiveInteger(transferRecordId);
  const selectedTransferTxHash = selectedTransfer?.tx_hash?.trim() ?? "";
  const selectedTransferTxHashValid = isBytes32Hex(selectedTransferTxHash);
  const transferIdOnchain =
    transferRecordIdNumber && selectedTransferTxHashValid
      ? computeTransferIdOnchain({
          chainId: TARGET_CHAIN_ID,
          transferRecordId: transferRecordIdNumber,
          transferTxHash: selectedTransferTxHash as Hex,
        })
      : "";
  const transferIdOnchainValid = isBytes32Hex(transferIdOnchain);
  const disclosureDataIdValid = isBytes32Hex(disclosureDataId.trim());
  const toAddressTrimmed = toAddress.trim();
  const toAddressValid = isAddress(toAddressTrimmed);
  const encryptedAmountTrimmed = encryptedAmount.trim();
  const encryptedAmountValid = isBytes32Hex(encryptedAmountTrimmed);
  const inputProofTrimmed = inputProof.trim();
  const inputProofValid = isHex(inputProofTrimmed);
  const selectedTransferAmount = selectedTransfer ? String(selectedTransfer.amount).trim() : "";
  const selectedTransferAmountBigInt = /^\d+$/.test(selectedTransferAmount) ? BigInt(selectedTransferAmount) : null;
  const proofInputKey =
    hasWallet && onTargetChain && selectedTransferAmountBigInt !== null
      ? `${address?.toLowerCase()}:${TARGET_CHAIN_ID}:${selectedTransferAmountBigInt.toString()}`
      : null;
  const proofReadyForInput =
    Boolean(proofInputKey) &&
    proofForKey === proofInputKey &&
    encryptedAmountValid &&
    inputProofValid;
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const proofReadiness = getProofReadinessItems({
    hasWallet,
    onTargetChain,
    amountValid: Boolean(selectedTransferAmountBigInt && selectedTransferAmountBigInt > BigInt(0)),
    adapterReady: Boolean(proofAdapter),
  });
  const activeDisclosureOptions = disclosureOptions
    .filter((item) => item.data_id)
    .filter((item) => !selectedTransfer || item.asset_id === selectedTransfer.asset_id)
    .filter((item) => !item.expires_at || item.expires_at > currentUnix)
    .filter((item) => !item.grantee || !sourceWalletValid || item.grantee.toLowerCase() === sourceWalletTrimmed.toLowerCase());
  const effectiveDisclosureDataId = disclosureDataId || activeDisclosureOptions[0]?.data_id || "";
  const scopeNormalized = scope
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .join(",");
  const policyHash =
    transferRecordIdNumber && isBytes32Hex(effectiveDisclosureDataId)
      ? computePassportPolicyHash({
          chainId: TARGET_CHAIN_ID,
          transferRecordId: transferRecordIdNumber,
          disclosureDataId: effectiveDisclosureDataId as Hex,
          disclosureScope: scopeNormalized,
        })
      : "";
  const policyHashValid = isBytes32Hex(policyHash);
  const anchorHash =
    transferIdOnchainValid && isBytes32Hex(effectiveDisclosureDataId) && policyHashValid
      ? computePassportAnchorHash({
          transferIdOnchain: transferIdOnchain as Hex,
          policyHash: policyHash as Hex,
          disclosureDataId: effectiveDisclosureDataId as Hex,
          reason: reason.trim(),
        })
      : "";
  const anchorHashValid = isBytes32Hex(anchorHash);
  const runtimeContracts = tenantRuntime?.bundle?.contracts ?? null;
  const runtimePrecheck = useMemo(
    () => getTenantRuntimePrecheckStatus(tenantRuntime, TARGET_CHAIN_ID),
    [tenantRuntime],
  );
  const formReady =
    Boolean(transferRecordIdNumber) &&
    transferIdOnchainValid &&
    policyHashValid &&
    disclosureDataIdValid &&
    anchorHashValid &&
    toAddressValid &&
    proofReadyForInput &&
    runtimePrecheck.ok;
  const readinessItems = [
    {
      label: "Sender wallet",
      ready: sourceWalletValid && sourceMatchesConnectedWallet,
      detail:
        !sourceWalletValid
          ? "Selected transfer record needs a valid sender wallet mapping."
          : sourceMatchesConnectedWallet
            ? "Connected wallet matches transfer sender."
            : "Connect the sender wallet from the selected transfer record.",
    },
    {
      label: "Transfer record",
      ready: Boolean(transferRecordIdNumber),
      detail: transferRecordIdNumber ? "Backend transfer record selected." : "Select transfer record from backend first.",
    },
    {
      label: "Contract transfer ID",
      ready: transferIdOnchainValid,
      detail: transferIdOnchainValid ? "Domain bytes32 derived from backend record ID and confirmed transfer tx hash." : "Selected transfer must already have a transfer tx hash.",
    },
    {
      label: "Recipient wallet",
      ready: toAddressValid,
      detail: toAddressValid ? "Recipient wallet is valid." : "Selected transfer recipient needs a valid mapped wallet.",
    },
    {
      label: "Disclosure selection",
      ready: isBytes32Hex(effectiveDisclosureDataId),
      detail: isBytes32Hex(effectiveDisclosureDataId) ? "Disclosure data ID is resolved from a live tenant disclosure record." : "Select an active disclosure for this transfer asset and sender wallet.",
    },
    {
      label: "Hashes",
      ready: policyHashValid && disclosureDataIdValid && anchorHashValid,
      detail:
        policyHashValid && disclosureDataIdValid && anchorHashValid
          ? "Policy, disclosure, and anchor hashes are valid."
          : "Policy hash, disclosure data ID, and anchor hash must all be bytes32.",
    },
    {
      label: "Proof payload",
      ready: proofReadyForInput,
      detail:
        proofReadyForInput
          ? "Encrypted amount and input proof are ready."
          : "Browser-generated NOX proof is required for current transfer amount.",
    },
    {
      label: "Tenant runtime",
      ready: runtimePrecheck.ok,
      detail: runtimePrecheck.ok ? runtimePrecheck.detail : `${runtimePrecheck.summary} ${runtimePrecheck.detail}`,
    },
  ];
  const passportFlowAdapter: OptionalWeb3FlowAdapter<PassportPrecheckInput> | undefined = {
    precheck(input) {
      if (!sourceWalletValid) {
        throw new Error("Selected transfer record is missing a valid sender wallet mapping.");
      }
      if (!sourceMatchesConnectedWallet) {
        throw new Error("Connect the sender wallet from the selected transfer record before issuing the passport.");
      }
      return input;
    },
    decodeError(submitError, fallbackMessage) {
      const decoded = decodeTransferControllerError(submitError);
      return decoded.code === "UNKNOWN"
        ? decodeWeb3FlowError(submitError, fallbackMessage)
        : [decoded.message, decoded.action].filter(Boolean).join(" ");
    },
  };

  const transferHint = !selectedTransfer
    ? "Select a backend transfer record first. The contract transfer ID stays separate from the DB record."
    : `Backend transfer record #${selectedTransfer.id} maps ${selectedTransfer.from_investor_name} -> ${selectedTransfer.to_investor_name}.${selectedTransfer.tx_hash ? ` Existing transfer tx: ${selectedTransfer.tx_hash}.` : " No transfer tx hash is stored on the backend record yet."}`;

  useEffect(() => {
    let active = true;

    async function loadTenantRuntime() {
      const runtime = await fetchTenantBundleRuntime();
      if (!active) {
        return;
      }
      setTenantRuntime(runtime);
    }

    void loadTenantRuntime();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingOptions(true);
      try {
        const [optionsResponse, disclosuresResponse] = await Promise.all([
          fetch("/api/transfer-form-options", { cache: "no-store" }),
          fetch("/api/disclosures", { cache: "no-store" }),
        ]);
        const payload = (await optionsResponse.json()) as OptionsEnvelope;
        const disclosuresPayload = (await disclosuresResponse.json()) as DisclosureOptionsEnvelope;
        if (!optionsResponse.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Failed to load passport form options.");
        }
        if (!disclosuresResponse.ok || !disclosuresPayload.success || !disclosuresPayload.data) {
          throw new Error(disclosuresPayload.error || "Failed to load disclosure options.");
        }
        if (!active) {
          return;
        }
        setTransferOptions(payload.data.transfers);
        setDisclosureOptions(disclosuresPayload.data);
        const firstTransferId = payload.data.transfers[0]?.id;
        setTransferRecordId(firstTransferId ? String(firstTransferId) : "");
        const firstTransfer = payload.data.transfers[0];
        const initialDisclosure =
          disclosuresPayload.data.find(
            (item) =>
              item.data_id &&
              item.asset_id === firstTransfer?.asset_id &&
              (!item.grantee ||
                item.grantee.toLowerCase() === firstTransfer?.from_investor_wallet_address?.toLowerCase()),
          ) ?? null;
        setDisclosureDataId(initialDisclosure?.data_id || "");
        setEncryptedAmount("");
        setInputProof("");
        setProofForKey(null);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(decodeWeb3FlowError(loadError, "Failed to load passport form options."));
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

  async function generateProof() {
    setError(null);

    if (!proofInputKey) {
      setEncryptedAmount("");
      setInputProof("");
      setProofForKey(null);
      return;
    }
    if (!selectedTransferAmountBigInt || selectedTransferAmountBigInt <= BigInt(0)) {
      setError("Selected transfer amount must be a positive integer to generate NOX proof.");
      return;
    }
    if (!hasWallet) {
      setError("Connect wallet before generating encrypted amount and proof.");
      return;
    }
    if (!onTargetChain) {
      setError(`Wallet is on the wrong network. Switch to Arbitrum Sepolia (chain ID ${TARGET_CHAIN_ID}) first.`);
      return;
    }
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available for proof generation.");
      return;
    }

    setProofGenerating(true);
    try {
      const generated = await generateEncryptedAmountAndProof(
        {
          amount: selectedTransferAmountBigInt,
          contractAddress: runtimeContracts.transferController as Address,
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
      setSuccess(`Encrypted amount and input proof generated via ${generated.adapter}.`);
    } catch (proofError) {
      setProofForKey(null);
      setEncryptedAmount("");
      setInputProof("");
      setError(decodeWeb3FlowError(proofError, "Failed to generate NOX proof."));
    } finally {
      setProofGenerating(false);
    }
  }

  useEffect(() => {
    if (!proofInputKey) return;
    if (proofForKey === proofInputKey) {
      return;
    }
    const timer = setTimeout(() => {
      void generateProof();
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proofInputKey, proofForKey]);

  async function submit() {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!transferRecordIdNumber) {
      setError("Transfer record ID must be a positive integer.");
      return;
    }
    if (!selectedTransferTxHashValid || !transferIdOnchainValid) {
      setError("Selected transfer does not have a valid tx hash to derive `transfer_id_onchain`.");
      return;
    }
    if (!hasWallet || !address) {
      setError("Connect wallet before issuing passport.");
      return;
    }
    if (!policyHashValid || !isBytes32Hex(effectiveDisclosureDataId) || !anchorHashValid) {
      setError("Policy hash, disclosure data ID, and anchor hash must be bytes32 values.");
      return;
    }
    if (!sourceWalletValid) {
      setError("Selected transfer record must have a valid sender wallet.");
      return;
    }
    if (!sourceMatchesConnectedWallet) {
      setError("Connect the sender wallet from the selected transfer record before issuing passport.");
      return;
    }
    if (!toAddressValid) {
      setError("Recipient address must be a valid wallet address.");
      return;
    }
    if (!proofReadyForInput || !proofInputKey || proofForKey !== proofInputKey) {
      setError("NOX proof is missing or stale for the current transfer amount.");
      return;
    }
    if (!runtimePrecheck.ok) {
      setError(`${runtimePrecheck.summary} ${runtimePrecheck.action}`);
      return;
    }
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available. Complete onboarding and save tenant contracts first.");
      return;
    }

    setBusy(true);
    try {
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }

      const prechecked = await runOptionalWeb3Precheck(passportFlowAdapter, {
        from_address: sourceWalletTrimmed as `0x${string}`,
        to_address: toAddressTrimmed as `0x${string}`,
        encrypted_amount: encryptedAmountTrimmed as `0x${string}`,
        input_proof: inputProofTrimmed as `0x${string}`,
        disclosure_data_id: effectiveDisclosureDataId as `0x${string}`,
        policy_hash: policyHash as `0x${string}`,
        anchor_hash: anchorHash as `0x${string}`,
        transfer_id_onchain: transferIdOnchain as `0x${string}`,
      });

      const anchorResultHash = await writeContractAsync({
        address: runtimeContracts.auditAnchor as Address,
        abi: getContractAbi("auditAnchor"),
        functionName: "commitAnchor",
        args: [prechecked.anchor_hash, reason.trim()],
        chainId: TARGET_CHAIN_ID,
      });
      const anchorReceipt = await web3PublicClient.waitForTransactionReceipt({
        hash: anchorResultHash,
        confirmations: 1,
      });
      if (anchorReceipt.status !== "success") {
        throw new Error(`Passport anchor reverted on-chain. Tx hash: ${anchorResultHash}`);
      }

      const transferResultHash = await writeContractAsync({
        address: runtimeContracts.transferController as Address,
        abi: getContractAbi("transferController"),
        functionName: "confidentialTransferFromWithPassport",
        args: [
          prechecked.from_address as Address,
          prechecked.to_address as Address,
          prechecked.encrypted_amount,
          prechecked.input_proof,
          prechecked.disclosure_data_id,
          prechecked.transfer_id_onchain,
          prechecked.policy_hash,
          prechecked.anchor_hash,
        ],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(1200000),
      });
      const transferReceipt = await web3PublicClient.waitForTransactionReceipt({
        hash: transferResultHash,
        confirmations: 1,
      });
      if (transferReceipt.status !== "success") {
        throw new Error(`Passport transfer reverted on-chain. Tx hash: ${transferResultHash}`);
      }

      const response = await fetch("/api/compliance/passports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transfer_record_id: transferRecordIdNumber,
          transfer_id_onchain: prechecked.transfer_id_onchain,
          disclosure_scope: scopeNormalized.split(",").filter(Boolean),
          policy_hash: prechecked.policy_hash,
          disclosure_data_id: prechecked.disclosure_data_id,
          anchor_hash: prechecked.anchor_hash,
          transfer_tx_hash: transferResultHash,
          anchor_tx_hash: anchorResultHash,
          reason: reason.trim(),
          onchain_metadata: {
            chain_id: TARGET_CHAIN_ID,
            transfer_id_onchain: prechecked.transfer_id_onchain,
            transfer_tx_hash: transferResultHash,
            anchor_tx_hash: anchorResultHash,
            policy_hash: prechecked.policy_hash,
            disclosure_data_id: prechecked.disclosure_data_id,
            anchor_hash: prechecked.anchor_hash,
            transfer_controller_address: runtimeContracts.transferController,
            audit_anchor_address: runtimeContracts.auditAnchor,
          },
        }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(
          `${payload.error || "Failed to issue passport."} Transfer tx: ${transferResultHash}. Anchor tx: ${anchorResultHash}`,
        );
      }

      setSuccess("Compliance passport mined and backend record updated.");
      setResult({
        transferRecordId: transferRecordIdNumber,
        transferIdOnchain: prechecked.transfer_id_onchain,
        transferTxHash: transferResultHash,
        anchorTxHash: anchorResultHash,
        senderWallet: prechecked.from_address,
        recipientWallet: prechecked.to_address,
        policyHash: prechecked.policy_hash,
        disclosureDataId: prechecked.disclosure_data_id,
        anchorHash: prechecked.anchor_hash,
      });
    } catch (submitError) {
      const decoded = decodeTransferControllerError(submitError);
      setError(
        decoded.code === "UNKNOWN"
          ? decodeWeb3FlowError(submitError, "Failed to issue passport.", passportFlowAdapter)
          : [decoded.message, decoded.action].filter(Boolean).join(" "),
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance Passport"
        title="Issue passport"
        description="Backend transfer record ID and contract transfer ID are handled separately, while every on-chain call is sent to the tenant-owned runtime contracts."
        meta={<StatusBadge tone={formReady && hasWallet && onTargetChain ? "success" : "warning"}>{formReady && hasWallet && onTargetChain ? "Ready to issue" : "Needs input"}</StatusBadge>}
      />

      <InlineNotice
        title="Transfer ID distinction"
        description="`transfer_record_id` is the backend database record. `transfer_id_onchain` is a deterministic bytes32 domain hash derived from the backend record ID and confirmed transfer tx hash before it is passed into the smart contract."
        tone="neutral"
      />
      {!runtimePrecheck.ok ? (
        <InlineNotice
          title="Tenant runtime required"
          description={`${runtimePrecheck.summary} ${runtimePrecheck.detail}`}
          tone="danger"
        />
      ) : null}

      <SectionCard title="Passport form" description="Select an existing transfer record to reuse investor wallet mapping and recorded transfer context.">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label htmlFor="transfer-record-id" className="text-sm font-medium text-foreground">Transfer record ID (backend)</label>
            <select
              id="transfer-record-id"
              value={transferRecordId}
              onChange={(event) => {
                setTransferRecordId(event.target.value);
                setEncryptedAmount("");
                setInputProof("");
                setProofForKey(null);
              }}
              disabled={loadingOptions || !transferOptions.length}
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
            >
              <option value="">Select transfer record</option>
              {transferOptions.map((transfer) => (
                <option key={transfer.id} value={transfer.id}>
                  {`#${transfer.id} - ${transfer.asset_name} - ${transfer.from_investor_name} -> ${transfer.to_investor_name}`}
                </option>
              ))}
            </select>
            <p className="text-xs leading-5 text-muted">{transferHint}</p>
          </div>

          <div className="space-y-2">
            <label htmlFor="transfer-id-onchain" className="text-sm font-medium text-foreground">Contract transfer ID (bytes32)</label>
            <input
              id="transfer-id-onchain"
              value={transferIdOnchain}
              readOnly
              placeholder="Derived after selected transfer has tx hash"
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
            />
          </div>

          <div className="space-y-2">
            <input
              value={sourceWallet}
              readOnly
              placeholder="Sender wallet from transfer record"
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none"
            />
            <p className="text-xs leading-5 text-muted">
              Sender wallet is derived from the selected transfer record and must match the connected wallet for this demo flow.
            </p>
          </div>

          <div className="space-y-2">
            <label htmlFor="disclosure-data-id" className="text-sm font-medium text-foreground">Disclosure</label>
            <select
              id="disclosure-data-id"
              value={effectiveDisclosureDataId}
              onChange={(event) => setDisclosureDataId(event.target.value)}
              disabled={loadingOptions || !activeDisclosureOptions.length}
              className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
            >
              <option value="">Select active disclosure</option>
              {activeDisclosureOptions.map((option) => (
                <option key={option.id} value={option.data_id ?? ""}>
                  {`#${option.id} - ${option.title}${option.grantee ? ` -> ${option.grantee}` : ""}`}
                </option>
              ))}
            </select>
          </div>
          <input value={policyHash} readOnly placeholder="Policy hash (auto-derived)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <input value={anchorHash} readOnly placeholder="Anchor hash (auto-derived)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <div className="space-y-2">
            <input value={toAddress} readOnly placeholder="Recipient wallet (0x...)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
            <p className="text-xs leading-5 text-muted">
              {selectedTransfer?.to_investor_wallet_address
                ? `Auto-filled from recipient investor #${selectedTransfer.to_investor_id} wallet mapping.`
                : "Selected transfer recipient must have a wallet mapping before passport issuance."}
            </p>
          </div>
          <div className="space-y-2">
            <input value={encryptedAmount} readOnly placeholder={proofGenerating ? "Generating NOX proof..." : "Encrypted amount (auto-generated)"} className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void generateProof()}
                disabled={!hasWallet || !onTargetChain || !selectedTransferAmountBigInt || proofGenerating || !runtimePrecheck.ok}
              >
                {proofGenerating ? "Generating NOX proof..." : "Regenerate NOX proof"}
              </Button>
              <p className="text-xs leading-5 text-muted">
                Uses the selected transfer amount locally to generate the encrypted payload for `TransferController`.
              </p>
            </div>
          </div>
          <textarea value={inputProof} readOnly placeholder={proofGenerating ? "Generating NOX proof..." : "Input proof (auto-generated)"} rows={3} className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Disclosure scope (comma-separated)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none" />
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none" />
          <div className="flex gap-3">
            <Button onClick={() => void submit()} disabled={busy || loadingOptions || !runtimePrecheck.ok}>{busy ? "Issuing..." : "Issue passport"}</Button>
            <Button variant="secondary" href="/compliance/passports">Cancel</Button>
          </div>
          {!hasWallet ? <p className="text-sm text-danger">Wallet not connected.</p> : null}
          {hasWallet && !onTargetChain ? <p className="text-sm text-danger">Wrong network. Use Arbitrum Sepolia.</p> : null}
          {!selectedTransferAmountBigInt && selectedTransfer ? <p className="text-sm text-danger">Selected transfer amount must be an integer to generate NOX proof.</p> : null}
          {!proofReadyForInput && selectedTransferAmountBigInt ? (
            <p className="text-sm text-danger">Browser-generated NOX proof is not ready for the current transfer amount.</p>
          ) : null}
        </div>
      </SectionCard>

      {error ? <InlineNotice title="Issue passport failed" description={error} tone="danger" /> : null}
      {success ? <InlineNotice title="Passport submitted" description={success} tone="success" /> : null}
      {result ? (
        <SectionCard title="Passport result" description="Stored backend metadata and new on-chain references are summarized together after submission.">
          <DetailList
            items={[
              { label: "Transfer record ID", value: `#${result.transferRecordId}` },
              { label: "Contract transfer ID", value: <span className="font-mono text-xs">{result.transferIdOnchain}</span> },
              { label: "Transfer tx hash", value: <span className="font-mono text-xs">{result.transferTxHash}</span> },
              { label: "Anchor tx hash", value: <span className="font-mono text-xs">{result.anchorTxHash}</span> },
              { label: "Sender wallet", value: <span className="font-mono text-xs">{result.senderWallet}</span> },
              { label: "Recipient wallet", value: <span className="font-mono text-xs">{result.recipientWallet}</span> },
              { label: "Policy hash", value: <span className="font-mono text-xs">{result.policyHash}</span> },
              { label: "Disclosure data ID", value: <span className="font-mono text-xs">{result.disclosureDataId}</span> },
              { label: "Anchor hash", value: <span className="font-mono text-xs">{result.anchorHash}</span> },
            ]}
          />
          <div className="mt-5 flex gap-3">
            <Button href="/compliance/passports">View passports</Button>
            <Button variant="secondary" onClick={() => setResult(null)}>Issue another passport</Button>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard title="Readiness" description="Checklist ini memisahkan blocker data backend, contract input, dan proof generation.">
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
    </div>
  );
}
