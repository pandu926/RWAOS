"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { encodeAbiParameters, isAddress, isHex, keccak256, type Address } from "viem";
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
import { web3PublicClient } from "@/lib/web3/client";
import { getContractAbi } from "@/lib/web3/contracts";
import { decodeTransferControllerError } from "@/lib/web3/errors";
import {
  getTenantRuntimePrecheckStatus,
  getTransferPrecheckStatus,
  getTransferReadinessItems,
  type TransferPrecheckStatus,
} from "@/lib/web3/prechecks";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof, getProofReadinessItems } from "@/lib/web3/proof";
import { fetchTenantBundleRuntime, type TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";

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
    assets: Array<{ id: number; name: string; issuance_wallet: string | null }>;
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
      status?: string | null;
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
  transferRecordId: number | null;
  txHash: string;
  onchainStatus: "confirmed" | "failed";
  recipientWallet: string;
  senderWallet: string;
  disclosureDataId: string;
  senderInvestorName: string;
  recipientInvestorName: string;
  backendTxPersisted: boolean;
};

function disclosureMatchesCallerWallet(
  disclosure: NonNullable<DisclosureOptionsEnvelope["data"]>[number],
  callerWallet: string | null | undefined,
): boolean {
  if (!disclosure.grantee) {
    return true;
  }
  if (!callerWallet) {
    return false;
  }
  return disclosure.grantee.toLowerCase() === callerWallet.toLowerCase();
}

function investorMatchesWallet(investor: InvestorOption | null | undefined, wallet: string | null | undefined): boolean {
  if (!investor?.wallet_address || !wallet) {
    return false;
  }
  return investor.wallet_address.trim().toLowerCase() === wallet.trim().toLowerCase();
}

