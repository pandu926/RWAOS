"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { decodeEventLog, isAddress, type Abi, type Address, type Hex } from "viem";
import { useAccount, useChainId, useSwitchChain, useWriteContract } from "wagmi";

import { TARGET_CHAIN_ID, decodeWeb3FlowError } from "@/app/_lib/onchain-flow";
import { Button, InlineNotice, PageHeader, SectionCard, StatusBadge, SurfaceTable } from "@/components/ui";
import { web3PublicClient } from "@/lib/web3/client";
import {
  getContractAbi,
  tenantFactoryAddress,
  tenantFactoryEnvConfigured,
  tenantFactoryEnvInvalid,
  type CoreContractName,
} from "@/lib/web3/contracts";
import { getWalletSessionFromDocumentCookie } from "@/lib/web3/session";
import { fetchTenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";
import type { StatusTone } from "@/lib/site-data";

type OnboardingForm = {
  legalEntityName: string;
  institutionType: string;
  countryCode: string;
  regulatorLicense: string;
  adminName: string;
  adminEmail: string;
  treasuryWallet: string;
  operatorWallet: string;
  auditorWallet: string;
  baseCurrency: string;
  policyTemplate: string;
};

type OnchainForm = {
  tokenName: string;
  tokenSymbol: string;
  tokenDecimals: string;
  tokenOwner: string;
  settlementAsset: string;
  transferControllerAdmin: string;
  disclosureAdmin: string;
  auditAnchorAdmin: string;
  requireSubmitterRole: boolean;
};

type ContractBundle = Record<CoreContractName, Address> & {
  settlementAsset?: Address;
  settlementVault?: Address;
};

type DeploymentMode = "tenant-factory";

type DeploymentState = {
  mode: DeploymentMode;
  sourceLabel: string;
  contracts: ContractBundle;
  deployTxHash?: Hex;
  factoryAddress?: Address | null;
};

type TxKey = "tenantBundleDeploy" | "setOperator" | "setRequireSubmitterRole" | "setSubmitter";

type TxStatus = "idle" | "awaiting-signature" | "submitted" | "confirmed" | "failed" | "skipped";

type TxRecord = {
  status: TxStatus;
  hash?: Hex;
  message?: string;
};

type SaveState = {
  status: "idle" | "saving" | "saved" | "failed";
  persisted?: boolean;
  message?: string;
};

type SaveContractsEnvelope = {
  success: boolean;
  data?: {
    persisted?: boolean;
    warning?: string;
    fallback?: string;
  };
  error?: string | null;
};

type RuntimeConfigEnvelope = {
  success: boolean;
  data?: {
    tenantFactoryAddress?: string | null;
    tenantFactoryEnvConfigured?: boolean;
    tenantFactoryEnvInvalid?: boolean;
    settlementAssetAddress?: string | null;
    settlementVaultAddress?: string | null;
  };
};

type SaveTenantContractsRequestBody = {
  chainId: number;
  mode: DeploymentMode;
  sourceLabel: string;
  contracts: ContractBundle & { tenantFactory?: Address };
  txHashes: Partial<Record<TxKey, Hex>>;
  tenant: {
    legalEntityName: string;
    institutionType: string;
    countryCode: string;
    regulatorLicense: string;
    adminName: string;
    adminEmail: string;
    treasuryWallet: string;
    operatorWallet: string;
    auditorWallet: string;
    baseCurrency: string;
    policyTemplate: string;
  };
};

type ContractSpec = {
  name: string;
  required: "Mandatory" | "Optional" | "Optional for cUSDT";
  purpose: string;
  keyFunctions: string;
};

type ReceiptLog = {
  address: Address;
  data: Hex;
  topics: readonly Hex[];
};

const TX_LABELS: Record<TxKey, string> = {
  tenantBundleDeploy: "TenantFactory bundle deployment",
  setOperator: "ConfidentialRWAToken.setOperator",
  setRequireSubmitterRole: "AuditAnchor.setRequireSubmitterRole",
  setSubmitter: "AuditAnchor.setSubmitter",
};

const CONTRACT_SPECS: ContractSpec[] = [
  {
    name: "ConfidentialRWAToken",
    required: "Mandatory",
    purpose: "Primary token contract per asset class for minting, transfers, and ownership control.",
    keyFunctions: "mint, balanceOf, setOperator / isOperator, confidential transfer hook",
  },
  {
    name: "DisclosureRegistry",
    required: "Mandatory",
    purpose: "Stores disclosure grants for selective visibility and policy pre-checks.",
    keyFunctions: "grantDisclosure, revokeDisclosure, hasDisclosure",
  },
  {
    name: "TransferController",
    required: "Mandatory",
    purpose: "Orchestrates policy-controlled confidential transfer execution.",
    keyFunctions: "initiateConfidentialTransfer, precheckTransfer, operator validation",
  },
  {
    name: "AuditAnchor",
    required: "Mandatory",
    purpose: "Anchors process proofs as immutable hashes for the audit trail.",
    keyFunctions: "anchorTransfer, anchorPassport, setSubmitter, setRequireSubmitterRole",
  },
  {
    name: "TenantFactory",
    required: "Mandatory",
    purpose: "Deploys your tenant-owned ConfidentialRWAToken, DisclosureRegistry, TransferController, AuditAnchor, and optional SettlementVault bundle.",
    keyFunctions: "createTenantBundle(owner), createTenantSettlementBundle(owner, settlementAsset)",
  },
  {
    name: "SettlementVault",
    required: "Optional for cUSDT",
    purpose: "Locks public USDT/ERC20 at the boundary and mints confidential cUSDT for private internal settlement.",
    keyFunctions: "depositAndMint, burnAndWithdraw, lockedBalance",
  },
];

const DEFAULT_ONBOARDING: OnboardingForm = {
  legalEntityName: "",
  institutionType: "Bank",
  countryCode: "US",
  regulatorLicense: "",
  adminName: "",
  adminEmail: "",
  treasuryWallet: "",
  operatorWallet: "",
  auditorWallet: "",
  baseCurrency: "USD",
  policyTemplate: "Restricted Transfer v1",
};

const DEFAULT_ONCHAIN: OnchainForm = {
  tokenName: "",
  tokenSymbol: "",
  tokenDecimals: "18",
  tokenOwner: "",
  settlementAsset: "",
  transferControllerAdmin: "",
  disclosureAdmin: "",
  auditAnchorAdmin: "",
  requireSubmitterRole: true,
};

function createInitialTxRecords(): Record<TxKey, TxRecord> {
  return {
    tenantBundleDeploy: { status: "idle" },
    setOperator: { status: "idle" },
    setRequireSubmitterRole: { status: "idle" },
    setSubmitter: { status: "idle" },
  };
}

function inputClassName(mono = false): string {
  return `w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted ${mono ? "font-mono" : ""}`;
}

function statusTone(status: TxStatus): StatusTone {
  if (status === "confirmed") {
    return "success";
  }
  if (status === "failed") {
    return "danger";
  }
  if (status === "submitted" || status === "awaiting-signature") {
    return "warning";
  }
  if (status === "skipped") {
    return "neutral";
  }
  return "accent";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertAddress(value: string, label: string): Address {
  const trimmed = value.trim();
  if (!isAddress(trimmed)) {
    throw new Error(`${label} must be a valid EVM address.`);
  }
  return trimmed as Address;
}

function getBundleAddress(value: unknown, key: CoreContractName, index: number): Address | null {
  const candidate = Array.isArray(value)
    ? value[index]
    : isPlainObject(value)
      ? value[key] ?? (key === "confidentialRwaToken" ? value.token : null)
      : null;
  return typeof candidate === "string" && isAddress(candidate) ? (candidate as Address) : null;
}

function normalizeContractBundle(value: unknown): ContractBundle | null {
  const confidentialRwaToken = getBundleAddress(value, "confidentialRwaToken", 0);
  const disclosureRegistry = getBundleAddress(value, "disclosureRegistry", 1);
  const transferController = getBundleAddress(value, "transferController", 2);
  const auditAnchor = getBundleAddress(value, "auditAnchor", 3);

  if (!confidentialRwaToken || !disclosureRegistry || !transferController || !auditAnchor) {
    return null;
  }

  return {
    confidentialRwaToken,
    disclosureRegistry,
    transferController,
    auditAnchor,
  };
}

function normalizeFactoryEventBundle(value: unknown): ContractBundle | null {
  if (!Array.isArray(value)) {
    return normalizeContractBundle(value);
  }

  const confidentialRwaToken = getBundleAddress(value, "confidentialRwaToken", 1);
  const disclosureRegistry = getBundleAddress(value, "disclosureRegistry", 2);
  const transferController = getBundleAddress(value, "transferController", 3);
  const auditAnchor = getBundleAddress(value, "auditAnchor", 4);

  if (!confidentialRwaToken || !disclosureRegistry || !transferController || !auditAnchor) {
    return null;
  }

  return {
    confidentialRwaToken,
    disclosureRegistry,
    transferController,
    auditAnchor,
  };
}

function normalizeFactorySettlementEventBundle(value: unknown): ContractBundle | null {
  if (!Array.isArray(value)) {
    return normalizeContractBundle(value);
  }

  const settlementAsset = getBundleAddress(value, "confidentialRwaToken", 1);
  const confidentialRwaToken = getBundleAddress(value, "confidentialRwaToken", 2);
  const disclosureRegistry = getBundleAddress(value, "disclosureRegistry", 3);
  const transferController = getBundleAddress(value, "transferController", 4);
  const auditAnchor = getBundleAddress(value, "auditAnchor", 5);
  const settlementVault = getBundleAddress(value, "confidentialRwaToken", 6);

  if (
    !settlementAsset ||
    !confidentialRwaToken ||
    !disclosureRegistry ||
    !transferController ||
    !auditAnchor ||
    !settlementVault
  ) {
    return null;
  }

  return {
    confidentialRwaToken,
    disclosureRegistry,
    transferController,
    auditAnchor,
    settlementAsset,
    settlementVault,
  };
}

function extractTenantBundleFromLogs(logs: readonly ReceiptLog[], factoryAddress: Address): ContractBundle | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== factoryAddress.toLowerCase()) {
      continue;
    }

    try {
      const decoded = decodeEventLog({
        abi: getContractAbi("tenantFactory") as Abi,
        data: log.data,
        topics: log.topics as [] | [Hex, ...Hex[]],
      });

      if (decoded.eventName !== "TenantBundleCreated" && decoded.eventName !== "TenantSettlementBundleCreated") {
        continue;
      }

      const bundle =
        decoded.eventName === "TenantSettlementBundleCreated"
          ? normalizeFactorySettlementEventBundle(decoded.args)
          : normalizeFactoryEventBundle(decoded.args);
      if (bundle) {
        return bundle;
      }
    } catch {
      // Ignore unrelated factory logs.
    }
  }

  return null;
}

