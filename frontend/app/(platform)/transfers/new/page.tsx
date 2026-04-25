"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { isAddress, isHex, type Address } from "viem";
import { useAccount, useChainId, useSwitchChain, useWalletClient, useWriteContract } from "wagmi";

import {
  TARGET_CHAIN_ID,
  decodeWeb3FlowError,
  isBytes32Hex,
  runOptionalWeb3Precheck,
  type OptionalWeb3FlowAdapter,
} from "@/app/_lib/onchain-flow";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { organization } from "@/lib/site-data";
import { contractAddresses, getContractAbi } from "@/lib/web3/contracts";
import { decodeTransferControllerError } from "@/lib/web3/errors";
import { getTransferPrecheckStatus, getTransferReadinessItems, type TransferPrecheckStatus } from "@/lib/web3/prechecks";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof, getProofReadinessItems } from "@/lib/web3/proof";

type TransferEnvelope = {
  success: boolean;
  data?: {
    id: number;
    asset_id: number;
    from_investor_id: number;
    to_investor_id: number;
    amount: number;
    tx_hash?: string | null;
  };
  error?: string | null;
};

type InvestorOption = {
  id: number;
  name: string;
  wallet_address: string | null;
};

type TransferFormOptionsEnvelope = {
  success: boolean;
  data?: {
    assets: Array<{ id: number; name: string }>;
    investors: InvestorOption[];
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
    content: string;
    data_id?: string | null;
    grantee?: string | null;
    expires_at?: number | null;
    tx_hash?: string | null;
  }>;
  error?: string | null;
};

type TransferPrecheckInput = {
  sender_wallet: string;
  recipient_wallet: string;
  encrypted_amount: `0x${string}`;
  input_proof: `0x${string}`;
  disclosure_data_id: `0x${string}`;
};

type TransferResult = {
  transferRecordId: number;
  txHash: string;
  recipientWallet: string;
  senderWallet: string;
  disclosureDataId: string;
  senderInvestorName: string;
  recipientInvestorName: string;
  backendTxPersisted: boolean;
};

