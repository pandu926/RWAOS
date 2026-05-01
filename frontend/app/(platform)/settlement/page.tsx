"use client";

import { useEffect, useMemo, useState } from "react";
import { isAddress, parseUnits, type Address } from "viem";
import { useAccount, useChainId, useSwitchChain, useWalletClient, useWriteContract } from "wagmi";

import { TARGET_CHAIN_ID, decodeWeb3FlowError } from "@/app/_lib/onchain-flow";
import { Button, DetailList, InlineNotice, PageHeader, SectionCard, StatCard, StatusBadge } from "@/components/ui";
import { chainConfig, getContractAbi } from "@/lib/web3/contracts";
import { web3PublicClient } from "@/lib/web3/client";
import { createViemWalletClientProofAdapter, generateEncryptedAmountAndProof } from "@/lib/web3/proof";
import { fetchTenantBundleRuntime, type TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";

const erc20ApproveAbi = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const erc20MintAbi = [
  {
    type: "function",
    name: "mint",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [],
  },
] as const;

type SettlementResult = {
  approveTxHash: string;
  depositTxHash: string;
  publicAmount: string;
  encryptedAmount: string;
  vaultAddress: string;
  settlementAsset: string;
  confidentialToken: string;
};

function optionalAddress(value: string | undefined): Address | null {
  const trimmed = value?.trim() ?? "";
  return isAddress(trimmed) ? trimmed : null;
}

const fallbackSettlementVaultAddress = optionalAddress(process.env.NEXT_PUBLIC_CONTRACT_SETTLEMENT_VAULT);
const fallbackSettlementAssetAddress = optionalAddress(process.env.NEXT_PUBLIC_CONTRACT_SETTLEMENT_ASSET);

function firstAddress(...values: Array<string | null | undefined>): Address | null {
  const value = values.find((candidate) => candidate && isAddress(candidate));
  return typeof value === "string" && isAddress(value) ? value : null;
}

export default function SettlementPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { data: walletClient } = useWalletClient();
  const { writeContractAsync } = useWriteContract();
  const [runtime, setRuntime] = useState<TenantBundleRuntime | null>(null);
  const [amount, setAmount] = useState("1000");
  const [busy, setBusy] = useState(false);
  const [loadingRuntime, setLoadingRuntime] = useState(false);
  const [minting, setMinting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [result, setResult] = useState<SettlementResult | null>(null);

  const tokenAddress = runtime?.bundle?.contracts.confidentialRwaToken ?? null;
  const settlementVaultAddress = firstAddress(runtime?.bundle?.contracts.settlementVault, fallbackSettlementVaultAddress);
  const settlementAssetAddress = firstAddress(runtime?.bundle?.contracts.settlementAsset, fallbackSettlementAssetAddress);
  const hasWallet = Boolean(address);
  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const proofAdapter = useMemo(() => createViemWalletClientProofAdapter(walletClient), [walletClient]);
  const amountUnits = (() => {
    try {
      return parseUnits(amount || "0", 6);
    } catch {
      return BigInt(0);
    }
  })();
  const ready = Boolean(
    hasWallet &&
      onTargetChain &&
      settlementVaultAddress &&
      settlementAssetAddress &&
      tokenAddress &&
      proofAdapter &&
      amountUnits > BigInt(0),
  );

  useEffect(() => {
    if (!address || runtime || loadingRuntime) {
      return;
    }
    void loadRuntime();
  }, [address, loadingRuntime, runtime]);

  async function loadRuntime() {
    setLoadingRuntime(true);
    setError(null);
    try {
      setRuntime(await fetchTenantBundleRuntime());
    } catch (loadError) {
      setError(decodeWeb3FlowError(loadError, "Failed to load tenant runtime."));
    } finally {
      setLoadingRuntime(false);
    }
  }

  async function depositAndMint() {
    setBusy(true);
    setError(null);
    setSuccess(null);
    setResult(null);

    try {
      if (!settlementVaultAddress || !settlementAssetAddress) {
        throw new Error("Settlement vault is not configured for this tenant yet. Run onboarding with the settlement asset field filled, then save the tenant bundle.");
      }
      if (!tokenAddress) {
        throw new Error("Tenant confidential token is missing. Load tenant runtime first.");
      }
      if (!address) {
        throw new Error("Connect wallet before settlement deposit.");
      }
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }
      if (!proofAdapter) {
        throw new Error("NOX proof adapter is not ready for this wallet.");
      }
      if (amountUnits <= BigInt(0)) {
        throw new Error("Enter a positive USDT amount.");
      }

      const generated = await generateEncryptedAmountAndProof(
        {
          amount: amountUnits,
          contractAddress: tokenAddress,
          chainId: TARGET_CHAIN_ID,
        },
        proofAdapter,
      );
      if (!generated.ok) {
        throw new Error([generated.message, generated.detail, generated.action].filter(Boolean).join(" "));
      }

      const approveTxHash = await writeContractAsync({
        address: settlementAssetAddress,
        abi: erc20ApproveAbi,
        functionName: "approve",
        args: [settlementVaultAddress, amountUnits],
        chainId: TARGET_CHAIN_ID,
      });
      const approveReceipt = await web3PublicClient.waitForTransactionReceipt({ hash: approveTxHash, confirmations: 1 });
      if (approveReceipt.status !== "success") {
        throw new Error(`USDT approval reverted. Tx hash: ${approveTxHash}`);
      }

      const depositTxHash = await writeContractAsync({
        address: settlementVaultAddress,
        abi: getContractAbi("settlementVault"),
        functionName: "depositAndMint",
        args: [amountUnits, generated.encryptedAmount, generated.inputProof],
        chainId: TARGET_CHAIN_ID,
        gas: BigInt(900000),
      });
      const depositReceipt = await web3PublicClient.waitForTransactionReceipt({ hash: depositTxHash, confirmations: 1 });
      if (depositReceipt.status !== "success") {
        throw new Error(`Settlement deposit reverted. Tx hash: ${depositTxHash}`);
      }

      setSuccess("USDT locked and confidential cUSDT minted.");
      setResult({
        approveTxHash,
        depositTxHash,
        publicAmount: amount,
        encryptedAmount: generated.encryptedAmount,
        vaultAddress: settlementVaultAddress,
        settlementAsset: settlementAssetAddress,
        confidentialToken: tokenAddress,
      });
    } catch (submitError) {
      setError(decodeWeb3FlowError(submitError, "Failed to confidentialize USDT."));
    } finally {
      setBusy(false);
    }
  }

  async function mintTestSettlementAsset() {
    setMinting(true);
    setError(null);
    setSuccess(null);

    try {
      if (!settlementAssetAddress) {
        throw new Error("Settlement asset address is not configured.");
      }
      if (!address) {
        throw new Error("Connect wallet before minting test USDT.");
      }
      if (!onTargetChain) {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }
      if (amountUnits <= BigInt(0)) {
        throw new Error("Enter a positive USDT amount.");
      }

      const txHash = await writeContractAsync({
        address: settlementAssetAddress,
        abi: erc20MintAbi,
        functionName: "mint",
        args: [address, amountUnits],
        chainId: TARGET_CHAIN_ID,
      });
      const receipt = await web3PublicClient.waitForTransactionReceipt({ hash: txHash, confirmations: 1 });
      if (receipt.status !== "success") {
        throw new Error(`Test USDT mint reverted. Tx hash: ${txHash}`);
      }
      setSuccess(`Test USDT minted to connected wallet. Tx: ${txHash}`);
    } catch (mintError) {
      setError(decodeWeb3FlowError(mintError, "Failed to mint test USDT. This button only works for the demo MockUSDT contract."));
    } finally {
      setMinting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Confidential settlement"
        title="Wrap USDT into cUSDT"
        description="Lock public USDT in a settlement vault, mint an ERC-7984 confidential representation, and use cUSDT for private institutional movement."
        meta={<StatusBadge tone={ready ? "success" : "warning"}>{ready ? "Ready" : "Needs setup"}</StatusBadge>}
        actions={<Button onClick={() => void loadRuntime()} disabled={loadingRuntime}>{loadingRuntime ? "Loading..." : "Load tenant runtime"}</Button>}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Public boundary" value="USDT" detail="Deposit and withdraw remain verifiable" icon="wallet" tone="neutral" />
        <StatCard title="Private movement" value="cUSDT" detail="Internal settlement uses ERC-7984" icon="shield" tone="accent" />
        <StatCard title="Proof" value="NOX" detail="Encrypted amount generated from wallet" icon="key" tone="success" />
        <StatCard title="Audit" value="Tx hash" detail="Evidence without exposing private movement" icon="report" tone="warning" />
      </div>

      {!settlementVaultAddress || !settlementAssetAddress ? (
        <InlineNotice
          title="Settlement contracts not configured"
          description="Run onboarding first. Fill the settlement asset address, deploy the tenant settlement bundle, and save it. After that this page will load the tenant vault automatically."
          tone="warning"
        />
      ) : null}

      <SectionCard title="Deposit and mint cUSDT" description="The public deposit amount is visible at the vault boundary. The minted cUSDT amount is represented as an encrypted NOX payload for internal movement.">
        <div className="grid gap-4">
          <input
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="USDT amount"
            className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none"
          />
          <div className="grid gap-3 md:grid-cols-2">
            <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">Vault: <span className="font-mono text-xs text-foreground">{settlementVaultAddress ?? "Not configured"}</span></p>
            <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">USDT asset: <span className="font-mono text-xs text-foreground">{settlementAssetAddress ?? "Not configured"}</span></p>
            <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">cUSDT token: <span className="font-mono text-xs text-foreground">{tokenAddress ?? "Load runtime"}</span></p>
            <p className="rounded-2xl bg-surface-soft p-4 text-sm text-muted">Network: <span className="font-mono text-xs text-foreground">{chainConfig.chainId}</span></p>
          </div>
          <Button onClick={() => void depositAndMint()} disabled={busy || !ready}>
            {busy ? "Submitting..." : "Lock USDT and mint cUSDT"}
          </Button>
          <Button variant="secondary" onClick={() => void mintTestSettlementAsset()} disabled={minting || !address || !settlementAssetAddress}>
            {minting ? "Minting test USDT..." : "Mint test USDT"}
          </Button>
        </div>
      </SectionCard>

      {error ? <InlineNotice title="Settlement failed" description={error} tone="danger" /> : null}
      {success ? <InlineNotice title="Settlement submitted" description={success} tone="success" /> : null}
      {result ? (
        <SectionCard title="Settlement proof" description="This is the clean demo proof: public USDT entered the vault, confidential cUSDT was minted, and later movement can stay private.">
          <DetailList
            items={[
              { label: "Public amount", value: `${result.publicAmount} USDT` },
              { label: "USDT approve tx", value: <span className="font-mono text-xs">{result.approveTxHash}</span> },
              { label: "Vault deposit tx", value: <span className="font-mono text-xs">{result.depositTxHash}</span> },
              { label: "Encrypted cUSDT amount", value: <span className="font-mono text-xs">{result.encryptedAmount}</span> },
              { label: "Settlement vault", value: <span className="font-mono text-xs">{result.vaultAddress}</span> },
              { label: "Confidential token", value: <span className="font-mono text-xs">{result.confidentialToken}</span> },
            ]}
          />
        </SectionCard>
      ) : null}
    </div>
  );
}