export default function NewTransferPage() {
  const router = useRouter();
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();

  const [assetOptions, setAssetOptions] = useState<Array<{ id: number; name: string; issuance_wallet: string | null }>>([]);
  const [investorOptions, setInvestorOptions] = useState<InvestorOption[]>([]);
  const [transferHistoryOptions, setTransferHistoryOptions] =
    useState<NonNullable<TransferFormOptionsEnvelope["data"]>["transfers"]>([]);
  const [disclosureOptions, setDisclosureOptions] = useState<NonNullable<DisclosureOptionsEnvelope["data"]>>([]);
  const [assetId, setAssetId] = useState<number>(0);
  const [fromInvestorId, setFromInvestorId] = useState<number>(0);
  const [toInvestorId, setToInvestorId] = useState<number>(0);
  const [amount, setAmount] = useState("");
  const [encryptedAmount, setEncryptedAmount] = useState("");
  const [inputProof, setInputProof] = useState("");
  const [disclosureDataId, setDisclosureDataId] = useState("");
  const [reference, setReference] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [proofGenerating, setProofGenerating] = useState(false);
  const [operatorGranting, setOperatorGranting] = useState(false);
  const [disclosureGranting, setDisclosureGranting] = useState(false);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [precheckLoading, setPrecheckLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<TransferResult | null>(null);
  const [precheckStatus, setPrecheckStatus] = useState<TransferPrecheckStatus | null>(null);
  const [operatorTxHash, setOperatorTxHash] = useState<string | null>(null);
  const [disclosureTxHash, setDisclosureTxHash] = useState<string | null>(null);
  const [proofForKey, setProofForKey] = useState<string | null>(null);
  const [currentUnix] = useState(() => Math.floor(Date.now() / 1000));
  const [tenantRuntime, setTenantRuntime] = useState<TenantBundleRuntime | null>(null);

  const trimmedAmount = amount.trim();
  const parsedAmount = Number(trimmedAmount);
  const amountBigInt = /^\d+$/.test(trimmedAmount) ? BigInt(trimmedAmount) : null;
  const amountValid = amountBigInt !== null && amountBigInt > BigInt(0);
  const fromInvestor = investorOptions.find((item) => item.id === fromInvestorId) ?? null;
  const recipientInvestor = investorOptions.find((item) => item.id === toInvestorId) ?? null;
  const sourceWallet = fromInvestor?.wallet_address ?? "";
  const sourceWalletTrimmed = sourceWallet.trim();
  const sourceWalletValid = isAddress(sourceWalletTrimmed);
  const recipientAddress = recipientInvestor?.wallet_address || "";
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
  const selectedAsset = assetOptions.find((item) => item.id === assetId) ?? null;
  const selectedAssetIssuanceWallet = selectedAsset?.issuance_wallet?.trim() || "";
  const confirmedTransfersForAsset = useMemo(
    () =>
      transferHistoryOptions.filter(
        (item) => item.asset_id === assetId && item.status === "confirmed",
      ).length,
    [assetId, transferHistoryOptions],
  );
  const firstTransferHolderEnforced = Boolean(selectedAssetIssuanceWallet) && confirmedTransfersForAsset === 0;
  const senderMatchesIssuanceWallet =
    !firstTransferHolderEnforced ||
    (sourceWalletValid && sourceWalletTrimmed.toLowerCase() === selectedAssetIssuanceWallet.toLowerCase());
  const issuanceWalletMappedInvestor = useMemo(
    () => investorOptions.find((item) => investorMatchesWallet(item, selectedAssetIssuanceWallet)) ?? null,
    [investorOptions, selectedAssetIssuanceWallet],
  );
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const sourceMatchesConnectedWallet =
    Boolean(address && sourceWalletValid && address.toLowerCase() === sourceWalletTrimmed.toLowerCase());
  const runtimeContracts = tenantRuntime?.bundle?.contracts ?? null;
  const runtimePrecheck = useMemo(
    () => getTenantRuntimePrecheckStatus(tenantRuntime, TARGET_CHAIN_ID),
    [tenantRuntime],
  );
  const allDisclosureOptions = useMemo(
    () =>
      disclosureOptions
        .filter((item) => item.data_id)
        .filter((item) => !item.expires_at || item.expires_at > currentUnix)
        .sort((left, right) => {
          const leftMatchesCaller = Boolean(left.grantee && address && left.grantee.toLowerCase() === address.toLowerCase());
          const rightMatchesCaller = Boolean(right.grantee && address && right.grantee.toLowerCase() === address.toLowerCase());
          if (leftMatchesCaller !== rightMatchesCaller) {
            return leftMatchesCaller ? -1 : 1;
          }
          if (left.asset_id !== right.asset_id) {
            return left.asset_id - right.asset_id;
          }
          return left.id - right.id;
        }),
    [address, currentUnix, disclosureOptions],
  );
  const assetDisclosureOptions = useMemo(
    () => allDisclosureOptions.filter((item) => item.asset_id === assetId),
    [allDisclosureOptions, assetId],
  );
  const selectedDisclosure = useMemo(
    () => allDisclosureOptions.find((item) => item.data_id === disclosureDataIdTrimmed) ?? null,
    [allDisclosureOptions, disclosureDataIdTrimmed],
  );
  const selectedDisclosureExpired = Boolean(
    selectedDisclosure?.expires_at && selectedDisclosure.expires_at <= currentUnix,
  );
  const selectedDisclosureMatchesCaller = Boolean(
    !selectedDisclosure?.grantee ||
      !address ||
      selectedDisclosure.grantee.toLowerCase() === address.toLowerCase(),
  );
  const activeSenderDisclosure = useMemo(
    () =>
      assetDisclosureOptions.find((item) =>
        disclosureMatchesCallerWallet(item, sourceWalletTrimmed || address),
      ) ?? null,
    [address, assetDisclosureOptions, sourceWalletTrimmed],
  );
  const disclosureMissingForSender =
    sourceWalletValid && !activeSenderDisclosure && runtimePrecheck.ok && Boolean(runtimeContracts);
  const proofReadiness = getProofReadinessItems({
    hasWallet: hasConnectedWallet,
    onTargetChain,
    amountValid,
    adapterReady: Boolean(proofAdapter),
  });
  const proofInputKey =
    hasConnectedWallet && onTargetChain && amountBigInt !== null
      ? `${address?.toLowerCase()}:${TARGET_CHAIN_ID}:${amountBigInt.toString()}`
      : null;
  const proofReadyForInput =
    Boolean(proofInputKey) &&
    proofForKey === proofInputKey &&
    encryptedAmountValid &&
    inputProofValid;
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
      detail: recipientAddressValid
        ? "Recipient wallet is resolved from backend investor mapping."
        : "Recipient investor must have a valid mapped wallet.",
    },
    {
      label: "Initial holder alignment",
      ready: senderMatchesIssuanceWallet,
      detail: !firstTransferHolderEnforced
        ? "Asset already has confirmed transfer history, so sender is not pinned to issuance wallet."
        : !selectedAssetIssuanceWallet
          ? "Selected asset has no issuance wallet recorded."
          : senderMatchesIssuanceWallet
            ? "Sender matches the wallet that received the initial confidential mint."
            : "First transfer must use the investor mapped to the asset issuance wallet.",
    },
    {
      label: "Investor pair",
      ready: fromInvestorId > 0 && toInvestorId > 0 && fromInvestorId !== toInvestorId,
      detail:
        fromInvestorId > 0 && toInvestorId > 0 && fromInvestorId !== toInvestorId
          ? "Sender and recipient are different investor records."
          : "Sender and recipient must be different investors.",
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
    {
      label: "Tenant runtime",
      ready: runtimePrecheck.ok,
      detail: runtimePrecheck.ok ? runtimePrecheck.detail : `${runtimePrecheck.summary} ${runtimePrecheck.detail}`,
    },
    {
      label: "Proof payload",
      ready: proofReadyForInput,
      detail: proofReadyForInput
        ? "Encrypted amount + input proof were generated for current wallet/chain/amount."
        : "NOX proof must be generated in-browser for the current wallet/chain/amount.",
    },
  ];

  const canSubmit =
    amountValid &&
    sourceWalletValid &&
    recipientAddressValid &&
    proofReadyForInput &&
    disclosureDataIdValid &&
    assetId > 0 &&
    fromInvestorId > 0 &&
    toInvestorId > 0 &&
    hasConnectedWallet &&
    onTargetChain &&
    runtimePrecheck.ok &&
    Boolean(precheckStatus?.ok) &&
    !submitting &&
    !proofGenerating &&
    !disclosureGranting &&
    !precheckLoading &&
    !loadingOptions &&
    fromInvestorId !== toInvestorId &&
    senderMatchesIssuanceWallet;

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

  const transferFlowAdapter = useMemo<OptionalWeb3FlowAdapter<TransferPrecheckInput> | undefined>(() => {
    if (!address || !sourceWalletValid || !disclosureDataIdValid) {
      return undefined;
    }

    return {
      async precheck(input) {
        if (!runtimePrecheck.ok) {
          throw new Error(`${runtimePrecheck.summary} ${runtimePrecheck.action}`);
        }
        const status = await getTransferPrecheckStatus({
          disclosureDataId: input.disclosure_data_id,
          caller: address,
          from: sourceWalletTrimmed as Address,
          tokenAddress: runtimeContracts?.confidentialRwaToken as Address | undefined,
          disclosureRegistry: runtimeContracts?.disclosureRegistry as Address | undefined,
          transferController: runtimeContracts?.transferController as Address | undefined,
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
  }, [
    address,
    disclosureDataIdValid,
    runtimeContracts?.confidentialRwaToken,
    runtimeContracts?.disclosureRegistry,
    runtimeContracts?.transferController,
    runtimePrecheck.action,
    runtimePrecheck.ok,
    runtimePrecheck.summary,
    sourceWalletTrimmed,
    sourceWalletValid,
  ]);

  function deriveDisclosureDataId(): `0x${string}` {
    const nonce = BigInt(Date.now());
    return keccak256(
      encodeAbiParameters(
        [
          { type: "uint256", name: "chainId" },
          { type: "uint256", name: "assetId" },
          { type: "address", name: "holder" },
          { type: "address", name: "recipient" },
          { type: "uint256", name: "nonce" },
        ],
        [
          BigInt(TARGET_CHAIN_ID),
          BigInt(assetId),
          sourceWalletTrimmed as Address,
          recipientAddressTrimmed as Address,
          nonce,
        ],
      ),
    );
  }

  async function refreshDisclosureOptions(nextDisclosureDataId?: string) {
    const response = await fetch("/api/disclosures", { cache: "no-store" });
    const payload = (await response.json()) as DisclosureOptionsEnvelope;
    if (!response.ok || !payload.success || !payload.data) {
      throw new Error(payload.error || "Failed to refresh disclosure options.");
    }
    setDisclosureOptions(payload.data);
    if (nextDisclosureDataId) {
      setDisclosureDataId(nextDisclosureDataId);
    }
  }

  const recipientWalletHint = useMemo(() => {
    if (recipientInvestor?.wallet_address) {
      return `Auto-filled from investor #${recipientInvestor.id} wallet mapping.`;
    }
    if (recipientInvestor) {
      return `Investor #${recipientInvestor.id} has no wallet mapping yet. Complete wallet mapping before transfer.`;
    }
    return "Select recipient investor with a mapped wallet.";
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
        const disclosuresWithIds = disclosuresPayload.data.filter((item) => item.data_id);
        const scenarioTransfer =
          data.transfers.find((transfer) => {
            const matchingDisclosure = disclosuresWithIds.find(
              (disclosure) =>
                disclosure.asset_id === transfer.asset_id &&
                (!disclosure.grantee ||
                  disclosure.grantee.toLowerCase() === transfer.from_investor_wallet_address?.toLowerCase()),
            );
            return Boolean(
              transfer.from_investor_wallet_address &&
                transfer.to_investor_wallet_address &&
                matchingDisclosure,
            );
          }) ??
          data.transfers.find((transfer) => transfer.from_investor_wallet_address && transfer.to_investor_wallet_address) ??
          null;

        const scenarioAsset =
          data.assets.find((item) => item.id === (scenarioTransfer?.asset_id ?? data.assets[0]?.id ?? 0)) ?? null;
        const issuanceWallet = scenarioAsset?.issuance_wallet?.trim() || "";
        const issuanceInvestor =
          data.investors.find((item) => item.wallet_address?.trim().toLowerCase() === issuanceWallet.toLowerCase()) ?? null;
        const senderInvestor =
          issuanceInvestor ??
          data.investors.find((item) => item.id === scenarioTransfer?.from_investor_id) ??
          data.investors.find((item) => item.wallet_address) ??
          data.investors[0];
        const recipientInvestor =
          data.investors.find((item) => item.id === scenarioTransfer?.to_investor_id) ??
          data.investors.find((item) => item.id !== senderInvestor?.id && item.wallet_address) ??
          data.investors.find((item) => item.id !== senderInvestor?.id) ??
          data.investors[0];
        const initialAssetId = scenarioTransfer?.asset_id ?? data.assets[0]?.id ?? 0;
        const initialDisclosure =
          disclosuresWithIds
            .filter((item) => item.asset_id === initialAssetId)
            .find(
              (item) =>
                !item.grantee ||
                item.grantee.toLowerCase() === senderInvestor?.wallet_address?.toLowerCase() ||
                (!senderInvestor?.wallet_address && address && item.grantee.toLowerCase() === address.toLowerCase()),
            ) ??
          disclosuresWithIds
            .filter((item) => item.asset_id === initialAssetId)
            .find((item) => !item.grantee || !address || item.grantee.toLowerCase() === address.toLowerCase()) ??
          null;

        setAssetOptions(data.assets);
        setInvestorOptions(data.investors);
        setTransferHistoryOptions(data.transfers);
        setDisclosureOptions(disclosuresPayload.data);
        setAssetId((current) => current || initialAssetId);
        setFromInvestorId((current) => current || senderInvestor?.id || 0);
        setToInvestorId((current) => current || recipientInvestor?.id || 0);
        setDisclosureDataId((current) => current || initialDisclosure?.data_id || "");
        setAmount((current) => current || (scenarioTransfer?.amount ? String(Math.trunc(scenarioTransfer.amount)) : ""));
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
      if (!address || !sourceWalletValid || !disclosureDataIdValid || !runtimePrecheck.ok || !runtimeContracts) {
        setPrecheckStatus(null);
        return;
      }

      setPrecheckLoading(true);
      try {
        const status = await getTransferPrecheckStatus({
          disclosureDataId: disclosureDataIdTrimmed as `0x${string}`,
          caller: address,
          from: sourceWalletTrimmed as Address,
          tokenAddress: runtimeContracts.confidentialRwaToken as Address,
          disclosureRegistry: runtimeContracts.disclosureRegistry as Address,
          transferController: runtimeContracts.transferController as Address,
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
              transferController: runtimeContracts.transferController as Address,
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
  }, [
    address,
    disclosureDataIdTrimmed,
    disclosureDataIdValid,
    runtimeContracts,
    runtimePrecheck.ok,
    sourceWalletTrimmed,
    sourceWalletValid,
  ]);

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

  async function generateProof() {
    setError(null);

    if (!proofInputKey) {
      setProofForKey(null);
      setEncryptedAmount("");
      setInputProof("");
      return;
    }
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
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available for proof generation.");
      return;
    }

    setProofGenerating(true);
    try {
      const generated = await generateEncryptedAmountAndProof(
        {
          amount: amountBigInt,
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
      setSuccess(`NOX proof generated from browser wallet via ${generated.adapter}.`);
    } catch (proofError) {
      setProofForKey(null);
      setEncryptedAmount("");
      setInputProof("");
      setError(decodeWeb3FlowError(proofError, "Failed to generate NOX proof."));
    } finally {
      setProofGenerating(false);
    }
  }

  async function grantOperator() {
    setError(null);
    setSuccess(null);
    setOperatorTxHash(null);

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
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available. Complete onboarding and save tenant contracts first.");
      return;
    }

    setOperatorGranting(true);
    try {
      const latestBlock = await web3PublicClient.getBlock();
      const latestTimestamp = Number(latestBlock.timestamp);
      const operatorLifetimeSeconds = 7 * 24 * 60 * 60;
      const until = BigInt(latestTimestamp + operatorLifetimeSeconds);
      const txHash = await writeContractAsync({
        address: runtimeContracts.confidentialRwaToken as Address,
        abi: getContractAbi("confidentialRwaToken"),
        functionName: "setOperator",
        args: [runtimeContracts.transferController as Address, until],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(300000),
      });
      setOperatorTxHash(txHash);
      setSuccess(`Tx operator terkirim. Menunggu mined: ${txHash}`);
      const receipt = await web3PublicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new Error(`Tx setOperator gagal di-chain. Receipt status: ${receipt.status}. Tx hash: ${txHash}`);
      }
      const status = await getTransferPrecheckStatus({
        disclosureDataId: disclosureDataIdTrimmed as `0x${string}`,
        caller: address,
        from: sourceWalletTrimmed as Address,
        tokenAddress: runtimeContracts.confidentialRwaToken as Address,
        disclosureRegistry: runtimeContracts.disclosureRegistry as Address,
        transferController: runtimeContracts.transferController as Address,
      });
      setPrecheckStatus(status);
      if (!status.checks.operator.ok) {
        throw new Error(
          `Tx setOperator sudah mined (${txHash}) tetapi isOperator masih false untuk holder ${sourceWalletTrimmed} dan controller ${runtimeContracts.transferController}.`,
        );
      }
      setSuccess(
        `Operator berhasil terset dan terverifikasi on-chain sampai ${new Date(Number(until) * 1000).toISOString()}. Tx hash: ${txHash}`,
      );
    } catch (grantError) {
      setError(decodeWeb3FlowError(grantError, "Failed to grant operator access."));
    } finally {
      setOperatorGranting(false);
    }
  }

  async function grantRequiredDisclosure() {
    setError(null);
    setSuccess(null);
    setDisclosureTxHash(null);

    if (!assetId) {
      setError("Select an asset before granting disclosure.");
      return;
    }
    if (!address) {
      setError("Connect the sender wallet before granting disclosure.");
      return;
    }
    if (!sourceWalletValid) {
      setError("Sender investor must have a valid mapped wallet before disclosure can be granted.");
      return;
    }
    if (!sourceMatchesConnectedWallet) {
      setError("Connect the sender investor wallet before granting disclosure.");
      return;
    }
    if (!recipientAddressValid) {
      setError("Recipient investor must have a valid mapped wallet before disclosure can be granted.");
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

    setDisclosureGranting(true);
    try {
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }

      const nextDisclosureDataId = deriveDisclosureDataId();
      const expiresAtUnix = Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30;
      const title = `${selectedAssetName} transfer disclosure`;
      const content = `Auto-granted disclosure for ${fromInvestor?.name || "sender"} to initiate a confidential transfer from ${sourceWalletTrimmed}.`;

      const txHash = await writeContractAsync({
        address: runtimeContracts.disclosureRegistry as Address,
        abi: getContractAbi("disclosureRegistry"),
        functionName: "grantDisclosure",
        args: [
          nextDisclosureDataId,
          sourceWalletTrimmed as Address,
          BigInt(expiresAtUnix),
          title,
        ],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(300000),
      });
      setDisclosureTxHash(txHash);
      setSuccess(`Disclosure grant tx sent. Waiting for confirmation: ${txHash}`);

      const receipt = await web3PublicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });
      if (receipt.status !== "success") {
        throw new Error(`Disclosure grant reverted. Tx hash: ${txHash}`);
      }

      const response = await fetch("/api/disclosures", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          asset_id: assetId,
          title,
          content,
          ...(fromInvestorId > 0 ? { grantee_investor_id: fromInvestorId } : {}),
          grantee_wallet_address: sourceWalletTrimmed,
          disclosure_data_id: nextDisclosureDataId,
          expires_at_unix: expiresAtUnix,
          grant_tx_hash: txHash,
          onchain_metadata: {
            chain_id: TARGET_CHAIN_ID,
            disclosure_registry_address: runtimeContracts.disclosureRegistry,
            disclosure_data_id: nextDisclosureDataId,
            grantee_wallet_address: sourceWalletTrimmed,
            expires_at_unix: expiresAtUnix,
            grant_tx_hash: txHash,
          },
        }),
      });
      const payload = (await response.json()) as { success: boolean; error?: string | null };
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || `Disclosure grant confirmed, but backend persistence failed. Tx hash: ${txHash}`);
      }

      await refreshDisclosureOptions(nextDisclosureDataId);
      setSuccess(`Disclosure granted, persisted, and selected for transfer. Tx hash: ${txHash}`);
    } catch (grantError) {
      setError(decodeWeb3FlowError(grantError, "Failed to grant required disclosure."));
    } finally {
      setDisclosureGranting(false);
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
    if (!runtimePrecheck.ok) {
      setError(`${runtimePrecheck.summary} ${runtimePrecheck.action}`);
      return;
    }
    if (!runtimeContracts) {
      setError("Tenant runtime bundle is not available. Complete onboarding and save tenant contracts first.");
      return;
    }
    if (firstTransferHolderEnforced && !issuanceWalletMappedInvestor) {
      setError(
        `First transfer for this asset requires an investor mapped to the initial issuance wallet ${selectedAssetIssuanceWallet}. Create or update that investor mapping first.`,
      );
      return;
    }
    if (!senderMatchesIssuanceWallet) {
      setError(
        `First transfer must be sent from the investor mapped to the initial issuance wallet ${selectedAssetIssuanceWallet}.`,
      );
      return;
    }
    if (!amountValid) {
      setError("Amount must be greater than 0.");
      return;
    }
    if (!proofReadyForInput || !proofInputKey || proofForKey !== proofInputKey) {
      setError("NOX proof is missing or stale. Wait for browser proof generation to complete for the current amount.");
      return;
    }
    if (!disclosureDataIdValid) {
      setError("Disclosure data ID must be bytes32 (`0x` + 64 hex chars).");
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
        address: runtimeContracts.transferController as Address,
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
      setSuccess(`Transfer tx terkirim. Menunggu mined: ${txHash}`);

      const receipt = await web3PublicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 1,
      });

      const persistTransferRecord = async (txStatus: "confirmed" | "reverted"): Promise<TransferEnvelope> => {
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
            tx_status: txStatus,
            onchain_metadata: {
              chain_id: TARGET_CHAIN_ID,
              tx_hash: txHash,
              tx_status: txStatus,
              sender_wallet_address: prechecked.sender_wallet,
              recipient_wallet_address: prechecked.recipient_wallet,
              disclosure_data_id: prechecked.disclosure_data_id,
              transfer_controller_address: runtimeContracts.transferController,
              token_address: runtimeContracts.confidentialRwaToken,
              disclosure_registry_address: runtimeContracts.disclosureRegistry,
              encrypted_amount: prechecked.encrypted_amount,
              input_proof: prechecked.input_proof,
            },
          }),
        });
        const payload = (await response.json()) as TransferEnvelope;
        if (!response.ok || !payload.success) {
          throw new Error(
            payload.error
              ? `${payload.error} Tx hash: ${txHash}`
              : `Backend transfer persistence failed. Tx hash: ${txHash}`,
          );
        }
        return payload;
      };

      if (receipt.status !== "success") {
        let failedPayload: TransferEnvelope | null = null;
        try {
          failedPayload = await persistTransferRecord("reverted");
        } catch (persistError) {
          console.error("[transfer] failed tx audit persistence failed", persistError);
        }
        const failedPersisted = Boolean(failedPayload?.data?.tx_hash);
        setResult({
          transferRecordId: failedPayload?.data?.id ?? null,
          txHash,
          onchainStatus: "failed",
          senderWallet: prechecked.sender_wallet,
          recipientWallet: prechecked.recipient_wallet,
          disclosureDataId: prechecked.disclosure_data_id,
          senderInvestorName: fromInvestor?.name || `Investor #${fromInvestorId}`,
          recipientInvestorName: recipientInvestor?.name || `Investor #${toInvestorId}`,
          backendTxPersisted: failedPersisted,
        });
        throw new Error(
          failedPersisted
            ? `Transfer reverted di-chain. Tx hash: ${txHash}. Record audit tersimpan sebagai #${failedPayload?.data?.id}.`
            : `Transfer reverted di-chain. Tx hash: ${txHash}.`,
        );
      }

      const payload = await persistTransferRecord("confirmed");
      if (!payload.data) {
        throw new Error(`Transfer confirmed on-chain, but backend response has no data. Tx hash: ${txHash}`);
      }
      const backendTxPersisted = Boolean(payload.data.tx_hash);
      if (!backendTxPersisted) {
        throw new Error(`Transfer confirmed on-chain, but backend did not persist tx_hash. Tx hash: ${txHash}`);
      }

      setSuccess("Confidential transfer confirmed on-chain and backend record updated.");
      setResult({
        transferRecordId: payload.data.id,
        txHash,
        onchainStatus: "confirmed",
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
          <SectionCard title="Transfer form" description="Primary flow uses mapped investor wallets, selected disclosure metadata, and browser-generated NOX proof.">
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
                    const nextAsset = assetOptions.find((item) => item.id === nextAssetId) ?? null;
                    const nextIssuanceWallet = nextAsset?.issuance_wallet?.trim() || "";
                    const nextConfirmedTransferCount = transferHistoryOptions.filter(
                      (item) => item.asset_id === nextAssetId && item.status === "confirmed",
                    ).length;
                    const nextIssuanceInvestor =
                      investorOptions.find((item) => investorMatchesWallet(item, nextIssuanceWallet)) ?? null;
                    const nextSenderInvestor =
                      nextIssuanceWallet && nextConfirmedTransferCount === 0
                        ? nextIssuanceInvestor
                        : investorOptions.find((item) => item.id === fromInvestorId) ?? null;
                    const nextDisclosureId =
                      allDisclosureOptions
                        .filter((item) => item.asset_id === nextAssetId)
                        .find((item) =>
                          disclosureMatchesCallerWallet(
                            item,
                            nextSenderInvestor?.wallet_address?.trim() || address,
                          ),
                        )
                        ?.data_id ?? "";
                    setAssetId(nextAssetId);
                    if (nextSenderInvestor?.id) {
                      setFromInvestorId(nextSenderInvestor.id);
                    }
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
                  onChange={(event) => {
                    const nextFromInvestorId = Number(event.target.value);
                    const nextSenderInvestor =
                      investorOptions.find((item) => item.id === nextFromInvestorId) ?? null;
                    const nextSenderWallet = nextSenderInvestor?.wallet_address?.trim() || "";
                    const nextDisclosureId =
                      allDisclosureOptions
                        .filter((item) => item.asset_id === assetId)
                        .find((item) => disclosureMatchesCallerWallet(item, nextSenderWallet || address))
                        ?.data_id ?? "";

                    setFromInvestorId(nextFromInvestorId);
                    setDisclosureDataId(nextDisclosureId);
                    if (error === "Sender and recipient investor must be different records.") {
                      setError(null);
                    }

                    if (nextFromInvestorId === toInvestorId) {
                      const nextRecipient =
                        investorOptions.find((item) => item.id !== nextFromInvestorId && item.wallet_address) ??
                        investorOptions.find((item) => item.id !== nextFromInvestorId) ??
                        null;
                      setToInvestorId(nextRecipient?.id || 0);
                    }
                  }}
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
                {firstTransferHolderEnforced ? (
                  <p className="text-xs leading-5 text-warning">
                    First transfer for this asset must start from the initial mint recipient wallet:
                    {" "}
                    <span className="font-mono text-foreground">{selectedAssetIssuanceWallet || "issuance wallet missing"}</span>
                    {issuanceWalletMappedInvestor
                      ? ` (mapped to investor #${issuanceWalletMappedInvestor.id} ${issuanceWalletMappedInvestor.name}).`
                      : " Create or update an investor record with this wallet before transferring."}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <label htmlFor="recipient-investor" className="text-sm font-medium text-foreground">Recipient investor</label>
                <select
                  id="recipient-investor"
                  value={toInvestorId}
                  onChange={(event) => {
                    const nextToInvestorId = Number(event.target.value);
                    setToInvestorId(nextToInvestorId);
                    if (nextToInvestorId === fromInvestorId) {
                      setError("Sender and recipient investor must be different records.");
                    } else if (error === "Sender and recipient investor must be different records.") {
                      setError(null);
                    }
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
                  readOnly
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
                <label htmlFor="encrypted-amount" className="text-sm font-medium text-foreground">Encrypted amount (auto-generated)</label>
                <input
                  id="encrypted-amount"
                  value={encryptedAmount}
                  readOnly
                  placeholder={proofGenerating ? "Generating NOX proof..." : "Will be generated from wallet/browser"}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
                <div className="flex flex-wrap gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => void generateProof()}
                    disabled={!hasConnectedWallet || !onTargetChain || !amountValid || proofGenerating}
                  >
                    {proofGenerating ? "Generating NOX proof..." : "Regenerate NOX proof"}
                  </Button>
                  <p className="text-xs leading-5 text-muted">
                    Proof is generated in-browser from the connected wallet for current amount/chain.
                  </p>
                </div>
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="input-proof" className="text-sm font-medium text-foreground">Input proof (auto-generated)</label>
                <textarea
                  id="input-proof"
                  rows={3}
                  value={inputProof}
                  readOnly
                  placeholder={proofGenerating ? "Generating NOX proof..." : "Will be generated from wallet/browser"}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 font-mono text-sm text-foreground outline-none placeholder:text-muted"
                />
              </div>

              <div className="md:col-span-2 space-y-2">
                <label htmlFor="disclosure-option" className="text-sm font-medium text-foreground">Disclosure option</label>
                <select
                  id="disclosure-option"
                  value={disclosureDataIdTrimmed}
                  onChange={(event) => {
                    const nextDisclosureId = event.target.value;
                    const nextDisclosure =
                      allDisclosureOptions.find((item) => (item.data_id ?? "") === nextDisclosureId) ?? null;
                    setDisclosureDataId(nextDisclosureId);
                    if (nextDisclosure && nextDisclosure.asset_id !== assetId) {
                      setAssetId(nextDisclosure.asset_id);
                    }
                  }}
                  className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
                >
                  <option value="">Select disclosure</option>
                  {assetDisclosureOptions.map((option) => (
                    <option key={option.id} value={option.data_id ?? ""}>
                      {`Asset #${option.asset_id} • #${option.id} - ${option.title}${option.grantee ? ` -> ${option.grantee}` : ""}`}
                    </option>
                  ))}
                </select>
                <p className="text-xs leading-5 text-muted">
                  Uses active disclosure records already stored in backend metadata. Select a disclosure to use its bytes32 `data_id`.
                </p>
                {disclosureMissingForSender ? (
                  <div className="rounded-2xl border border-warning/40 bg-surface-soft p-4">
                    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-medium text-foreground">Required disclosure is missing for the sender wallet.</p>
                        <p className="mt-1 text-xs leading-5 text-muted">
                          This will grant disclosure to <span className="font-mono text-foreground">{sourceWalletTrimmed}</span> and select it automatically.
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void grantRequiredDisclosure()}
                        disabled={disclosureGranting || !sourceMatchesConnectedWallet || !recipientAddressValid}
                      >
                        {disclosureGranting ? "Granting disclosure..." : "Grant required disclosure"}
                      </Button>
                    </div>
                    {!sourceMatchesConnectedWallet ? (
                      <p className="mt-3 text-xs text-danger">Connect the sender wallet before granting disclosure.</p>
                    ) : null}
                  </div>
                ) : null}
                {!allDisclosureOptions.length ? (
                  <p className="text-xs leading-5 text-warning">
                    No active disclosure metadata is available yet. Use the grant action above to create the required grant from this page.
                  </p>
                ) : null}
                {assetDisclosureOptions.length ? (
                  <p className="text-xs leading-5 text-muted">
                    Active disclosures are shown first, and grants for the connected caller wallet are prioritized.
                  </p>
                ) : null}
              </div>

              <div className="md:col-span-2 rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-sm text-foreground">Resolved disclosure data ID</p>
                <p className="mt-2 font-mono text-xs text-muted">{disclosureDataIdTrimmed || "-"}</p>
                {selectedDisclosure ? (
                  <p className="mt-2 text-xs leading-5 text-muted">
                    Selected grant grantee: <span className="font-mono text-xs text-foreground">{selectedDisclosure.grantee || "N/A"}</span>
                  </p>
                ) : null}
                {selectedDisclosure?.expires_at ? (
                  <p className="mt-1 text-xs leading-5 text-muted">
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
                  {
                    label: "Transfer record ID (DB)",
                    value: result.transferRecordId ? `#${result.transferRecordId}` : "Not stored",
                  },
                  { label: "Transfer tx hash (on-chain)", value: <span className="font-mono text-xs">{result.txHash}</span> },
                  { label: "Transfer ID on-chain (bytes32)", value: "Not emitted in this call path" },
                  { label: "On-chain receipt", value: result.onchainStatus === "confirmed" ? "Success" : "Reverted" },
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
                <span className="text-sm text-muted">Confidential amount</span>
                <div className="text-right">
                  <p className="text-lg font-semibold text-foreground">{amountValid ? "Encrypted payload ready" : "Not ready"}</p>
                  <p className="text-xs text-muted">Plain amount is used locally only for NOX proof generation</p>
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
                      : "select disclosure and sender investor with mapped wallet"}
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
                onClick={() => void grantRequiredDisclosure()}
                disabled={
                  !disclosureMissingForSender ||
                  disclosureGranting ||
                  !sourceMatchesConnectedWallet ||
                  !recipientAddressValid
                }
              >
                {disclosureGranting ? "Granting disclosure..." : "Grant required disclosure"}
              </Button>
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
            {operatorTxHash ? (
              <p className="mt-3 text-xs text-muted">
                Operator tx hash: <span className="font-mono text-foreground">{operatorTxHash}</span>
              </p>
            ) : null}
            {disclosureTxHash ? (
              <p className="mt-3 text-xs text-muted">
                Disclosure tx hash: <span className="font-mono text-foreground">{disclosureTxHash}</span>
              </p>
            ) : null}
            {!hasConnectedWallet ? <p className="mt-3 text-sm text-danger">Wallet not connected. Connect wallet before transfer.</p> : null}
            {hasConnectedWallet && !onTargetChain ? (
              <p className="mt-3 text-sm text-danger">Wrong network. Switch wallet to Arbitrum Sepolia (chain ID {TARGET_CHAIN_ID}).</p>
            ) : null}
            {!sourceWalletValid && fromInvestor ? <p className="mt-3 text-sm text-danger">Sender investor must have a valid mapped wallet address.</p> : null}
            {sourceWalletValid && hasConnectedWallet && !sourceMatchesConnectedWallet ? (
              <p className="mt-3 text-sm text-danger">Connect the sender investor wallet to use the operator helper and submit the transfer from the correct holder.</p>
            ) : null}
            {!recipientAddressValid && recipientInvestor ? (
              <p className="mt-3 text-sm text-danger">Recipient investor must have a valid mapped wallet address.</p>
            ) : null}
            {firstTransferHolderEnforced && !issuanceWalletMappedInvestor ? (
              <p className="mt-3 text-sm text-danger">
                No investor is mapped to the initial issuance wallet {selectedAssetIssuanceWallet || "(missing)"}.
                Create that investor mapping before the first transfer.
              </p>
            ) : null}
            {firstTransferHolderEnforced && issuanceWalletMappedInvestor && !senderMatchesIssuanceWallet ? (
              <p className="mt-3 text-sm text-danger">
                First transfer must use investor #{issuanceWalletMappedInvestor.id} {issuanceWalletMappedInvestor.name}
                {" "}because the initial confidential mint was sent to {selectedAssetIssuanceWallet}.
              </p>
            ) : null}
            {!amountValid && trimmedAmount ? <p className="mt-3 text-sm text-danger">Amount must be a positive integer for NOX proof generation.</p> : null}
            {!runtimePrecheck.ok ? <p className="mt-3 text-sm text-danger">{runtimePrecheck.summary}</p> : null}
            {!proofReadyForInput && amountValid ? (
              <p className="mt-3 text-sm text-danger">
                NOX proof for the current wallet/chain/amount is not ready yet.
              </p>
            ) : null}
            {!disclosureDataIdValid && disclosureDataIdTrimmed ? <p className="mt-3 text-sm text-danger">Disclosure data ID must be bytes32.</p> : null}
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