export default function NewTransferPage() {
  const router = useRouter();
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [assetOptions, setAssetOptions] = useState<Array<{ id: number; name: string }>>([]);
  const [investorOptions, setInvestorOptions] = useState<InvestorOption[]>([]);
  const [disclosureOptions, setDisclosureOptions] = useState<NonNullable<DisclosureOptionsEnvelope["data"]>>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [fromInvestorId, setFromInvestorId] = useState<number>(0);
  const [toInvestorId, setToInvestorId] = useState<number>(0);
  const [recipientAddressOverride, setRecipientAddressOverride] = useState("");
  const [amount, setAmount] = useState("");
  const [encryptedAmount, setEncryptedAmount] = useState("");
  const [inputProof, setInputProof] = useState("0x");
  const [disclosureDataId, setDisclosureDataId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [operatorGranting, setOperatorGranting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [precheckStatus, setPrecheckStatus] = useState<TransferPrecheckStatus | null>(null);
  const [currentUnix] = useState(() => Math.floor(Date.now() / 1000));

  const trimmedAmount = amount.trim();
  const parsedAmount = Number(trimmedAmount);
  const amountBigInt = /^\d+$/.test(trimmedAmount) ? BigInt(trimmedAmount) : null;
  const amountValid = amountBigInt !== null && amountBigInt > BigInt(0);
  const fromInvestor = investorOptions.find((item) => item.id === fromInvestorId) ?? null;
  const recipientInvestor = investorOptions.find((item) => item.id === toInvestorId) ?? null;
  const sourceWallet = fromInvestor?.wallet_address ?? "";
  const sourceWalletTrimmed = sourceWallet.trim();
  const sourceWalletValid = isAddress(sourceWalletTrimmed);
  const recipientAddress = recipientAddressOverride || recipientInvestor?.wallet_address || "";
  const recipientAddressTrimmed = recipientAddress.trim();
  const recipientAddressValid = isAddress(recipientAddressTrimmed);
  const encryptedAmountTrimmed = encryptedAmount.trim();
  const disclosureDataIdTrimmed = disclosureDataId.trim();
  const inputProofTrimmed = inputProof.trim();
  const encryptedAmountValid = isBytes32Hex(encryptedAmountTrimmed);
  const disclosureDataIdValid = isBytes32Hex(disclosureDataIdTrimmed);
  const inputProofValid = isHex(inputProofTrimmed);
  const hasConnectedWallet = Boolean(address);
  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const selectedAssetName = assetOptions.find((item) => item.id === assetId)?.name ?? "Unknown";
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const sourceMatchesConnectedWallet =
    Boolean(address && sourceWalletValid && address.toLowerCase() === sourceWalletTrimmed.toLowerCase());
  const assetDisclosureOptions = useMemo(
    () =>
      disclosureOptions
        .filter((item) => item.asset_id === assetId && item.data_id)
        .filter((item) => !item.expires_at || item.expires_at > currentUnix)
        .sort((left, right) => {
          const leftMatchesCaller = Boolean(left.grantee && address && left.grantee.toLowerCase() === address.toLowerCase());
          const rightMatchesCaller = Boolean(right.grantee && address && right.grantee.toLowerCase() === address.toLowerCase());
          if (leftMatchesCaller !== rightMatchesCaller) {
            return leftMatchesCaller ? -1 : 1;
          }
          return left.id - right.id;
        }),
    [address, assetId, currentUnix, disclosureOptions],
  );
  const selectedDisclosure = useMemo(
    () => assetDisclosureOptions.find((item) => item.data_id === disclosureDataIdTrimmed) ?? null,
    [assetDisclosureOptions, disclosureDataIdTrimmed],
  );
  const selectedDisclosureExpired = Boolean(
    selectedDisclosure?.expires_at && selectedDisclosure.expires_at <= currentUnix,
  );
  const selectedDisclosureMatchesCaller = Boolean(
    !selectedDisclosure?.grantee ||
      !address ||
      selectedDisclosure.grantee.toLowerCase() === address.toLowerCase(),
  );
  const proofReadiness = getProofReadinessItems({
    hasWallet: hasConnectedWallet,
    onTargetChain,
    amountValid,
    adapterReady: Boolean(proofAdapter),
  });
  const onchainReadiness = getTransferReadinessItems(precheckStatus);
  const formReadiness = [
    {
      label: "Sender wallet",
      ready: sourceWalletValid,
      detail: sourceWalletValid ? "Sender investor has a mapped wallet." : "Sender investor needs a valid wallet mapping.",
    },
    {
      label: "Recipient wallet",
      ready: recipientAddressValid,
      detail: recipientAddressValid ? "Recipient wallet is ready." : "Recipient wallet must be a valid EVM address.",
    },
    {
      label: "Disclosure selection",
      ready: disclosureDataIdValid && !selectedDisclosureExpired && selectedDisclosureMatchesCaller,
      detail: !disclosureDataIdValid
        ? "Provide a valid bytes32 disclosure data ID."
        : selectedDisclosureExpired
          ? "Selected disclosure is expired."
          : !selectedDisclosureMatchesCaller
            ? "Selected disclosure grantee does not match the connected caller wallet."
            : "Disclosure selection is usable for pre-check.",
    },
  ];

  const canSubmit =
    amountValid &&
    sourceWalletValid &&
    recipientAddressValid &&
    encryptedAmountValid &&
    disclosureDataIdValid &&
    inputProofValid &&
    assetId > 0 &&
    fromInvestorId > 0 &&
    toInvestorId > 0 &&
    hasConnectedWallet &&
    onTargetChain &&
    Boolean(precheckStatus?.ok) &&
    !submitting &&
    !proofGenerating &&
    !precheckLoading &&
    !loadingOptions;

  const transferFlowAdapter = useMemo<OptionalWeb3FlowAdapter<TransferPrecheckInput> | undefined>(() => {
    if (!address || !sourceWalletValid || !disclosureDataIdValid) {
      return undefined;
    }

    return {
      async precheck(input) {
        const status = await getTransferPrecheckStatus({
          disclosureDataId: input.disclosure_data_id,
          caller: address,
          from: sourceWalletTrimmed as Address,
        });
        setPrecheckStatus(status);
        if (!status.ok) {
          throw new Error(status.summary);
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
  }, [address, disclosureDataIdValid, sourceWalletTrimmed, sourceWalletValid]);

  const recipientWalletHint = useMemo(() => {
    if (recipientInvestor?.wallet_address) {
      return `Auto-filled from investor #${recipientInvestor.id} wallet mapping.`;
    }
    if (recipientInvestor) {
      return `Investor #${recipientInvestor.id} has no wallet mapping yet. Manual wallet entry is required.`;
    }
    return "Select recipient investor to reuse backend wallet mapping.";
  }, [recipientInvestor]);

  useEffect(() => {
    let active = true;
    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const [optionsResponse, disclosuresResponse] = await Promise.all([
          fetch("/api/transfer-form-options", { cache: "no-store" }),
          fetch("/api/disclosures", { cache: "no-store" }),
        ]);
        const payload = (await optionsResponse.json()) as TransferFormOptionsEnvelope;
        const disclosuresPayload = (await disclosuresResponse.json()) as DisclosureOptionsEnvelope;
        if (!optionsResponse.ok || !payload.success || !payload.data) {
          throw new Error(payload.error || "Failed to load transfer form options.");
        }
        if (!disclosuresResponse.ok || !disclosuresPayload.success || !disclosuresPayload.data) {
          throw new Error(disclosuresPayload.error || "Failed to load disclosure options.");
        }
        if (!active) {
          return;
        }
        const data = payload.data;
        const senderInvestor = data.investors.find((item) => item.wallet_address) ?? data.investors[0];
        const recipientInvestor =
          data.investors.find((item) => item.id !== senderInvestor?.id && item.wallet_address) ??
          data.investors.find((item) => item.id !== senderInvestor?.id) ??
          data.investors[0];
        const initialAssetId = data.assets[0]?.id || 0;
        const initialDisclosureId =
          disclosuresPayload.data
            .filter((item) => item.asset_id === initialAssetId && item.data_id)
            .find((item) => !item.grantee || !address || item.grantee.toLowerCase() === address.toLowerCase())
            ?.data_id ?? "";

        setAssetOptions(data.assets);
        setInvestorOptions(data.investors);
        setDisclosureOptions(disclosuresPayload.data);
        setAssetId((current) => current || initialAssetId);
        setFromInvestorId((current) => current || senderInvestor?.id || 0);
        setToInvestorId((current) => current || recipientInvestor?.id || 0);
        setDisclosureDataId((current) => current || initialDisclosureId);
      } catch (loadError) {
        if (!active) {
          return;
        }
        setError(decodeWeb3FlowError(loadError, "Failed to load transfer form options."));
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }
    void loadOptions();
    return () => {
      active = false;
    };
  }, [address]);

  useEffect(() => {
    let active = true;

    async function runPrecheck() {
      if (!address || !sourceWalletValid || !disclosureDataIdValid) {
        setPrecheckStatus(null);
        return;
      }

      setPrecheckLoading(true);
      try {
        const status = await getTransferPrecheckStatus({
          disclosureDataId: disclosureDataIdTrimmed as `0x${string}`,
          caller: address,
          from: sourceWalletTrimmed as Address,
        });
        if (!active) {
          return;
        }
        setPrecheckStatus(status);
      } catch (precheckError) {
        if (!active) {
          return;
        }
        setPrecheckStatus({
          ok: false,
          summary: decodeWeb3FlowError(precheckError, "Pre-check on-chain gagal."),
          checks: {
            disclosure: {
              kind: "disclosure",
              ok: false,
              state: "error",
              code: "READ_FAILED",
              summary: "Pre-check disclosure gagal.",
              disclosureDataId: disclosureDataIdTrimmed as `0x${string}`,
              caller: address,
              hasDisclosure: null,
            },
            operator: {
              kind: "operator",
              ok: false,
              state: "error",
              code: "READ_FAILED",
              summary: "Pre-check operator gagal.",
              from: sourceWalletTrimmed as Address,
              transferController: contractAddresses.transferController,
              isOperator: null,
            },
          },
        });
      } finally {
        if (active) {
          setPrecheckLoading(false);
        }
      }
    }

    void runPrecheck();
    return () => {
      active = false;
    };
  }, [address, disclosureDataIdTrimmed, disclosureDataIdValid, sourceWalletTrimmed, sourceWalletValid]);

  async function generateProof() {
    setError(null);

    if (!hasConnectedWallet) {
      setError("Connect wallet before generating encrypted amount and proof.");
      return;
    }
    if (!onTargetChain) {
      setError(`Wallet is on the wrong network. Switch to Arbitrum Sepolia (chain ID ${TARGET_CHAIN_ID}) first.`);
      return;
    }
    if (!amountValid || amountBigInt === null) {
      setError("Amount harus integer positif agar bisa dienkripsi sebagai uint256.");
      return;
    }

    setProofGenerating(true);
    try {
      const generated = await generateEncryptedAmountAndProof(
        {
          amount: amountBigInt,
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

  async function grantOperator() {
    setError(null);
    setSuccess(null);

    if (!sourceWalletValid) {
      setError("Sender investor belum punya wallet mapping valid.");
      return;
    }
    if (!address || !sourceMatchesConnectedWallet) {
      setError("Connect the sender investor wallet before granting operator access.");
      return;
    }
    if (!onTargetChain) {
      setError(`Wallet is on the wrong network. Switch to Arbitrum Sepolia (chain ID ${TARGET_CHAIN_ID}) first.`);
      return;
    }

    setOperatorGranting(true);
    try {
      const until = BigInt(Math.floor(Date.now() / 1000) + 60 * 60);
      const txHash = await writeContractAsync({
        address: contractAddresses.confidentialRwaToken,
        abi: getContractAbi("confidentialRwaToken"),
        functionName: "setOperator",
        args: [contractAddresses.transferController, until],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(300000),
      });
      const status = await getTransferPrecheckStatus({
        disclosureDataId: disclosureDataIdTrimmed as `0x${string}`,
        caller: address,
        from: sourceWalletTrimmed as Address,
      });
      setPrecheckStatus(status);
      setSuccess(`Operator granted. Tx hash: ${txHash}`);
    } catch (grantError) {
      setError(decodeWeb3FlowError(grantError, "Failed to grant operator access."));
    } finally {
      setOperatorGranting(false);
    }
  }

  async function submitTransfer() {
    setError(null);
    setSuccess(null);
    setResult(null);

    if (fromInvestorId === toInvestorId) {
      setError("Sender and recipient investor must be different records.");
      return;
    }
    if (!hasConnectedWallet || !address) {
      setError("Connect wallet before submitting transfer.");
      return;
    }
    if (!sourceWalletValid) {
      setError("Sender investor belum punya wallet mapping valid di backend registry.");
      return;
    }
    if (!recipientAddressValid) {
      setError("Recipient wallet address is invalid. Use EVM address format `0x...`.");
      return;
    }
    if (!amountValid) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!encryptedAmountValid) {
      setError("Encrypted amount must be bytes32 (`0x` + 64 hex chars).");
      return;
    }
    if (!disclosureDataIdValid) {
      setError("Disclosure data ID must be bytes32 (`0x` + 64 hex chars).");
      return;
    }
    if (!inputProofValid) {
      setError("Input proof must be valid hex bytes (`0x...`).");
      return;
    }

    setSubmitting(true);
    try {
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }

        const prechecked = await runOptionalWeb3Precheck(transferFlowAdapter, {
        sender_wallet: sourceWalletTrimmed,
        recipient_wallet: recipientAddressTrimmed,
        encrypted_amount: encryptedAmountTrimmed as `0x${string}`,
        input_proof: inputProofTrimmed as `0x${string}`,
        disclosure_data_id: disclosureDataIdTrimmed as `0x${string}`,
      });

      const txHash = await writeContractAsync({
        address: contractAddresses.transferController,
        abi: getContractAbi("transferController"),
        functionName: "confidentialTransferFromWithDisclosure",
        args: [
          prechecked.sender_wallet as Address,
          prechecked.recipient_wallet as Address,
          prechecked.encrypted_amount,
          prechecked.input_proof,
          prechecked.disclosure_data_id,
        ],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(900000),
      });

      const response = await fetch("/api/transfers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          asset_id: assetId,
          from_investor_id: fromInvestorId,
          to_investor_id: toInvestorId,
          amount: parsedAmount,
          tx_hash: txHash,
          sender_wallet_address: prechecked.sender_wallet,
          recipient_wallet_address: prechecked.recipient_wallet,
          disclosure_data_id: prechecked.disclosure_data_id,
          reference_note: reference.trim(),
        }),
      });
      const payload = (await response.json()) as TransferEnvelope;

      if (!response.ok || !payload.success || !payload.data) {
        throw new Error(
          payload.error
            ? `${payload.error} On-chain transfer hash: ${txHash}`
            : `On-chain transfer succeeded, but backend metadata persistence failed. Transfer hash: ${txHash}`,
        );
      }

      const backendTxPersisted = Boolean(payload.data.tx_hash);
      if (!backendTxPersisted) {
        throw new Error(`On-chain transfer succeeded, but backend did not persist tx_hash. Transfer hash: ${txHash}`);
      }
      setSuccess("Confidential transfer submitted and backend record updated.");
      setResult({
        transferRecordId: payload.data.id,
        txHash,
        senderWallet: prechecked.sender_wallet,
        recipientWallet: prechecked.recipient_wallet,
        disclosureDataId: prechecked.disclosure_data_id,
        senderInvestorName: fromInvestor?.name || `Investor #${fromInvestorId}`,
        recipientInvestorName: recipientInvestor?.name || `Investor #${toInvestorId}`,
        backendTxPersisted,
      });
      router.refresh();
    } catch (submitError) {
      setError(decodeWeb3FlowError(submitError, "Failed to submit transfer.", transferFlowAdapter));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <Link href="/transfers" className="inline-flex items-center gap-2 text-sm text-muted transition-colors hover:text-foreground">
        Back to transfers
      </Link>

      <PageHeader
        eyebrow="Transfer execution"
        title="Create transfer"
        description="Execute transfer on-chain first, then persist the backend record with investor IDs and new on-chain metadata."
        meta={<StatusBadge tone="accent">Zero-knowledge enabled</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-[1.15fr_.85fr]">
        <div className="space-y-6">
          <SectionCard title="Transfer form" description="Investor selections reuse backend wallet mapping. Manual wallet entry is only needed when the mapping is missing.">
            <form
              className="grid gap-5 md:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault();
                void submitTransfer();
              }}
            >
              <div className="md:col-span-2 space-y-2">
                <label htmlFor="asset" className="text-sm font-medium text-foreground">Select asset</label>
                <select
                  id="asset"
                  value={assetId}
                  onChange={(event) => {
                    const nextAssetId = Number(event.target.value);
                    const nextDisclosureId =
                      disclosureOptions
                        .filter((item) => item.asset_id === nextAssetId && item.data_id)
                        .find((item) => !item.grantee || !address || item.grantee.toLowerCase() === address.toLowerCase())
                        ?.data_id ?? "";
                    setAssetId(nextAssetId);
                    setDisclosureDataId(nextDisclosureId);
                  }}
                  disabled={loadingOptions || !assetOptions.length}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  {assetOptions.map((option) => (
                    <option key={option.id} value={option.id}>{option.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label htmlFor="sender-investor" className="text-sm font-medium text-foreground">Sender investor</label>
                <select
                  id="sender-investor"
                  value={fromInvestorId}
                  onChange={(event) => setFromInvestorId(Number(event.target.value))}
                  disabled={loadingOptions || !investorOptions.length}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  {investorOptions.map((option) => (
                    <option key={option.id} value={option.id}>{`#${option.id} - ${option.name}`}</option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted">
                  Sender wallet from registry: {fromInvestor?.wallet_address || "not mapped"}
                </p>
              </div>

              <div className="space-y-2">
                <label htmlFor="recipient-investor" className="text-sm font-medium text-foreground">Recipient investor</label>
                <select
                  id="recipient-investor"
                  value={toInvestorId}
                  onChange={(event) => {
                    setToInvestorId(Number(event.target.value));
                    setRecipientAddressOverride("");
                  }}
                  disabled={loadingOptions || !investorOptions.length}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  {investorOptions.map((option) => (
                    <option key={option.id} value={option.id}>{`#${option.id} - ${option.name}`}</option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="recipient-address" className="text-sm font-medium text-foreground">Recipient wallet address</label>
                <input
                  id="recipient-address"
                  value={recipientAddress}
                  onChange={(event) => setRecipientAddressOverride(event.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
                <p className="text-xs leading-5 text-muted">{recipientWalletHint}</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="amount" className="text-sm font-medium text-foreground">Amount</label>
                <input
                  id="amount"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
                />
                <p className="text-xs leading-5 text-muted">Proof NOX saat ini digenerate untuk `uint256`, jadi amount harus bilangan bulat positif.</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="reference-note" className="text-sm font-medium text-foreground">Reference note</label>
                <input
                  id="reference-note"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  placeholder="Internal context for ops or audit"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="encrypted-amount" className="text-sm font-medium text-foreground">Encrypted amount (bytes32)</label>
                <input
                  id="encrypted-amount"
                  value={encryptedAmount}
                  onChange={(event) => setEncryptedAmount(event.target.value)}
                  placeholder="0x + 64 hex chars"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void generateProof()}
                    disabled={!hasConnectedWallet || !onTargetChain || !amountValid || proofGenerating}
                  >
                    {proofGenerating ? "Generating NOX proof..." : "Generate NOX proof"}
                  </Button>
                  <p className="text-xs leading-5 text-muted">
                    Generator memakai wallet yang sedang terhubung dan target kontrak `TransferController`.
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="input-proof" className="text-sm font-medium text-foreground">Input proof (hex bytes)</label>
                <textarea
                  id="input-proof"
                  rows={3}
                  value={inputProof}
                  onChange={(event) => setInputProof(event.target.value)}
                  placeholder="0x..."
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="disclosure-option" className="text-sm font-medium text-foreground">Disclosure option</label>
                <select
                  id="disclosure-option"
                  value={disclosureDataIdTrimmed}
                  onChange={(event) => setDisclosureDataId(event.target.value)}
                  disabled={!assetDisclosureOptions.length}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  <option value="">Select disclosure for this asset</option>
                  {assetDisclosureOptions.map((option) => (
                    <option key={option.id} value={option.data_id ?? ""}>
                      {`#${option.id} - ${option.title}${option.grantee ? ` -> ${option.grantee}` : ""}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted">
                  Uses disclosure records already stored in backend metadata. Manual bytes32 input is still available below.
                </p>
                {assetDisclosureOptions.length ? (
                  <p className="text-xs leading-5 text-muted">
                    Active disclosures are shown first, and grants for the connected caller wallet are prioritized.
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="disclosure-data-id" className="text-sm font-medium text-foreground">Disclosure data ID (bytes32)</label>
                <input
                  id="disclosure-data-id"
                  value={disclosureDataId}
                  onChange={(event) => setDisclosureDataId(event.target.value)}
                  placeholder="0x + 64 hex chars"
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
                <p className="text-xs leading-5 text-muted">
                  Sent to the contract call and included in the frontend API payload for future backend expansion.
                </p>
                {selectedDisclosure ? (
                  <p className="text-xs leading-5 text-muted">
                    Selected grant grantee: <span className="font-mono text-xs text-foreground">{selectedDisclosure.grantee || "N/A"}</span>
                  </p>
                ) : null}
                {selectedDisclosure?.expires_at ? (
                  <p className="text-xs leading-5 text-muted">
                    Selected grant expiry: <span className="text-foreground">{new Date(selectedDisclosure.expires_at * 1000).toLocaleString()}</span>
                  </p>
                ) : null}
              </div>
            </form>
          </SectionCard>

          {success ? <InlineNotice title="Transfer submitted" description={success} tone="success" /> : null}
          {error ? <InlineNotice title="Transfer failed" description={error} tone="danger" /> : null}
          {result ? (
            <SectionCard title="On-chain result" description="New on-chain metadata is preserved in the UI summary, and supported fields are persisted to backend.">
              <DetailList
                items={[
                  { label: "Transfer record ID", value: `#${result.transferRecordId}` },
                  { label: "Transfer hash", value: <span className="font-mono text-xs">{result.txHash}</span> },
                  { label: "Sender wallet", value: <span className="font-mono text-xs">{result.senderWallet}</span> },
                  { label: "Disclosure data ID", value: <span className="font-mono text-xs">{result.disclosureDataId}</span> },
                  { label: "Recipient wallet", value: <span className="font-mono text-xs">{result.recipientWallet}</span> },
                  { label: "From", value: result.senderInvestorName },
                  { label: "To", value: result.recipientInvestorName },
                  { label: "Backend tx persistence", value: result.backendTxPersisted ? "Persisted" : "Backend tx_hash not stored in this environment" },
                ]}
              />
              <div className="mt-5 flex gap-3">
                <Button href="/transfers">View transfers</Button>
                <Button variant="secondary" onClick={() => setResult(null)}>Start another transfer</Button>
              </div>
            </SectionCard>
          ) : null}
        </div>

        <div className="space-y-6">
          <SectionCard title="Transfer preview">
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Asset</span>
                <span className="text-sm font-semibold text-foreground">{selectedAssetName}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Sender</span>
                <span className="text-sm font-semibold text-foreground">{fromInvestor ? `#${fromInvestor.id} ${fromInvestor.name}` : "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Source wallet</span>
                <span className="font-mono text-xs text-foreground">{sourceWalletValid ? sourceWalletTrimmed : "not mapped"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Recipient</span>
                <span className="text-sm font-semibold text-foreground">{recipientInvestor ? `#${recipientInvestor.id} ${recipientInvestor.name}` : "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Recipient wallet</span>
                <span className="font-mono text-xs text-foreground">{recipientAddressValid ? recipientAddressTrimmed : "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Disclosure data ID</span>
                <span className="font-mono text-xs text-foreground">{disclosureDataIdValid ? disclosureDataIdTrimmed : "-"}</span>
              </div>
              <div className="flex items-center justify-between border-b border-border pb-3">
                <span className="text-sm text-muted">Amount</span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">{amountValid ? `$${parsedAmount.toLocaleString()}` : "$0.00"}</p>
                  <p className="text-xs text-muted">Encrypted amount submitted separately</p>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted">Estimated gas fee</span>
                <span className="text-sm font-semibold text-foreground">~0.0004 ETH</span>
              </div>
            </div>
            <div className="mt-5 rounded-2xl bg-surface-soft p-4">
              <div className="space-y-3 text-sm leading-6 text-muted">
                <p>Caller wallet for disclosure check: <span className="font-mono text-xs text-foreground">{address || "not connected"}</span></p>
                <p>Holder wallet for operator check: <span className="font-mono text-xs text-foreground">{sourceWalletValid ? sourceWalletTrimmed : "not mapped"}</span></p>
                <p>Connected wallet matches holder: {sourceMatchesConnectedWallet ? "yes" : "no"}</p>
                <p>
                  Pre-check status:{" "}
                  {precheckLoading
                    ? "checking on-chain..."
                    : precheckStatus
                      ? precheckStatus.summary
                      : "enter disclosure data id and use a sender investor with mapped wallet"}
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3">
              {[...formReadiness, ...onchainReadiness, ...proofReadiness].map((item) => (
                <div key={item.label} className="rounded-2xl border border-border bg-surface-soft p-4">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <StatusBadge tone={item.ready ? "success" : "warning"}>{item.ready ? "Ready" : "Blocked"}</StatusBadge>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted">{item.detail}</p>
                </div>
              ))}
            </div>
            <div className="mt-5 flex flex-col gap-3">
              <Button
                variant="secondary"
                className="w-full justify-center"
                onClick={() => void grantOperator()}
                disabled={!sourceWalletValid || !sourceMatchesConnectedWallet || !disclosureDataIdValid || operatorGranting}
              >
                {operatorGranting ? "Granting operator..." : "Set transfer controller as operator"}
              </Button>
              <Button className="w-full justify-center" onClick={() => void submitTransfer()} disabled={!canSubmit}>
                {submitting ? "Submitting on-chain..." : "Initiate confidential transfer"}
              </Button>
              <Button variant="secondary" className="w-full justify-center" href="/transfers">
                Back to transfer log
              </Button>
            </div>
            {!hasConnectedWallet ? <p className="mt-3 text-sm text-danger">Wallet not connected. Connect wallet before transfer.</p> : null}
            {hasConnectedWallet && !onTargetChain ? (
              <p className="mt-3 text-sm text-danger">Wrong network. Switch wallet to Arbitrum Sepolia (chain ID {TARGET_CHAIN_ID}).</p>
            ) : null}
            {!sourceWalletValid && fromInvestor ? <p className="mt-3 text-sm text-danger">Sender investor must have a valid mapped wallet address.</p> : null}
            {sourceWalletValid && hasConnectedWallet && !sourceMatchesConnectedWallet ? (
              <p className="mt-3 text-sm text-danger">Connect the sender investor wallet to use the operator helper and submit the transfer from the correct holder.</p>
            ) : null}
            {!recipientAddressValid && recipientAddressTrimmed ? <p className="mt-3 text-sm text-danger">Recipient wallet address is not valid.</p> : null}
            {!amountValid && trimmedAmount ? <p className="mt-3 text-sm text-danger">Amount must be a positive integer for NOX proof generation.</p> : null}
            {!encryptedAmountValid && encryptedAmountTrimmed ? <p className="mt-3 text-sm text-danger">Encrypted amount must be bytes32.</p> : null}
            {!disclosureDataIdValid && disclosureDataIdTrimmed ? <p className="mt-3 text-sm text-danger">Disclosure data ID must be bytes32.</p> : null}
            {!inputProofValid && inputProofTrimmed ? <p className="mt-3 text-sm text-danger">Input proof must be valid hex bytes.</p> : null}
            {precheckStatus && !precheckStatus.ok ? <p className="mt-3 text-sm text-danger">{precheckStatus.summary}</p> : null}
          </SectionCard>

          <SectionCard title="Network information">
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-muted">Network</span>
                <span className="font-medium text-foreground">{organization.networkName}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Settlement time</span>
                <span className="font-medium text-foreground">&lt; 2 minutes</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted">Privacy method</span>
                <span className="font-medium text-foreground">zk-SNARKs</span>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
