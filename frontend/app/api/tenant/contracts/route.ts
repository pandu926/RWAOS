import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";
import { toTenantBundleRuntime, type TenantContractBundle, type TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";

type ContractAddressesPayload = {
  confidentialRwaToken?: unknown;
  disclosureRegistry?: unknown;
  transferController?: unknown;
  auditAnchor?: unknown;
  settlementAsset?: unknown;
  settlementVault?: unknown;
  tenantFactory?: unknown;
};

type SaveTenantContractsRequest = {
  chainId?: unknown;
  mode?: unknown;
  sourceLabel?: unknown;
  contracts?: ContractAddressesPayload;
  txHashes?: unknown;
  tenant?: unknown;
};

type BackendEnvelope = {
  success?: unknown;
  data?: unknown;
  error?: unknown;
};

type BackendTenantContract = {
  institution_id: unknown;
  chain_id: unknown;
  token_address: unknown;
  disclosure_registry_address: unknown;
  transfer_controller_address: unknown;
  audit_anchor_address: unknown;
  settlement_asset_address?: unknown;
  settlement_vault_address?: unknown;
  factory_tx_hash: unknown;
  owner_wallet: unknown;
  deployment_status: unknown;
  created_at_unix: unknown;
};

const REQUIRED_CONTRACT_KEYS = [
  "confidentialRwaToken",
  "disclosureRegistry",
  "transferController",
  "auditAnchor",
] as const;

const TX_HASH_KEYS = [
  "tenantBundleDeploy",
  "setOperator",
  "setRequireSubmitterRole",
  "setSubmitter",
] as const;

const TENANT_STRING_FIELDS = [
  "legalEntityName",
  "institutionType",
  "countryCode",
  "regulatorLicense",
  "adminName",
  "adminEmail",
  "baseCurrency",
  "policyTemplate",
] as const;

const TENANT_WALLET_FIELDS = ["treasuryWallet", "operatorWallet", "auditorWallet"] as const;
const ZERO_TX_HASH = `0x${"0".repeat(64)}`;

function getBackendBaseUrl(): string {
  const base =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  if (!base) {
    throw new Error("Backend API base URL is not configured.");
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isEvmAddress(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function isTxHash(value: unknown): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value.trim());
}

function normalizeChainId(value: unknown): number | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value !== "string" || !/^\d+$/.test(value.trim())) {
    return null;
  }
  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function normalizeMode(value: unknown): "tenant-factory" | null {
  if (value === "tenant-factory") {
    return value;
  }
  return null;
}

function normalizeOptionalString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.slice(0, maxLength);
}

function normalizeContractAddresses(contracts: unknown) {
  if (!isPlainObject(contracts)) {
    throw new Error("`contracts` must be an object.");
  }

  const normalized: Record<string, string> = {};
  for (const key of REQUIRED_CONTRACT_KEYS) {
    const value = contracts[key];
    if (!isEvmAddress(value)) {
      throw new Error(`\`${key}\` must be a valid EVM address.`);
    }
    normalized[key] = value.trim();
  }

  if (contracts.tenantFactory !== undefined && contracts.tenantFactory !== null) {
    if (!isEvmAddress(contracts.tenantFactory)) {
      throw new Error("`tenantFactory` must be a valid EVM address when provided.");
    }
    normalized.tenantFactory = contracts.tenantFactory.trim();
  }
  for (const key of ["settlementAsset", "settlementVault"] as const) {
    const value = contracts[key];
    if (value === undefined || value === null || value === "") {
      continue;
    }
    if (!isEvmAddress(value)) {
      throw new Error(`\`${key}\` must be a valid EVM address when provided.`);
    }
    normalized[key] = value.trim();
  }

  return normalized;
}

function normalizeTxHashes(value: unknown) {
  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const key of TX_HASH_KEYS) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }
    if (!isTxHash(candidate)) {
      throw new Error(`\`${key}\` must be a valid transaction hash when provided.`);
    }
    normalized[key] = candidate.trim();
  }
  return normalized;
}

