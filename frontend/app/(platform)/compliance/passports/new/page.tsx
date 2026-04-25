"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, isHex, type Address } from "viem";
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
import { contractAddresses, getContractAbi } from "@/lib/web3/contracts";
import { decodeTransferControllerError } from "@/lib/web3/errors";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof, getProofReadinessItems } from "@/lib/web3/proof";

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
  const [transferRecordId, setTransferRecordId] = useState("");
  const [transferIdOnchainOverride, setTransferIdOnchainOverride] = useState("");
  const [policyHash, setPolicyHash] = useState("");
  const [disclosureDataId, setDisclosureDataId] = useState("");
  const [anchorHash, setAnchorHash] = useState("");
  const [toAddressOverride, setToAddressOverride] = useState("");
  const [encryptedAmount, setEncryptedAmount] = useState("");
  const [inputProof, setInputProof] = useState("0x");
  const [scope, setScope] = useState("auditor,regulator,counterparty");
  const [reason, setReason] = useState("Manual issuance");
  const [busy, setBusy] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<PassportResult | null>(null);

  const hasWallet = Boolean(address);
  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const selectedTransfer = transferOptions.find((item) => String(item.id) === transferRecordId) ?? null;
  const sourceWallet = selectedTransfer?.from_investor_wallet_address || "";
  const sourceWalletTrimmed = sourceWallet.trim();
  const sourceWalletValid = isAddress(sourceWalletTrimmed);
  const sourceMatchesConnectedWallet =
    Boolean(address && sourceWalletValid && address.toLowerCase() === sourceWalletTrimmed.toLowerCase());
  const transferIdOnchain = transferIdOnchainOverride.trim();
  const toAddress = toAddressOverride || selectedTransfer?.to_investor_wallet_address || "";
  const transferRecordIdNumber = parsePositiveInteger(transferRecordId);
  const transferIdOnchainValid = isBytes32Hex(transferIdOnchain);
  const policyHashValid = isBytes32Hex(policyHash.trim());
  const disclosureDataIdValid = isBytes32Hex(disclosureDataId.trim());
  const anchorHashValid = isBytes32Hex(anchorHash.trim());
  const toAddressTrimmed = toAddress.trim();
  const toAddressValid = isAddress(toAddressTrimmed);
  const encryptedAmountTrimmed = encryptedAmount.trim();
  const encryptedAmountValid = isBytes32Hex(encryptedAmountTrimmed);
  const inputProofTrimmed = inputProof.trim();
  const inputProofValid = isHex(inputProofTrimmed);
  const selectedTransferAmount = selectedTransfer ? String(selectedTransfer.amount).trim() : "";
  const selectedTransferAmountBigInt = /^\d+$/.test(selectedTransferAmount) ? BigInt(selectedTransferAmount) : null;
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const proofReadiness = getProofReadinessItems({
    hasWallet,
    onTargetChain,
    amountValid: Boolean(selectedTransferAmountBigInt && selectedTransferAmountBigInt > BigInt(0)),
    adapterReady: Boolean(proofAdapter),
  });
  const formReady =
    Boolean(transferRecordIdNumber) &&
    transferIdOnchainValid &&
    policyHashValid &&
    disclosureDataIdValid &&
    anchorHashValid &&
    toAddressValid &&
    encryptedAmountValid &&
    inputProofValid;
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
      label: "Transfer ID on-chain",
      ready: transferIdOnchainValid,
      detail: transferIdOnchainValid ? "Bytes32 on-chain transfer ID is valid." : "Provide bytes32 transfer ID for the contract call.",
    },
    {
      label: "Recipient wallet",
      ready: toAddressValid,
      detail: toAddressValid ? "Recipient wallet is valid." : "Use mapped recipient wallet or enter valid address.",
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
      ready: encryptedAmountValid && inputProofValid,
      detail:
        encryptedAmountValid && inputProofValid
          ? "Encrypted amount and input proof are ready."
          : "Generate or paste a valid NOX encrypted amount and proof.",
    },
  ];
  const passportFlowAdapter = useMemo<OptionalWeb3FlowAdapter<PassportPrecheckInput> | undefined>(() => {
    return {
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
  }, [sourceMatchesConnectedWallet, sourceWalletValid]);

  const transferHint = useMemo(() => {
    if (!selectedTransfer) {
      return "Select a backend transfer record first. The on-chain transfer ID stays separate and can be overridden if needed.";
    }
    const txLabel = selectedTransfer.tx_hash ? ` Existing transfer tx: ${selectedTransfer.tx_hash}.` : " No transfer tx hash is stored on the backend record yet.";
    return `Backend transfer record #${selectedTransfer.id} maps ${selectedTransfer.from_investor_name} -> ${selectedTransfer.to_investor_name}.${txLabel}`;
  }, [selectedTransfer]);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoadingOptions(true);
      try {
        const response = await fetch("/api/transfer-form-options", { cache: "no-store" });
        const payload = (await response.json()) as OptionsEnvelope;
        if (!response.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Failed to load passport form options.");
        }
        if (!active) {
          return;
        }
        setTransferOptions(payload.data.transfers);
        const firstTransferId = payload.data.transfers[0]?.id;
        setTransferRecordId(firstTransferId ? String(firstTransferId) : "");
        setTransferIdOnchainOverride("");
        setToAddressOverride("");
        setEncryptedAmount("");
        setInputProof("0x");
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

    setProofGenerating(true);
    try {
      const generated = await generateEncryptedAmountAndProof(
        {
          amount: selectedTransferAmountBigInt,
          contractAddress: contractAddresses.transferController,
          chainId: TARGET_CHAIN_ID,
        },
        proofAdapter,
      );

      if (!generated.ok) {
        throw new Error([generated.message, generated.detail, generated.action].filter(Boolean).join(" "));
      }

      setEncryptedAmount(generated.encryptedAmount);
      setInputProof(generated.inputProof);
      setSuccess(`Encrypted amount dan input proof dibuat lewat ${generated.adapter}.`);
    } catch (proofError) {
      setError(decodeWeb3FlowError(proofError, "Failed to generate NOX proof."));
    } finally {
      setProofGenerating(false);
    }
  }

  async function submit() {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (!transferRecordIdNumber) {
      setError("Transfer record ID must be a positive integer.");
      return;
    }
    if (!transferIdOnchainValid) {
      setError("Transfer ID on-chain must be a bytes32 hex value.");
      return;
    }
    if (!hasWallet || !address) {
      setError("Connect wallet before issuing passport.");
      return;
    }
    if (!policyHashValid || !disclosureDataIdValid || !anchorHashValid) {
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
    if (!encryptedAmountValid || !inputProofValid) {
      setError("Encrypted amount must be bytes32 and input proof must be valid hex bytes.");
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
        disclosure_data_id: disclosureDataId.trim() as `0x${string}`,
        policy_hash: policyHash.trim() as `0x${string}`,
        anchor_hash: anchorHash.trim() as `0x${string}`,
        transfer_id_onchain: transferIdOnchain as `0x${string}`,
      });

      const anchorResultHash = await writeContractAsync({
        address: contractAddresses.auditAnchor,
        abi: getContractAbi("auditAnchor"),
        functionName: "commitAnchor",
        args: [prechecked.anchor_hash, reason.trim()],
        chainId: TARGET_CHAIN_ID,
      });

      const transferResultHash = await writeContractAsync({
        address: contractAddresses.transferController,
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

      const response = await fetch("/api/compliance/passports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          transfer_record_id: transferRecordIdNumber,
          transfer_id_onchain: prechecked.transfer_id_onchain,
          disclosure_scope: scope.split(",").map((value) => value.trim()).filter(Boolean),
          policy_hash: prechecked.policy_hash,
          disclosure_data_id: prechecked.disclosure_data_id,
          anchor_hash: prechecked.anchor_hash,
          transfer_tx_hash: transferResultHash,
          anchor_tx_hash: anchorResultHash,
          reason: reason.trim(),
        }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(
          `${payload.error || "Failed to issue passport."} Transfer tx: ${transferResultHash}. Anchor tx: ${anchorResultHash}`,
        );
      }

      setSuccess("Compliance passport issued and backend record updated.");
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
        description="Backend transfer record ID and on-chain transfer ID are handled as separate inputs so the payload and UI stay unambiguous."
        meta={<StatusBadge tone={formReady && hasWallet && onTargetChain ? "success" : "warning"}>{formReady && hasWallet && onTargetChain ? "Ready to issue" : "Needs input"}</StatusBadge>}
      />

      <InlineNotice
        title="Transfer ID distinction"
        description="`transfer_record_id` is the backend database record used for passport storage. `transfer_id_onchain` is the bytes32 value passed into the smart contract call and may differ in future environments."
        tone="neutral"
      />

      <SectionCard title="Passport form" description="Select an existing transfer record to reuse investor wallet mapping and recorded transfer context.">
        <div className="grid gap-4">
          <div className="space-y-2">
            <label htmlFor="transfer-record-id" className="text-sm font-medium text-foreground">Transfer record ID (backend)</label>
            <select
              id="transfer-record-id"
              value={transferRecordId}
              onChange={(event) => {
                setTransferRecordId(event.target.value);
                setTransferIdOnchainOverride("");
                setToAddressOverride("");
                setEncryptedAmount("");
                setInputProof("0x");
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
            <label htmlFor="transfer-id-onchain" className="text-sm font-medium text-foreground">Transfer ID on-chain</label>
            <input
              id="transfer-id-onchain"
              value={transferIdOnchain}
              onChange={(event) => setTransferIdOnchainOverride(event.target.value)}
              placeholder="Bytes32 transfer ID used by contract"
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

          <input value={policyHash} onChange={(event) => setPolicyHash(event.target.value)} placeholder="Policy hash (bytes32)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <input value={disclosureDataId} onChange={(event) => setDisclosureDataId(event.target.value)} placeholder="Disclosure data ID (bytes32)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <input value={anchorHash} onChange={(event) => setAnchorHash(event.target.value)} placeholder="Anchor hash (bytes32)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <div className="space-y-2">
            <input value={toAddress} onChange={(event) => setToAddressOverride(event.target.value)} placeholder="Recipient wallet (0x...)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
            <p className="text-xs leading-5 text-muted">
              {selectedTransfer?.to_investor_wallet_address
                ? `Auto-filled from recipient investor #${selectedTransfer.to_investor_id} wallet mapping.`
                : "Manual wallet input required because the selected transfer recipient has no wallet mapping."}
            </p>
          </div>
          <div className="space-y-2">
            <input value={encryptedAmount} onChange={(event) => setEncryptedAmount(event.target.value)} placeholder="Encrypted amount (bytes32)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void generateProof()}
                disabled={!hasWallet || !onTargetChain || !selectedTransferAmountBigInt || proofGenerating}
              >
                {proofGenerating ? "Generating NOX proof..." : "Generate NOX proof"}
              </Button>
              <p className="text-xs leading-5 text-muted">
                Uses selected transfer amount `{selectedTransferAmount || "-"}` against `TransferController`.
              </p>
            </div>
          </div>
          <textarea value={inputProof} onChange={(event) => setInputProof(event.target.value)} placeholder="Input proof (0x...)" rows={3} className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none" />
          <input value={scope} onChange={(event) => setScope(event.target.value)} placeholder="Disclosure scope (comma-separated)" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none" />
          <input value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Reason" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none" />
          <div className="flex gap-3">
            <Button onClick={() => void submit()} disabled={busy || loadingOptions}>{busy ? "Issuing..." : "Issue passport"}</Button>
            <Button variant="secondary" href="/compliance/passports">Cancel</Button>
          </div>
          {!hasWallet ? <p className="text-sm text-danger">Wallet not connected.</p> : null}
          {hasWallet && !onTargetChain ? <p className="text-sm text-danger">Wrong network. Use Arbitrum Sepolia.</p> : null}
          {!selectedTransferAmountBigInt && selectedTransfer ? <p className="text-sm text-danger">Selected transfer amount must be an integer to generate NOX proof.</p> : null}
        </div>
      </SectionCard>

      {error ? <InlineNotice title="Issue passport failed" description={error} tone="danger" /> : null}
      {success ? <InlineNotice title="Passport submitted" description={success} tone="success" /> : null}
      {result ? (
        <SectionCard title="Passport result" description="Stored backend metadata and new on-chain references are summarized together after submission.">
          <DetailList
            items={[
              { label: "Transfer record ID", value: `#${result.transferRecordId}` },
              { label: "Transfer ID on-chain", value: <span className="font-mono text-xs">{result.transferIdOnchain}</span> },
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

      <SectionCard title="Integration seam" description="This flow already routes pre-check and error decoding through a local adapter seam so shared `frontend/lib/web3` helpers can be wired in later without duplicating the page logic.">
        <p className="text-sm leading-6 text-muted">
          When the shared helper arrives, replace the local adapter constant instead of rewriting the form submit path.
        </p>
      </SectionCard>
    </div>
  );
}