function txHashPayload(records: Record<TxKey, TxRecord>): Record<string, string> {
  return Object.fromEntries(
    (Object.entries(records) as Array<[TxKey, TxRecord]>)
      .filter(([, record]) => Boolean(record.hash))
      .map(([key, record]) => [key, record.hash as string]),
  );
}

function shortAddress(value: string | null | undefined): string {
  if (!value) {
    return "Not connected";
  }
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function mergeTxHashes(
  records: Record<TxKey, TxRecord>,
  overrides?: Partial<Record<TxKey, Hex>>,
): Partial<Record<TxKey, Hex>> {
  const merged: Partial<Record<TxKey, Hex>> = {};
  for (const [key, value] of Object.entries(txHashPayload(records)) as Array<[TxKey, string]>) {
    merged[key] = value as Hex;
  }
  if (overrides) {
    for (const [key, value] of Object.entries(overrides) as Array<[TxKey, Hex | undefined]>) {
      if (value) {
        merged[key] = value;
      }
    }
  }
  return merged;
}

function WizardStep({
  step,
  title,
  description,
  tone,
  children,
}: {
  step: string;
  title: string;
  description: string;
  tone: StatusTone;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[1.5rem] border border-border bg-surface p-5 shadow-card">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge tone={tone}>{step}</StatusBadge>
            <h2 className="text-base font-semibold text-foreground">{title}</h2>
          </div>
          <p className="text-sm leading-6 text-muted">{description}</p>
        </div>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function AddressGrid({ contracts }: { contracts: ContractBundle }) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {Object.entries(contracts).map(([key, value]) => (
        <div key={key} className="rounded-2xl border border-border bg-surface-soft p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">{key}</p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">{value}</p>
        </div>
      ))}
    </div>
  );
}

function TxStatusPanel({ records }: { records: Record<TxKey, TxRecord> }) {
  return (
    <div className="grid gap-3">
      {(Object.entries(TX_LABELS) as Array<[TxKey, string]>).map(([key, label]) => {
        const record = records[key];
        return (
          <div key={key} className="rounded-2xl border border-border bg-surface-soft p-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm font-semibold text-foreground">{label}</p>
              <StatusBadge tone={statusTone(record.status)}>{record.status}</StatusBadge>
            </div>
            {record.hash ? <p className="mt-2 break-all font-mono text-xs text-foreground">{record.hash}</p> : null}
            {record.message ? <p className="mt-2 text-xs leading-5 text-muted">{record.message}</p> : null}
          </div>
        );
      })}
    </div>
  );
}

export default function OnboardingPage() {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const connectedWalletAddress = getWalletSessionFromDocumentCookie()?.address?.trim() ?? "";

  const [onboarding, setOnboarding] = useState<OnboardingForm>(() => ({
    ...DEFAULT_ONBOARDING,
    ...(connectedWalletAddress
      ? {
          treasuryWallet: connectedWalletAddress,
          operatorWallet: connectedWalletAddress,
          auditorWallet: connectedWalletAddress,
        }
      : {}),
  }));
  const [onchain, setOnchain] = useState<OnchainForm>(() => ({
    ...DEFAULT_ONCHAIN,
    ...(connectedWalletAddress
      ? {
          tokenOwner: connectedWalletAddress,
          transferControllerAdmin: connectedWalletAddress,
          disclosureAdmin: connectedWalletAddress,
          auditAnchorAdmin: connectedWalletAddress,
        }
      : {}),
  }));
  const [deployment, setDeployment] = useState<DeploymentState | null>(null);
  const [txRecords, setTxRecords] = useState<Record<TxKey, TxRecord>>(createInitialTxRecords);
  const [saveState, setSaveState] = useState<SaveState>({ status: "idle" });
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [runtimeTenantFactoryAddress, setRuntimeTenantFactoryAddress] = useState<Address | null>(tenantFactoryAddress);
  const [runtimeTenantFactoryConfigured, setRuntimeTenantFactoryConfigured] = useState<boolean>(tenantFactoryEnvConfigured);
  const [runtimeTenantFactoryInvalid, setRuntimeTenantFactoryInvalid] = useState<boolean>(tenantFactoryEnvInvalid);
  const [runtimeSettlementAssetAddress, setRuntimeSettlementAssetAddress] = useState<Address | null>(null);
  const [runtimeSettlementVaultAddress, setRuntimeSettlementVaultAddress] = useState<Address | null>(null);
  const [runtimeConfigResolved, setRuntimeConfigResolved] = useState<boolean>(
    Boolean(tenantFactoryAddress || tenantFactoryEnvConfigured),
  );

  const onTargetChain = chainId === TARGET_CHAIN_ID;
  const connectedWallet = address ?? connectedWalletAddress;
  const treasuryWallet = (onboarding.treasuryWallet || connectedWallet || "").trim();
  const operatorWallet = (onboarding.operatorWallet || connectedWallet || "").trim();
  const auditorWallet = (onboarding.auditorWallet || connectedWallet || "").trim();
  const treasuryWalletValid = isAddress(treasuryWallet);
  const operatorWalletValid = isAddress(operatorWallet);
  const connectedWalletMatchesTreasury =
    Boolean(address && treasuryWalletValid && address.toLowerCase() === treasuryWallet.toLowerCase());
  const effectiveTenantFactoryAddress = runtimeTenantFactoryAddress ?? tenantFactoryAddress;
  const effectiveTenantFactoryConfigured = runtimeTenantFactoryConfigured || tenantFactoryEnvConfigured;
  const effectiveTenantFactoryInvalid =
    runtimeTenantFactoryInvalid || (effectiveTenantFactoryConfigured && !effectiveTenantFactoryAddress);
  const factoryConfigPending = !runtimeConfigResolved && !effectiveTenantFactoryAddress && !effectiveTenantFactoryConfigured;
  const effectiveSettlementAsset = isAddress(onchain.settlementAsset)
    ? (onchain.settlementAsset as Address)
    : runtimeSettlementAssetAddress;

  const filledProfileFields = useMemo(
    () => Object.values(onboarding).filter((value) => value.trim().length > 0).length,
    [onboarding],
  );
  const factoryReady = Boolean(effectiveTenantFactoryAddress && !effectiveTenantFactoryInvalid);
  const deploymentTone: StatusTone = deployment ? "success" : "warning";
  const saveTone: StatusTone = saveState.status === "saved" ? "success" : saveState.status === "failed" ? "danger" : "accent";
  const submitterRoleReady = !onchain.requireSubmitterRole || txRecords.setRequireSubmitterRole.status === "confirmed";
  const setupConfirmed =
    txRecords.setOperator.status === "confirmed" && submitterRoleReady && txRecords.setSubmitter.status === "confirmed";
  const deploymentReadyForSave =
    deployment?.mode === "tenant-factory" && txRecords.tenantBundleDeploy.status === "confirmed";
  const setupReadyToRun = deploymentReadyForSave && saveState.status === "saved";

  useEffect(() => {
    let cancelled = false;

    async function loadRuntimeConfig() {
      try {
        const response = await fetch("/api/runtime-config", {
          method: "GET",
          cache: "no-store",
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as RuntimeConfigEnvelope;
        const candidate = payload.data?.tenantFactoryAddress?.trim() ?? "";
        const nextAddress = isAddress(candidate) ? (candidate as Address) : null;

        if (cancelled) {
          return;
        }

        setRuntimeTenantFactoryAddress(nextAddress);
        setRuntimeTenantFactoryConfigured(Boolean(payload.data?.tenantFactoryEnvConfigured));
        setRuntimeTenantFactoryInvalid(Boolean(payload.data?.tenantFactoryEnvInvalid));
        const settlementAsset = payload.data?.settlementAssetAddress?.trim() ?? "";
        const settlementVault = payload.data?.settlementVaultAddress?.trim() ?? "";
        setRuntimeSettlementAssetAddress(isAddress(settlementAsset) ? (settlementAsset as Address) : null);
        setRuntimeSettlementVaultAddress(isAddress(settlementVault) ? (settlementVault as Address) : null);
        setRuntimeConfigResolved(true);
      } catch {
        // Keep compile-time defaults when runtime config cannot be fetched.
      } finally {
        if (!cancelled) {
          setRuntimeConfigResolved(true);
        }
      }
    }

    void loadRuntimeConfig();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPersistedDeployment() {
      const runtime = await fetchTenantBundleRuntime();
      if (cancelled || runtime.state !== "configured" || !runtime.bundle) {
        return;
      }
      const bundle = runtime.bundle;

      setOnboarding((prev) => ({
        ...prev,
        treasuryWallet: prev.treasuryWallet || bundle.ownerWallet,
        operatorWallet: prev.operatorWallet || bundle.ownerWallet,
        auditorWallet: prev.auditorWallet || bundle.ownerWallet,
      }));
      setOnchain((prev) => ({
        ...prev,
        tokenOwner: prev.tokenOwner || bundle.ownerWallet,
        settlementAsset: prev.settlementAsset || bundle.contracts.settlementAsset || "",
        transferControllerAdmin: prev.transferControllerAdmin || bundle.ownerWallet,
        disclosureAdmin: prev.disclosureAdmin || bundle.ownerWallet,
        auditAnchorAdmin: prev.auditAnchorAdmin || bundle.ownerWallet,
      }));

      setDeployment((prev) => {
        if (prev) {
          return prev;
        }

        return {
          mode: "tenant-factory",
          sourceLabel: "Tenant bundle restored from backend",
          contracts: {
            confidentialRwaToken: bundle.contracts.confidentialRwaToken as Address,
            disclosureRegistry: bundle.contracts.disclosureRegistry as Address,
            transferController: bundle.contracts.transferController as Address,
            auditAnchor: bundle.contracts.auditAnchor as Address,
            ...(bundle.contracts.settlementAsset ? { settlementAsset: bundle.contracts.settlementAsset as Address } : {}),
            ...(bundle.contracts.settlementVault ? { settlementVault: bundle.contracts.settlementVault as Address } : {}),
          },
          deployTxHash: bundle.factoryTxHash as Hex,
          factoryAddress: effectiveTenantFactoryAddress,
        };
      });

      setTxRecords((prev) => ({
        ...prev,
        tenantBundleDeploy: {
          status: "confirmed",
          hash: bundle.factoryTxHash as Hex,
          message: "Restored from persisted tenant contract bundle.",
        },
      }));

      setSaveState({
        status: "saved",
        persisted: true,
        message: "Tenant bundle restored from backend.",
      });
    }

    void loadPersistedDeployment();

    return () => {
      cancelled = true;
    };
  }, [effectiveTenantFactoryAddress]);

  useEffect(() => {
    let cancelled = false;

    async function syncSetupStateFromChain() {
      if (!deployment || saveState.status !== "saved") {
        return;
      }

      const nextTxRecords: Partial<Record<TxKey, TxRecord>> = {};

      if (treasuryWalletValid) {
        try {
          const operatorEnabled = await web3PublicClient.readContract({
            address: deployment.contracts.confidentialRwaToken,
            abi: getContractAbi("confidentialRwaToken"),
            functionName: "isOperator",
            args: [treasuryWallet as Address, deployment.contracts.transferController],
          });

          nextTxRecords.setOperator = operatorEnabled
            ? {
                status: "confirmed",
                message: "Restored from on-chain operator status.",
              }
            : {
                status: "idle",
                message: "TransferController is not yet operator for the treasury holder.",
              };
        } catch {
          // Leave current UI state unchanged when chain read fails.
        }
      }

      try {
        const requireRole = await web3PublicClient.readContract({
          address: deployment.contracts.auditAnchor,
          abi: getContractAbi("auditAnchor"),
          functionName: "requireSubmitterRole",
        });

        if (!cancelled && typeof requireRole === "boolean") {
          setOnchain((prev) =>
            prev.requireSubmitterRole === requireRole ? prev : { ...prev, requireSubmitterRole: requireRole },
          );

          nextTxRecords.setRequireSubmitterRole = requireRole
            ? {
                status: "confirmed",
                message: "AuditAnchor requires submitter role.",
              }
            : {
                status: "skipped",
                message: "AuditAnchor currently does not require submitter role.",
              };
        }
      } catch {
        // Leave current UI state unchanged when chain read fails.
      }

      if (operatorWalletValid) {
        try {
          const submitterEnabled = await web3PublicClient.readContract({
            address: deployment.contracts.auditAnchor,
            abi: getContractAbi("auditAnchor"),
            functionName: "submitters",
            args: [operatorWallet as Address],
          });

          nextTxRecords.setSubmitter = submitterEnabled
            ? {
                status: "confirmed",
                message: "Operator wallet is restored as AuditAnchor submitter.",
              }
            : {
                status: "idle",
                message: "Operator wallet is not yet registered as AuditAnchor submitter.",
              };
        } catch {
          // Leave current UI state unchanged when chain read fails.
        }
      }

      if (cancelled || Object.keys(nextTxRecords).length === 0) {
        return;
      }

      setTxRecords((prev) => ({
        ...prev,
        ...nextTxRecords,
      }));
    }

    void syncSetupStateFromChain();

    return () => {
      cancelled = true;
    };
  }, [
    deployment,
    saveState.status,
    treasuryWallet,
    treasuryWalletValid,
    operatorWallet,
    operatorWalletValid,
  ]);

  function updateTxRecord(key: TxKey, patch: TxRecord) {
    setTxRecords((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        ...patch,
      },
    }));
  }

  function buildSavePayload(
    currentDeployment: DeploymentState,
    overrides?: Partial<Record<TxKey, Hex>>,
  ): SaveTenantContractsRequestBody {
    return {
      chainId: TARGET_CHAIN_ID,
      mode: currentDeployment.mode,
      sourceLabel: currentDeployment.sourceLabel,
      contracts: {
        ...currentDeployment.contracts,
        ...(currentDeployment.factoryAddress ? { tenantFactory: currentDeployment.factoryAddress } : {}),
      },
      txHashes: mergeTxHashes(txRecords, overrides),
      tenant: {
        legalEntityName: onboarding.legalEntityName,
        institutionType: onboarding.institutionType,
        countryCode: onboarding.countryCode,
        regulatorLicense: onboarding.regulatorLicense,
        adminName: onboarding.adminName,
        adminEmail: onboarding.adminEmail,
        treasuryWallet,
        operatorWallet,
        auditorWallet,
        baseCurrency: onboarding.baseCurrency,
        policyTemplate: onboarding.policyTemplate,
      },
    };
  }

  async function persistDeployment(
    currentDeployment: DeploymentState,
    overrides?: Partial<Record<TxKey, Hex>>,
  ) {
    const response = await fetch("/api/tenant/contracts", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(buildSavePayload(currentDeployment, overrides)),
    });
    const payload = (await response.json().catch(() => null)) as SaveContractsEnvelope | null;
    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "Backend rejected tenant contract addresses.");
    }

    const persisted = payload.data?.persisted !== false;
    setSaveState({
      status: "saved",
      persisted,
      message: payload.data?.warning || "Contract addresses saved.",
    });
  }

  async function ensureTargetChain() {
    if (onTargetChain) {
      return;
    }
    await switchChainAsync({ chainId: TARGET_CHAIN_ID });
  }

  function applyDemoValues() {
    const wallet = connectedWallet;
    setOnboarding((prev) => ({
      ...prev,
      legalEntityName: prev.legalEntityName || "Demo RWA Capital LLC",
      regulatorLicense: prev.regulatorLicense || "DEMO-REG-421614",
      adminName: prev.adminName || "Demo Admin",
      adminEmail: prev.adminEmail || "admin@demo-rwa.example",
      treasuryWallet: prev.treasuryWallet || wallet,
      operatorWallet: prev.operatorWallet || wallet,
      auditorWallet: prev.auditorWallet || wallet,
    }));
    setOnchain((prev) => ({
      ...prev,
      tokenName: prev.tokenName || "Demo RWA Treasury Note",
      tokenSymbol: prev.tokenSymbol || "DRWA",
      tokenOwner: prev.tokenOwner || wallet,
      settlementAsset: prev.settlementAsset || runtimeSettlementAssetAddress || "",
      transferControllerAdmin: prev.transferControllerAdmin || wallet,
      disclosureAdmin: prev.disclosureAdmin || wallet,
      auditAnchorAdmin: prev.auditAnchorAdmin || wallet,
    }));
  }

  async function trackedTransaction(
    key: TxKey,
    submit: () => Promise<Hex>,
    verify?: (txHash: Hex) => Promise<void>,
  ): Promise<Hex> {
    updateTxRecord(key, { status: "awaiting-signature", message: "Confirm this transaction in your wallet." });

    try {
      const txHash = await submit();
      updateTxRecord(key, { status: "submitted", hash: txHash, message: "Submitted. Waiting for receipt." });
      const receipt = await web3PublicClient.waitForTransactionReceipt({ hash: txHash });
      if (receipt.status !== "success") {
        throw new Error(`${TX_LABELS[key]} reverted. Tx hash: ${txHash}`);
      }
      if (verify) {
        await verify(txHash);
      }
      updateTxRecord(key, { status: "confirmed", hash: txHash, message: "Confirmed on-chain." });
      return txHash;
    } catch (error) {
      const message = decodeWeb3FlowError(error, `${TX_LABELS[key]} failed.`);
      updateTxRecord(key, { status: "failed", message });
      throw new Error(message);
    }
  }

  async function deployTenantBundle() {
    setActionError(null);
    setActiveAction("deploy");

    try {
      if (!address) {
        throw new Error("Connect wallet first.");
      }
      await ensureTargetChain();

      if (!effectiveTenantFactoryAddress) {
        throw new Error(
          "TenantFactory is not configured in this environment. Set NEXT_PUBLIC_CONTRACT_TENANT_FACTORY to continue.",
        );
      }

      const tokenOwner = assertAddress(onchain.tokenOwner || treasuryWallet || connectedWallet || "", "Token owner");
      const settlementAsset = effectiveSettlementAsset;
      const factory = effectiveTenantFactoryAddress as Address;
      const signerBalance = await web3PublicClient.getBalance({ address });
      if (signerBalance <= BigInt(0)) {
        throw new Error(
          `Connected wallet ${address} has 0 ETH on Arbitrum Sepolia. Fund it with test ETH before deploying the tenant bundle.`,
        );
      }

      const estimatedGas = await web3PublicClient.estimateContractGas({
        account: address,
        address: factory,
        abi: getContractAbi("tenantFactory") as Abi,
        functionName: settlementAsset ? "createTenantSettlementBundle" : "createTenantBundle",
        args: settlementAsset ? [tokenOwner, settlementAsset] : [tokenOwner],
      });
      const gasWithBuffer = (estimatedGas * BigInt(12)) / BigInt(10);

      const txHash = await trackedTransaction("tenantBundleDeploy", () =>
        writeContractAsync({
          address: factory,
          abi: getContractAbi("tenantFactory") as Abi,
          functionName: settlementAsset ? "createTenantSettlementBundle" : "createTenantBundle",
          args: settlementAsset ? [tokenOwner, settlementAsset] : [tokenOwner],
          gas: gasWithBuffer,
        }),
      );

      const receipt = await web3PublicClient.waitForTransactionReceipt({ hash: txHash });
      const bundleFromLogs = extractTenantBundleFromLogs(receipt.logs as readonly ReceiptLog[], factory);
      if (!bundleFromLogs) {
        throw new Error(
          "TenantFactory transaction confirmed, but the wizard could not read TenantBundleCreated addresses from receipt logs.",
        );
      }

      const nextDeployment: DeploymentState = {
        mode: "tenant-factory",
        sourceLabel: "TenantFactory deployed tenant bundle",
        contracts: bundleFromLogs,
        deployTxHash: txHash,
        factoryAddress: factory,
      };
      setDeployment(nextDeployment);
      setSaveState({ status: "saving", message: "Persisting deployed contract bundle to backend." });
      await persistDeployment(nextDeployment, { tenantBundleDeploy: txHash });
    } catch (error) {
      const message = decodeWeb3FlowError(error, "Failed to deploy tenant bundle.");
      setActionError(message);
      if (effectiveTenantFactoryAddress) {
        updateTxRecord("tenantBundleDeploy", { status: "failed", message });
      }
    } finally {
      setActiveAction(null);
    }
  }

  async function saveContractAddresses() {
    setActionError(null);
    if (!deployment) {
      setSaveState({ status: "failed", message: "Deploy your tenant bundle before saving contract addresses." });
      return;
    }
    if (!deploymentReadyForSave) {
      setSaveState({ status: "failed", message: "Wait for TenantFactory deployment confirmation before saving." });
      return;
    }

    setSaveState({ status: "saving", message: "Saving contract addresses to /api/tenant/contracts." });
    setActiveAction("save");

    try {
      await persistDeployment(deployment);
    } catch (error) {
      setSaveState({
        status: "failed",
        message: decodeWeb3FlowError(error, "Failed to save contract addresses."),
      });
    } finally {
      setActiveAction(null);
    }
  }

  function requireDeployment(): ContractBundle {
    if (!deployment || !deploymentReadyForSave) {
      throw new Error("Deploy your tenant bundle and wait for confirmation before running setup transactions.");
    }
    return deployment.contracts;
  }

  async function runSetOperatorTx() {
    const contracts = requireDeployment();
    if (!address) {
      throw new Error("Connect wallet first.");
    }
    if (!connectedWalletMatchesTreasury) {
      throw new Error("Connected wallet must match Treasury wallet because setOperator is executed by the token holder.");
    }

    await ensureTargetChain();
    const holder = assertAddress(treasuryWallet, "Treasury wallet");
    const validUntil = BigInt(Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 365);

    await trackedTransaction(
      "setOperator",
      () =>
        writeContractAsync({
          address: contracts.confidentialRwaToken,
          abi: getContractAbi("confidentialRwaToken"),
          functionName: "setOperator",
          args: [contracts.transferController, validUntil],
        }),
      async () => {
        const operatorStatus = await web3PublicClient.readContract({
          address: contracts.confidentialRwaToken,
          abi: getContractAbi("confidentialRwaToken"),
          functionName: "isOperator",
          args: [holder, contracts.transferController],
        });
        if (operatorStatus !== true) {
          throw new Error("setOperator confirmed but isOperator still returned false.");
        }
      },
    );
  }

  async function runSetRequireSubmitterRoleTx() {
    const contracts = requireDeployment();
    if (!address) {
      throw new Error("Connect wallet first.");
    }

    await ensureTargetChain();
    await trackedTransaction("setRequireSubmitterRole", () =>
      writeContractAsync({
        address: contracts.auditAnchor,
        abi: getContractAbi("auditAnchor"),
        functionName: "setRequireSubmitterRole",
        args: [true],
      }),
    );
  }

  async function runSetSubmitterTx() {
    const contracts = requireDeployment();
    if (!address) {
      throw new Error("Connect wallet first.");
    }
    const submitter = assertAddress(operatorWallet, "Operator wallet");

    await ensureTargetChain();
    await trackedTransaction("setSubmitter", () =>
      writeContractAsync({
        address: contracts.auditAnchor,
        abi: getContractAbi("auditAnchor"),
        functionName: "setSubmitter",
        args: [submitter, true],
      }),
    );
  }

  async function runSetupAction(action: "setOperator" | "setRequireSubmitterRole" | "setSubmitter" | "setupAll") {
    setActionError(null);
    setActiveAction(action);
    try {
      if (!setupReadyToRun) {
        throw new Error("Save the deployed tenant bundle first. Setup transactions are locked until save succeeds.");
      }
      if (action === "setOperator") {
        await runSetOperatorTx();
      } else if (action === "setRequireSubmitterRole") {
        await runSetRequireSubmitterRoleTx();
      } else if (action === "setSubmitter") {
        await runSetSubmitterTx();
      } else {
        await runSetOperatorTx();
        if (onchain.requireSubmitterRole) {
          await runSetRequireSubmitterRoleTx();
        } else {
          updateTxRecord("setRequireSubmitterRole", {
            status: "skipped",
            message: "Skipped by setup option. AuditAnchor will keep its current submitter-role mode.",
          });
        }
        await runSetSubmitterTx();
      }
    } catch (error) {
      setActionError(decodeWeb3FlowError(error, "Setup transaction failed."));
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Tenant setup"
        title="Tenant-Owned Contract Onboarding"
        description="Deploy your own contract bundle from your wallet, save tenant runtime addresses, and run required setup transactions as contract owner."
        meta={<StatusBadge tone={setupConfirmed ? "success" : "accent"}>{setupConfirmed ? "Setup ready" : "Checklist mode"}</StatusBadge>}
      />

      <InlineNotice
        title="Canonical onboarding path"
        description="This flow requires TenantFactory deployment from your connected wallet. You become owner of the deployed tenant bundle, then execute setup transactions."
        tone="accent"
      />

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="space-y-5">
          <WizardStep
            step="Step 1"
            title="Connect wallet and switch chain"
            description="Use an authenticated wallet session on Arbitrum Sepolia before any deployment or setup transaction."
            tone={address && onTargetChain ? "success" : "warning"}
          >
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Wallet</p>
                <p className="mt-2 break-all font-mono text-sm text-foreground">{address ?? "Not connected"}</p>
                <div className="mt-4">
                  {address ? (
                    <StatusBadge tone="success">Connected</StatusBadge>
                  ) : (
                    <Button href="/login?next=/onboarding">Connect Wallet</Button>
                  )}
                </div>
              </div>
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Network</p>
                <p className="mt-2 text-sm text-foreground">
                  {chainId ? `${chainId}${onTargetChain ? " (Arbitrum Sepolia)" : " (switch required)"}` : "Unknown"}
                </p>
                <Button
                  className="mt-4"
                  variant={onTargetChain ? "secondary" : "primary"}
                  onClick={() => void ensureTargetChain()}
                  disabled={!address || onTargetChain || activeAction !== null}
                >
                  {onTargetChain ? "Chain ready" : "Switch to Arbitrum Sepolia"}
                </Button>
              </div>
            </div>
          </WizardStep>

          <WizardStep
            step="Step 2"
            title="Deploy tenant contract bundle"
            description="Deploy ConfidentialRWAToken, DisclosureRegistry, TransferController, and AuditAnchor via TenantFactory using your wallet as owner."
            tone={deploymentTone}
          >
            <div className="space-y-4">
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Deployment source</p>
                    <p className="mt-1 text-xs leading-5 text-muted">
                      {effectiveTenantFactoryAddress
                        ? `TenantFactory configured at ${effectiveTenantFactoryAddress}. Deployment is required to continue.`
                        : factoryConfigPending
                          ? "Checking runtime config for NEXT_PUBLIC_CONTRACT_TENANT_FACTORY..."
                        : effectiveTenantFactoryConfigured && effectiveTenantFactoryInvalid
                          ? "NEXT_PUBLIC_CONTRACT_TENANT_FACTORY is set but invalid. Fix configuration to continue onboarding."
                          : "TenantFactory env is not configured. Configure NEXT_PUBLIC_CONTRACT_TENANT_FACTORY to continue onboarding."}
                    </p>
                  </div>
                  <StatusBadge tone={factoryReady ? "success" : factoryConfigPending ? "warning" : "danger"}>
                    {factoryReady ? "Factory ready" : factoryConfigPending ? "Checking" : "Blocked"}
                  </StatusBadge>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <input
                  value={onchain.tokenName}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, tokenName: event.target.value }))}
                  placeholder="Token name"
                  className={inputClassName()}
                />
                <input
                  value={onchain.tokenSymbol}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, tokenSymbol: event.target.value.toUpperCase() }))}
                  placeholder="Token symbol"
                  className={inputClassName()}
                />
                <input
                  value={onchain.tokenDecimals}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, tokenDecimals: event.target.value }))}
                  placeholder="Decimals"
                  className={inputClassName()}
                />
              </div>

              <InlineNotice
                title="Factory deployment input"
                description="TenantFactory uses the token owner wallet on-chain. If a settlement asset is provided, it also deploys SettlementVault so USDT can be wrapped into confidential cUSDT."
                tone="accent"
              />

              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <label className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
                  Settlement asset for cUSDT wrapping
                </label>
                <input
                  value={onchain.settlementAsset || runtimeSettlementAssetAddress || ""}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, settlementAsset: event.target.value }))}
                  placeholder="USDT / MockUSDT ERC20 address (0x...)"
                  className={`${inputClassName(true)} mt-3`}
                />
                <p className="mt-2 text-xs leading-5 text-muted">
                  Optional but recommended for the demo. When filled, onboarding calls createTenantSettlementBundle and stores settlementVault in backend.
                  {runtimeSettlementVaultAddress ? ` Current env vault fallback: ${runtimeSettlementVaultAddress}.` : ""}
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <input
                  value={onchain.tokenOwner || treasuryWallet}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, tokenOwner: event.target.value }))}
                  placeholder="Token owner wallet (0x...)"
                  className={inputClassName(true)}
                />
                <input
                  value={onchain.transferControllerAdmin || treasuryWallet}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, transferControllerAdmin: event.target.value }))}
                  placeholder="Transfer controller admin (0x...)"
                  className={inputClassName(true)}
                />
                <input
                  value={onchain.disclosureAdmin || treasuryWallet}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, disclosureAdmin: event.target.value }))}
                  placeholder="Disclosure admin (0x...)"
                  className={inputClassName(true)}
                />
                <input
                  value={onchain.auditAnchorAdmin || treasuryWallet}
                  onChange={(event) => setOnchain((prev) => ({ ...prev, auditAnchorAdmin: event.target.value }))}
                  placeholder="Audit anchor admin (0x...)"
                  className={inputClassName(true)}
                />
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void deployTenantBundle()} disabled={!address || activeAction !== null || !factoryReady}>
                  {activeAction === "deploy"
                    ? "Deploying tenant bundle..."
                    : "Deploy Tenant Bundle"}
                </Button>
                <Button variant="ghost" onClick={applyDemoValues} disabled={activeAction !== null}>
                  Fill Demo Values
                </Button>
              </div>
              {!factoryReady ? (
                <InlineNotice
                  title="TenantFactory required"
                  description="Managed fallback is disabled in this onboarding flow. Configure NEXT_PUBLIC_CONTRACT_TENANT_FACTORY with a valid address to continue."
                  tone="danger"
                />
              ) : null}

              {deployment ? (
                <div className="space-y-3 rounded-2xl border border-border bg-surface p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{deployment.sourceLabel}</p>
                      <p className="mt-1 text-xs text-muted">Mode: {deployment.mode}</p>
                    </div>
                    <StatusBadge tone="success">Contracts selected</StatusBadge>
                  </div>
                  <AddressGrid contracts={deployment.contracts} />
                </div>
              ) : null}
            </div>
          </WizardStep>

          <WizardStep
            step="Step 3"
            title="Save contract addresses"
            description="Persist the deployed tenant bundle through /api/tenant/contracts after TenantFactory deployment is confirmed."
            tone={saveTone}
          >
            <div className="space-y-4">
              <Button onClick={() => void saveContractAddresses()} disabled={!deploymentReadyForSave || activeAction !== null}>
                {activeAction === "save" ? "Saving contracts..." : "Save Contract Addresses"}
              </Button>
              {!deploymentReadyForSave ? (
                <InlineNotice
                  title="Deployment required"
                  description="Save is unlocked only after TenantFactory deployment confirms and bundle addresses are available."
                  tone="warning"
                />
              ) : null}
              {saveState.message ? (
                <InlineNotice
                  title={saveState.status === "failed" ? "Save failed" : saveState.persisted === false ? "Validated only" : "Save status"}
                  description={saveState.message}
                  tone={saveState.status === "failed" ? "danger" : saveState.persisted === false ? "warning" : "success"}
                />
              ) : null}
            </div>
          </WizardStep>

          <WizardStep
            step="Step 4"
            title="Run required setup transactions"
            description="Grant TransferController as token operator, optionally enforce submitter role, then grant AuditAnchor submitter permission."
            tone={setupConfirmed ? "success" : "accent"}
          >
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-border bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Treasury holder</p>
                  <p className="mt-2 break-all font-mono text-xs text-foreground">{treasuryWallet || "Not set"}</p>
                  <p className="mt-2 text-xs text-muted">
                    setOperator requires the connected wallet to match this holder: {connectedWalletMatchesTreasury ? "ready" : "not ready"}.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-surface-soft p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Audit submitter</p>
                  <p className="mt-2 break-all font-mono text-xs text-foreground">{operatorWallet || "Not set"}</p>
                  <label className="mt-3 inline-flex items-center gap-2 text-xs text-foreground">
                    <input
                      type="checkbox"
                      checked={onchain.requireSubmitterRole}
                      onChange={(event) => setOnchain((prev) => ({ ...prev, requireSubmitterRole: event.target.checked }))}
                    />
                    Run optional setRequireSubmitterRole(true)
                  </label>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button onClick={() => void runSetupAction("setupAll")} disabled={!setupReadyToRun || activeAction !== null}>
                  {activeAction === "setupAll" ? "Running setup..." : "Run Required Setup TXs"}
                </Button>
                <Button variant="secondary" onClick={() => void runSetupAction("setOperator")} disabled={!setupReadyToRun || activeAction !== null}>
                  setOperator
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => void runSetupAction("setRequireSubmitterRole")}
                  disabled={!setupReadyToRun || activeAction !== null}
                >
                  setRequireSubmitterRole
                </Button>
                <Button variant="secondary" onClick={() => void runSetupAction("setSubmitter")} disabled={!setupReadyToRun || activeAction !== null}>
                  setSubmitter
                </Button>
              </div>
              {!setupReadyToRun ? (
                <InlineNotice
                  title="Setup locked"
                  description="Run Step 2 deployment and Step 3 save first. Setup transactions are only available for a saved tenant-owned bundle."
                  tone="warning"
                />
              ) : null}

              {!treasuryWalletValid || !operatorWalletValid ? (
                <InlineNotice
                  title="Wallet fields required"
                  description="Treasury wallet and operator wallet must be valid EVM addresses before setup transactions can succeed."
                  tone="warning"
                />
              ) : null}
              {actionError ? <InlineNotice title="Wizard action failed" description={actionError} tone="danger" /> : null}
              <TxStatusPanel records={txRecords} />
            </div>
          </WizardStep>
        </div>

        <aside className="space-y-6">
          <SectionCard title="Tenant profile" description="Profile data included when saving contract addresses.">
            <div className="grid gap-4">
              <input
                value={onboarding.legalEntityName}
                onChange={(event) => setOnboarding((prev) => ({ ...prev, legalEntityName: event.target.value }))}
                placeholder="Legal entity name"
                className={inputClassName()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <select
                  value={onboarding.institutionType}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, institutionType: event.target.value }))}
                  className={inputClassName()}
                >
                  <option>Bank</option>
                  <option>Asset Manager</option>
                  <option>Broker Dealer</option>
                  <option>Fintech</option>
                  <option>Corporate Treasury</option>
                </select>
                <input
                  value={onboarding.countryCode}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, countryCode: event.target.value.toUpperCase() }))}
                  placeholder="Country code"
                  className={inputClassName()}
                />
              </div>
              <input
                value={onboarding.regulatorLicense}
                onChange={(event) => setOnboarding((prev) => ({ ...prev, regulatorLicense: event.target.value }))}
                placeholder="Regulator license ID"
                className={inputClassName()}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={onboarding.adminName}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, adminName: event.target.value }))}
                  placeholder="Admin name"
                  className={inputClassName()}
                />
                <input
                  value={onboarding.adminEmail}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, adminEmail: event.target.value }))}
                  placeholder="Admin email"
                  className={inputClassName()}
                />
              </div>
              <input
                value={treasuryWallet}
                onChange={(event) => setOnboarding((prev) => ({ ...prev, treasuryWallet: event.target.value }))}
                placeholder="Treasury wallet (0x...)"
                className={inputClassName(true)}
              />
              <input
                value={operatorWallet}
                onChange={(event) => setOnboarding((prev) => ({ ...prev, operatorWallet: event.target.value }))}
                placeholder="Operator wallet (0x...)"
                className={inputClassName(true)}
              />
              <input
                value={auditorWallet}
                onChange={(event) => setOnboarding((prev) => ({ ...prev, auditorWallet: event.target.value }))}
                placeholder="Auditor wallet (0x...)"
                className={inputClassName(true)}
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <input
                  value={onboarding.baseCurrency}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, baseCurrency: event.target.value.toUpperCase() }))}
                  placeholder="Base currency"
                  className={inputClassName()}
                />
                <input
                  value={onboarding.policyTemplate}
                  onChange={(event) => setOnboarding((prev) => ({ ...prev, policyTemplate: event.target.value }))}
                  placeholder="Policy template"
                  className={inputClassName()}
                />
              </div>
              <p className="text-xs text-muted">Profile progress: {filledProfileFields}/11 fields completed.</p>
            </div>
          </SectionCard>

          <SectionCard title="Runtime summary" description="Current tenant-owned contract source and readiness status.">
            <div className="space-y-4 text-sm text-foreground">
              <div className="rounded-2xl border border-border bg-surface-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">Connected</p>
                <p className="mt-2 font-mono text-sm">{shortAddress(address)}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Selected source</p>
                <p className="mt-2 text-sm">{deployment?.sourceLabel ?? "No contracts selected yet"}</p>
                <p className="mt-3 text-xs font-semibold uppercase tracking-[0.16em] text-muted">Readiness</p>
                <p className="mt-2 text-xs">
                  Deploy: {txRecords.tenantBundleDeploy.status} · Save: {saveState.status} · Setup: {setupConfirmed ? "confirmed" : "pending"}
                </p>
              </div>
            </div>
          </SectionCard>
        </aside>
      </div>

      <SectionCard
        title="Required smart contracts"
        description="Minimum contract bundle for production-like transfer, disclosure, and audit flows."
      >
        <SurfaceTable>
          <table className="min-w-[900px] w-full text-left">
            <thead className="border-b border-border bg-surface-soft text-xs font-semibold uppercase tracking-[0.24em] text-muted">
              <tr>
                <th className="px-6 py-4">Contract</th>
                <th className="px-6 py-4">Required</th>
                <th className="px-6 py-4">Purpose</th>
                <th className="px-6 py-4">Key functions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {CONTRACT_SPECS.map((contract) => (
                <tr key={contract.name} className="hover:bg-surface-soft/80">
                  <td className="px-6 py-5 text-sm font-semibold text-foreground">{contract.name}</td>
                  <td className="px-6 py-5 text-sm text-foreground">{contract.required}</td>
                  <td className="px-6 py-5 text-sm text-foreground">{contract.purpose}</td>
                  <td className="px-6 py-5 text-sm text-foreground">{contract.keyFunctions}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </SurfaceTable>
      </SectionCard>

      <SectionCard title="Payload preview" description="Payload shape used for /api/tenant/contracts and setup status handoff.">
        <pre className="max-h-[420px] overflow-auto rounded-2xl border border-border bg-surface-soft p-4 text-xs text-foreground">
          {JSON.stringify(
            {
              onboarding,
              onchain,
              deployment,
              txHashes: txHashPayload(txRecords),
              saveState,
            },
            null,
            2,
          )}
        </pre>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button variant="secondary" href="/settings">View runtime contracts</Button>
          <Button variant="secondary" href="/settlement">Continue to settlement</Button>
          <Button href="/assets/new">Continue to create asset</Button>
        </div>
      </SectionCard>
    </div>
  );
}