function normalizeTenant(value: unknown) {
  if (!isPlainObject(value)) {
    return {};
  }

  const normalized: Record<string, string> = {};
  for (const key of TENANT_STRING_FIELDS) {
    const normalizedValue = normalizeOptionalString(value[key], 160);
    if (normalizedValue) {
      normalized[key] = normalizedValue;
    }
  }

  for (const key of TENANT_WALLET_FIELDS) {
    const candidate = value[key];
    if (candidate === undefined || candidate === null || candidate === "") {
      continue;
    }
    if (!isEvmAddress(candidate)) {
      throw new Error(`\`${key}\` must be a valid EVM address when provided.`);
    }
    normalized[key] = candidate.trim();
  }

  return normalized;
}

function normalizePayload(payload: SaveTenantContractsRequest) {
  const chainId = normalizeChainId(payload.chainId);
  if (!chainId) {
    throw new Error("`chainId` must be a positive integer.");
  }

  const mode = normalizeMode(payload.mode);
  if (!mode) {
    throw new Error("`mode` must be `tenant-factory`.");
  }

  const tenant = normalizeTenant(payload.tenant);
  const ownerWallet = tenant.treasuryWallet ?? tenant.operatorWallet ?? tenant.auditorWallet;
  if (!ownerWallet) {
    throw new Error("`tenant.treasuryWallet` is required to persist contract ownership.");
  }

  return {
    chain_id: chainId,
    mode,
    source_label: normalizeOptionalString(payload.sourceLabel, 160) ?? mode,
    contracts: normalizeContractAddresses(payload.contracts),
    tx_hashes: normalizeTxHashes(payload.txHashes),
    tenant,
    owner_wallet: ownerWallet,
  };
}

function toBackendPayload(normalizedPayload: ReturnType<typeof normalizePayload>) {
  return {
    chain_id: normalizedPayload.chain_id,
    token_address: normalizedPayload.contracts.confidentialRwaToken,
    disclosure_registry_address: normalizedPayload.contracts.disclosureRegistry,
    transfer_controller_address: normalizedPayload.contracts.transferController,
    audit_anchor_address: normalizedPayload.contracts.auditAnchor,
    settlement_asset_address: normalizedPayload.contracts.settlementAsset,
    settlement_vault_address: normalizedPayload.contracts.settlementVault,
    factory_tx_hash: normalizedPayload.tx_hashes.tenantBundleDeploy ?? ZERO_TX_HASH,
    owner_wallet: normalizedPayload.owner_wallet,
    deployment_status: "deployed",
  };
}

function parseBackendContractRow(value: unknown): TenantContractBundle {
  if (!isPlainObject(value)) {
    throw new Error("Backend tenant contract payload must be an object.");
  }

  const row = value as BackendTenantContract;
  const institutionId = Number(row.institution_id);
  const chainId = Number(row.chain_id);
  const createdAtUnix = Number(row.created_at_unix);
  if (!Number.isInteger(institutionId) || institutionId <= 0) {
    throw new Error("Backend tenant contract `institution_id` is invalid.");
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("Backend tenant contract `chain_id` is invalid.");
  }
  if (!Number.isInteger(createdAtUnix) || createdAtUnix < 0) {
    throw new Error("Backend tenant contract `created_at_unix` is invalid.");
  }

  if (!isEvmAddress(row.token_address)) {
    throw new Error("Backend tenant contract `token_address` is invalid.");
  }
  if (!isEvmAddress(row.disclosure_registry_address)) {
    throw new Error("Backend tenant contract `disclosure_registry_address` is invalid.");
  }
  if (!isEvmAddress(row.transfer_controller_address)) {
    throw new Error("Backend tenant contract `transfer_controller_address` is invalid.");
  }
  if (!isEvmAddress(row.audit_anchor_address)) {
    throw new Error("Backend tenant contract `audit_anchor_address` is invalid.");
  }
  if (row.settlement_asset_address !== undefined && row.settlement_asset_address !== null && !isEvmAddress(row.settlement_asset_address)) {
    throw new Error("Backend tenant contract `settlement_asset_address` is invalid.");
  }
  if (row.settlement_vault_address !== undefined && row.settlement_vault_address !== null && !isEvmAddress(row.settlement_vault_address)) {
    throw new Error("Backend tenant contract `settlement_vault_address` is invalid.");
  }
  if (!isTxHash(row.factory_tx_hash)) {
    throw new Error("Backend tenant contract `factory_tx_hash` is invalid.");
  }
  if (!isEvmAddress(row.owner_wallet)) {
    throw new Error("Backend tenant contract `owner_wallet` is invalid.");
  }
  if (typeof row.deployment_status !== "string" || row.deployment_status.trim().length === 0) {
    throw new Error("Backend tenant contract `deployment_status` is invalid.");
  }

  const deploymentStatus = row.deployment_status.trim();
  const mode = deploymentStatus.toLowerCase() === "managed-global" ? "managed-global" : "tenant-factory";

  return {
    institutionId,
    chainId,
    contracts: {
      confidentialRwaToken: row.token_address.trim().toLowerCase() as `0x${string}`,
      disclosureRegistry: row.disclosure_registry_address.trim().toLowerCase() as `0x${string}`,
      transferController: row.transfer_controller_address.trim().toLowerCase() as `0x${string}`,
      auditAnchor: row.audit_anchor_address.trim().toLowerCase() as `0x${string}`,
      ...(typeof row.settlement_asset_address === "string"
        ? { settlementAsset: row.settlement_asset_address.trim().toLowerCase() as `0x${string}` }
        : {}),
      ...(typeof row.settlement_vault_address === "string"
        ? { settlementVault: row.settlement_vault_address.trim().toLowerCase() as `0x${string}` }
        : {}),
    },
    factoryTxHash: row.factory_tx_hash.trim().toLowerCase() as `0x${string}`,
    ownerWallet: row.owner_wallet.trim().toLowerCase() as `0x${string}`,
    deploymentStatus,
    mode,
    sourceLabel: deploymentStatus,
    createdAtUnix,
  };
}

function parseBackendEnvelope(raw: string): BackendEnvelope {
  const parsed = JSON.parse(raw) as unknown;
  if (!isPlainObject(parsed)) {
    throw new Error("Backend /tenant/contracts response must be a JSON object.");
  }
  return parsed as BackendEnvelope;
}

function parseRuntimeFromBackendEnvelope(
  envelope: BackendEnvelope,
  requireBundle: boolean,
): TenantBundleRuntime {
  if (envelope.success !== true) {
    const error = typeof envelope.error === "string" ? envelope.error : "Backend /tenant/contracts request failed.";
    return toTenantBundleRuntime(null, error);
  }

  if (envelope.data === null || envelope.data === undefined) {
    if (requireBundle) {
      throw new Error("Backend /tenant/contracts returned empty data for save request.");
    }
    return toTenantBundleRuntime(null);
  }

  return toTenantBundleRuntime(parseBackendContractRow(envelope.data));
}

async function proxyTenantContracts(options: {
  request: Request;
  method: "GET" | "POST";
  backendBody?: unknown;
}) {
  const token = getWalletSessionTokenFromRequest(options.request);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing wallet session token. Please reconnect wallet." },
      { status: 401 },
    );
  }

  let backendBaseUrl = "";
  try {
    backendBaseUrl = getBackendBaseUrl();
  } catch (error) {
    const message = error instanceof Error ? error.message : "Backend API base URL is not configured.";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }

  const cookie = options.request.headers.get("cookie");

  try {
    const response = await fetch(`${backendBaseUrl}/tenant/contracts`, {
      method: options.method,
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(cookie ? { cookie } : {}),
      },
      ...(options.backendBody ? { body: JSON.stringify(options.backendBody) } : {}),
      cache: "no-store",
    });

    const rawBody = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    if (!contentType.includes("application/json")) {
      return new NextResponse(rawBody, {
        status: response.status,
        headers: { "content-type": contentType },
      });
    }

    const envelope = parseBackendEnvelope(rawBody);
    const runtime = parseRuntimeFromBackendEnvelope(envelope, options.method === "POST");

    return NextResponse.json(
      {
        success: runtime.state !== "error",
        data: {
          ...runtime,
          ...(options.method === "POST" ? { persisted: runtime.state === "configured" } : {}),
        },
        error: runtime.error,
      },
      { status: response.status },
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to reach backend tenant contracts endpoint.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}

export async function GET(request: Request) {
  return proxyTenantContracts({ request, method: "GET" });
}

export async function POST(request: Request) {
  let payload: SaveTenantContractsRequest;
  try {
    payload = (await request.json()) as SaveTenantContractsRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  let normalizedPayload: ReturnType<typeof normalizePayload>;
  try {
    normalizedPayload = normalizePayload(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid tenant contract payload.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  return proxyTenantContracts({
    request,
    method: "POST",
    backendBody: toBackendPayload(normalizedPayload),
  });
}
