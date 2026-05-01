import type { IconName } from "@/components/icons";
import { cookies } from "next/headers";
import { createPublicClient, http, isHex } from "viem";
import {
  type Asset,
  type AuditEvent,
  type CompliancePassport,
  type Disclosure,
  type Investor,
  type StatusTone,
  type Transfer,
} from "@/lib/site-data";
import {
  getWalletSessionFromCookieHeader,
  getWalletSessionToken,
  parseWalletSession,
  WALLET_SESSION_COOKIE,
} from "@/lib/web3/session";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};

type BackendAsset = {
  id: number;
  name: string;
  asset_type: string;
  metadata_uri?: string | null;
  issuance_wallet?: string | null;
  initial_supply?: number | null;
  anchor_hash?: string | null;
  anchor_tx_hash?: string | null;
  issuance_tx_hash?: string | null;
  created_at_unix?: number | null;
};

type BackendInvestor = {
  id: number;
  legal_name: string;
  jurisdiction: string;
  wallet_address?: string | null;
};

type BackendTransfer = {
  id: number;
  asset_id: number;
  from_investor_id: number;
  to_investor_id: number;
  amount: number;
  tx_hash?: string | null;
  status?: string | null;
  failure_reason?: string | null;
  onchain_metadata?: {
    chain_id?: number | null;
    sender_wallet_address?: string | null;
    recipient_wallet_address?: string | null;
    disclosure_data_id?: string | null;
    disclosure_registry_address?: string | null;
    transfer_controller_address?: string | null;
    token_address?: string | null;
    encrypted_amount?: string | null;
    input_proof?: string | null;
    reference_note?: string | null;
  } | null;
};

type BackendDisclosure = {
  id: number;
  asset_id: number;
  title: string;
  content: string;
  data_id?: string | null;
  grantee?: string | null;
  expires_at?: number | null;
  tx_hash?: string | null;
};

type BackendAuditEvent = {
  id: number;
  actor: string;
  action: string;
  timestamp_unix: number;
};

type BackendCompliancePassport = {
  id: number;
  transfer_record_id: number;
  transfer_id_onchain?: string | null;
  policy_hash: string;
  disclosure_data_id: string;
  anchor_hash: string;
  status: string;
  transfer_tx_hash: string;
  anchor_tx_hash: string;
  disclosure_scope?: string;
  reason?: string;
  created_by: string;
  created_by_role: string;
  created_at_unix: number;
  last_accessed_unix: number | null;
};

type DashboardMetric = {
  title: string;
  value: string;
  detail: string;
  tone: StatusTone;
  icon: IconName;
};

type DashboardData = {
  metrics: DashboardMetric[];
  alerts: string[];
  transfers: Transfer[];
  auditEvents: AuditEvent[];
};

function getApiBaseUrl(): string | null {
  const configured =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  if (!configured) {
    return null;
  }
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? null;
  const strictToken = getWalletSessionToken(parseWalletSession(sessionCookie));
  if (strictToken) {
    return { Authorization: `Bearer ${strictToken}` };
  }

  const cookieHeader = cookieStore.toString();
  const headerToken = getWalletSessionFromCookieHeader(cookieHeader)?.token?.trim();
  if (headerToken) {
    return { Authorization: `Bearer ${headerToken}` };
  }

  if (sessionCookie) {
    try {
      const parsed = JSON.parse(decodeURIComponent(sessionCookie)) as { token?: unknown };
      const fallbackToken =
        typeof parsed.token === "string" ? parsed.token.trim() : "";
      if (fallbackToken) {
        return { Authorization: `Bearer ${fallbackToken}` };
      }
    } catch {
      // Fall through to empty header.
    }
  }

  const rawCookie = cookieStore.get(WALLET_SESSION_COOKIE);
  if (rawCookie?.value) {
    try {
      const parsed = JSON.parse(rawCookie.value) as { token?: unknown };
      const fallbackToken =
        typeof parsed.token === "string" ? parsed.token.trim() : "";
      if (fallbackToken) {
        return { Authorization: `Bearer ${fallbackToken}` };
      }
    } catch {
      // Fall through to empty header.
    }
  }

  return {};
}

function extractArrayFromEnvelope<T>(payload: unknown): T[] | null {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (!payload || typeof payload !== "object") {
    return null;
  }

  const envelope = payload as ApiEnvelope<unknown>;
  if (!envelope.success) {
    return null;
  }

  if (Array.isArray(envelope.data)) {
    return envelope.data as T[];
  }

  if (!envelope.data || typeof envelope.data !== "object") {
    return null;
  }

  const nested = envelope.data as Record<string, unknown>;
  for (const key of ["items", "rows", "assets", "investors", "transfers", "disclosures", "events"]) {
    const candidate = nested[key];
    if (Array.isArray(candidate)) {
      return candidate as T[];
    }
  }

  return null;
}

function formatUtcFromUnix(timestampUnix: number): string {
  if (!Number.isFinite(timestampUnix)) {
    return "Unknown time";
  }
  return new Date(timestampUnix * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function hasWalletAddress(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeWallet(value: string | null | undefined): string | null {
  const trimmed = value?.trim().toLowerCase() ?? "";
  return /^0x[a-f0-9]{40}$/.test(trimmed) ? trimmed : null;
}

async function getViewerWalletAddress(): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? null;
  const parsedSession = parseWalletSession(sessionCookie);
  const strictAddress = normalizeWallet(parsedSession?.address);
  if (strictAddress) {
    return strictAddress;
  }

  try {
    const fallback = JSON.parse(decodeURIComponent(sessionCookie ?? "")) as { address?: unknown };
    return typeof fallback.address === "string" ? normalizeWallet(fallback.address) : null;
  } catch {
    return null;
  }
}

function walletMatches(a: string | null | undefined, b: string | null | undefined): boolean {
  const normalizedA = normalizeWallet(a);
  const normalizedB = normalizeWallet(b);
  return Boolean(normalizedA && normalizedB && normalizedA === normalizedB);
}

function hasActiveDisclosureForViewer(
  disclosures: BackendDisclosure[],
  transfer: BackendTransfer,
  disclosureDataId: string | null,
  viewerWallet: string | null,
): boolean {
  if (!viewerWallet || !disclosureDataId) {
    return false;
  }

  const nowUnix = Math.floor(Date.now() / 1000);
  return disclosures.some((disclosure) => {
    if (disclosure.asset_id !== transfer.asset_id) {
      return false;
    }
    if (!walletMatches(disclosure.grantee, viewerWallet)) {
      return false;
    }
    if ((disclosure.data_id?.trim().toLowerCase() ?? "") !== disclosureDataId.toLowerCase()) {
      return false;
    }
    return !disclosure.expires_at || disclosure.expires_at > nowUnix;
  });
}

type TransferRuntimeStatus = "Pending" | "Confirmed" | "Failed";

function getArbitrumSepoliaRpcUrl(): string {
  const configured =
    process.env.INTERNAL_ARBITRUM_SEPOLIA_RPC_URL?.trim() ||
    process.env.NEXT_PUBLIC_ARBITRUM_SEPOLIA_RPC_URL?.trim() ||
    process.env.ARBITRUM_SEPOLIA_RPC_URL?.trim() ||
    "";
  if (configured) {
    return configured;
  }
  return "https://sepolia-rollup.arbitrum.io/rpc";
}

const transferStatusClient = createPublicClient({
  transport: http(getArbitrumSepoliaRpcUrl()),
});

function normalizeTransferStatus(rawStatus: string | null | undefined): TransferRuntimeStatus | null {
  if (!rawStatus) {
    return null;
  }
  const normalized = rawStatus.trim().toLowerCase();
  if (normalized === "confirmed" || normalized === "success") {
    return "Confirmed";
  }
  if (normalized === "failed" || normalized === "reverted" || normalized === "rejected") {
    return "Failed";
  }
  if (normalized === "pending" || normalized === "submitted") {
    return "Pending";
  }
  return null;
}

async function resolveTransferStatus(item: BackendTransfer): Promise<TransferRuntimeStatus> {
  const backendStatus = normalizeTransferStatus(item.status);
  if (backendStatus) {
    return backendStatus;
  }

  const txHash = item.tx_hash?.trim() ?? "";
  if (!isHex(txHash, { strict: true }) || txHash.length !== 66) {
    return "Pending";
  }

  try {
    const receipt = await transferStatusClient.getTransactionReceipt({ hash: txHash as `0x${string}` });
    return receipt.status === "success" ? "Confirmed" : "Failed";
  } catch {
    return "Pending";
  }
}

async function fetchApiList<T>(path: string): Promise<T[] | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return [];
  }

  try {
    const authHeader = await getAuthHeader();
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        ...authHeader,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as unknown;
    return extractArrayFromEnvelope<T>(payload);
  } catch {
    return null;
  }
}

function mapAsset(item: BackendAsset, viewerWallet: string | null): Asset {
  const derivedSymbol = item.name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 6) || `AST${item.id}`;

  return {
    id: `asset-${item.id}`,
    name: item.name,
    symbol: derivedSymbol,
    type: item.asset_type,
    status: "Active",
    issuer: item.issuance_wallet || "Tenant issuance wallet",
    jurisdiction: "Arbitrum Sepolia",
    holdersCount: 0,
    confidentialAum: 0,
    aumVisibility: walletMatches(item.issuance_wallet, viewerWallet) ? "Visible to owner" : "Restricted",
    yield: 0,
    lastActivity: item.anchor_tx_hash ? "On-chain issuance anchored" : "Registry synced",
    description: item.asset_type
      ? `Asset type: ${item.asset_type}.${item.metadata_uri ? ` Metadata: ${item.metadata_uri}` : ""}`
      : "Asset awaiting type classification.",
    metadataUri: item.metadata_uri || null,
    issuanceWallet: item.issuance_wallet || null,
    initialSupply: typeof item.initial_supply === "number" ? item.initial_supply : null,
    anchorHash: item.anchor_hash || null,
    anchorTxHash: item.anchor_tx_hash || null,
    issuanceTxHash: item.issuance_tx_hash || null,
    createdAtUnix: typeof item.created_at_unix === "number" ? item.created_at_unix : null,
  };
}

function mapInvestor(item: BackendInvestor): Investor {
  const walletMapped = hasWalletAddress(item.wallet_address);
  return {
    id: `investor-${item.id}`,
    name: item.legal_name,
    address: item.wallet_address || "Wallet not mapped",
    role: item.jurisdiction,
    whitelistStatus: walletMapped ? "Verified" : "Pending review",
    assetsCount: 0,
    allocation: 0,
    lastActivity: walletMapped ? "Wallet mapped" : "Awaiting wallet mapping",
    jurisdiction: item.jurisdiction,
    walletMapped,
    sentTransfers: 0,
    receivedTransfers: 0,
    disclosureGrants: 0,
    initialHolderAssetsCount: 0,
    readiness: walletMapped ? "Ready" : "Needs wallet mapping",
  };
}

async function mapTransfer(
  item: BackendTransfer,
  context: {
    assetNameById: Map<number, string>;
    assetById: Map<number, BackendAsset>;
    investorById: Map<number, BackendInvestor>;
    disclosures: BackendDisclosure[];
    viewerWallet: string | null;
  },
): Promise<Transfer> {
  const assetName = context.assetNameById.get(item.asset_id) ?? `Asset ${item.asset_id}`;
  const fromInvestor = context.investorById.get(item.from_investor_id);
  const toInvestor = context.investorById.get(item.to_investor_id);
  const fromLabel = fromInvestor?.wallet_address || fromInvestor?.legal_name || `Investor ${item.from_investor_id}`;
  const toLabel = toInvestor?.wallet_address || toInvestor?.legal_name || `Investor ${item.to_investor_id}`;
  const transferStatus = await resolveTransferStatus(item);
  const transferTxHash = item.tx_hash?.trim() || null;
  const persistedDisclosureDataId = item.onchain_metadata?.disclosure_data_id?.trim() || null;
  const persistedReferenceNote = item.onchain_metadata?.reference_note?.trim() || null;
  const senderWallet = item.onchain_metadata?.sender_wallet_address?.trim() || fromInvestor?.wallet_address || null;
  const recipientWallet = item.onchain_metadata?.recipient_wallet_address?.trim() || toInvestor?.wallet_address || null;
  const asset = context.assetById.get(item.asset_id) ?? null;
  const viewerIsOwner = walletMatches(asset?.issuance_wallet, context.viewerWallet);
  const viewerIsParticipant = walletMatches(senderWallet, context.viewerWallet) || walletMatches(recipientWallet, context.viewerWallet);
  const viewerHasDisclosure = hasActiveDisclosureForViewer(
    context.disclosures,
    item,
    persistedDisclosureDataId,
    context.viewerWallet,
  );
  const amountVisibility: Transfer["amountVisibility"] =
    transferStatus !== "Confirmed"
      ? "Hidden"
      : viewerIsOwner
        ? "Visible to owner"
        : viewerIsParticipant || viewerHasDisclosure
          ? "Visible to authorized wallet"
          : "Restricted";
  const submittedAt =
    transferStatus === "Pending" && !transferTxHash
      ? "Awaiting on-chain hash"
      : transferTxHash || `Transfer ${item.id}`;
  const reference =
    persistedReferenceNote ||
    persistedDisclosureDataId ||
    transferTxHash ||
    `Transfer ${item.id}`;

  return {
    id: `TRF-${item.id}`,
    assetId: `asset-${item.asset_id}`,
    assetName,
    from: fromLabel,
    to: toLabel,
    amount: item.amount,
    amountVisibility,
    status: transferStatus,
    submittedAt,
    reference,
    txHash: transferTxHash,
    disclosureDataId: persistedDisclosureDataId,
    senderWallet,
    recipientWallet,
    failureReason: item.failure_reason?.trim() || null,
    referenceNote: persistedReferenceNote,
  };
}

function mapDisclosure(
  item: BackendDisclosure,
  context: {
    assetNameById: Map<number, string>;
  },
): Disclosure {
  const nowUnix = Math.floor(Date.now() / 1000);
  const status: Disclosure["status"] =
    item.expires_at && item.expires_at < nowUnix ? "Expired" : "Active";

  return {
    id: `DCL-${item.id}`,
    grantee: item.grantee || item.title,
    granteeAddress: item.grantee || "Grantee not recorded",
    assetId: `asset-${item.asset_id}`,
    assetName: context.assetNameById.get(item.asset_id) ?? `Asset ${item.asset_id}`,
    scope: item.data_id || item.content,
    grantedBy: item.tx_hash || "Pending on-chain tx",
    expiresAt: item.expires_at ? formatUtcFromUnix(item.expires_at) : "No expiry",
    status,
  };
}

function mapAuditEvent(item: BackendAuditEvent): AuditEvent {
  const [eventType, ...rawParts] = item.action.split(":");
  const actionDetails = new Map<string, string>();
  for (const part of rawParts) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex > 0) {
      actionDetails.set(part.slice(0, separatorIndex), part.slice(separatorIndex + 1));
    }
  }

  const target =
    eventType === "asset_issued"
      ? `Asset #${actionDetails.get("id") ?? "?"} ${actionDetails.get("name") ?? ""}`.trim()
      : eventType === "disclosure_granted"
        ? `Disclosure #${actionDetails.get("id") ?? "?"} for asset #${actionDetails.get("asset_id") ?? "?"}`
        : eventType === "confidential_transfer_recorded"
          ? `Transfer #${actionDetails.get("id") ?? "?"} ${actionDetails.get("status") ?? ""}`.trim()
          : eventType === "passport_issued"
            ? `Passport #${actionDetails.get("id") ?? "?"} for transfer #${actionDetails.get("transfer_record_id") ?? "?"}`
          : rawParts.length > 0
            ? rawParts.join(" ")
            : eventType.split("_").filter(Boolean).join(" ");
  const verifiedEvent =
    eventType === "asset_issued" ||
    eventType === "disclosure_granted" ||
    eventType === "confidential_transfer_recorded" ||
    eventType === "passport_issued" ||
    eventType === "proof_anchor_recorded";

  return {
    id: `AUD-${item.id}`,
    eventType,
    actor: item.actor,
    target: target || "Registry event",
    visibility: "Restricted",
    result: verifiedEvent ? "Verified" : "Review required",
    timestamp: formatUtcFromUnix(item.timestamp_unix),
    reference:
      actionDetails.get("tx") ||
      actionDetails.get("issuance_tx") ||
      actionDetails.get("transfer_tx") ||
      actionDetails.get("anchor_tx") ||
      `Event ${item.id}`,
  };
}

function mapCompliancePassport(item: BackendCompliancePassport): CompliancePassport {
  const normalizedScope = item.disclosure_scope
    ? item.disclosure_scope
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
    : [];

  return {
    id: `PAS-${item.id}`,
    transferId: `TRF-${item.transfer_record_id}`,
    transferIdOnchain: item.transfer_id_onchain ?? null,
    status:
      item.status === "Anchored" || item.status === "Disclosed to Authorized"
        ? item.status
        : "Confidential",
    policyHash: item.policy_hash,
    disclosureDataId: item.disclosure_data_id,
    anchorHash: item.anchor_hash,
    transferTxHash: item.transfer_tx_hash,
    anchorTxHash: item.anchor_tx_hash,
    disclosureScope: normalizedScope,
    reason: item.reason ?? null,
    createdBy: item.created_by,
    createdByRole: item.created_by_role,
    createdAt: formatUtcFromUnix(item.created_at_unix),
    lastAccessedAt: item.last_accessed_unix ? formatUtcFromUnix(item.last_accessed_unix) : "Never",
  };
}

export async function getAssets(): Promise<Asset[]> {
  const viewerWallet = await getViewerWalletAddress();
  const [assetItems, transferItems, disclosureItems] = await Promise.all([
    fetchApiList<BackendAsset>("/assets"),
    fetchApiList<BackendTransfer>("/transfers"),
    fetchApiList<BackendDisclosure>("/disclosures"),
  ]);

  if (!assetItems) {
    return [];
  }

  return assetItems.map((item) => {
    const transferMatches = (transferItems ?? []).filter((transfer) => transfer.asset_id === item.id);
    const disclosureMatches = (disclosureItems ?? []).filter((disclosure) => disclosure.asset_id === item.id);
    const transferHolderIds = new Set(
      transferMatches.flatMap((transfer) => [transfer.from_investor_id, transfer.to_investor_id]),
    );
    const inferredIssuanceHolderCount = item.issuance_wallet ? 1 : 0;
    const holdersCount = Math.max(transferHolderIds.size, inferredIssuanceHolderCount);
    const transferredAum = transferMatches.reduce((sum, transfer) => sum + transfer.amount, 0);
    const issuedAum = typeof item.initial_supply === "number" && item.initial_supply > 0 ? item.initial_supply : 0;
    const confidentialAum = Math.max(transferredAum, issuedAum);
    const lastActivity = transferMatches.length > 0
      ? `${transferMatches.length} tracked transfer${transferMatches.length === 1 ? "" : "s"}`
      : item.issuance_tx_hash
        ? "Initial confidential issuance minted"
      : disclosureMatches.length > 0
        ? `${disclosureMatches.length} disclosure${disclosureMatches.length === 1 ? "" : "s"} active`
        : "Awaiting first operational event";

    return {
      ...mapAsset(item, viewerWallet),
      holdersCount,
      confidentialAum,
      lastActivity,
      status:
        transferMatches.length === 0 && disclosureMatches.length === 0
          ? "Active"
          : disclosureMatches.some((disclosure) => disclosure.tx_hash)
            ? "Active"
            : transferMatches.length > 0
              ? "Restricted"
              : "Paused",
    };
  });
}

export async function getInvestors(): Promise<Investor[]> {
  const [investorItems, transferItems, assetItems, disclosureItems] = await Promise.all([
    fetchApiList<BackendInvestor>("/investors"),
    fetchApiList<BackendTransfer>("/transfers"),
    fetchApiList<BackendAsset>("/assets"),
    fetchApiList<BackendDisclosure>("/disclosures"),
  ]);

  if (!investorItems) {
    return [];
  }

  return investorItems.map((item) => {
    const normalizedWallet = item.wallet_address?.trim().toLowerCase() || null;
    const relatedTransfers = (transferItems ?? []).filter(
      (transfer) =>
        transfer.from_investor_id === item.id || transfer.to_investor_id === item.id,
    );
    const relatedAssets = new Set(relatedTransfers.map((transfer) => transfer.asset_id));
    const sentTransfers = relatedTransfers.filter((transfer) => transfer.from_investor_id === item.id);
    const receivedTransfers = relatedTransfers.filter((transfer) => transfer.to_investor_id === item.id);
    const totalTransferVolume = relatedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);
    const initialHolderAssets = normalizedWallet
      ? (assetItems ?? []).filter(
          (asset) => asset.issuance_wallet?.trim().toLowerCase() === normalizedWallet,
        )
      : [];
    const disclosureGrants = normalizedWallet
      ? (disclosureItems ?? []).filter(
          (disclosure) => disclosure.grantee?.trim().toLowerCase() === normalizedWallet,
        )
      : [];
    for (const asset of initialHolderAssets) {
      relatedAssets.add(asset.id);
    }

    let lastActivity = "No operational usage yet";
    if (relatedTransfers.length > 0) {
      lastActivity = `${sentTransfers.length} sent / ${receivedTransfers.length} received transfer records`;
    } else if (initialHolderAssets.length > 0) {
      lastActivity = `Initial issuance holder for ${initialHolderAssets.length} asset${initialHolderAssets.length === 1 ? "" : "s"}`;
    } else if (hasWalletAddress(item.wallet_address)) {
      lastActivity = "Wallet mapped and ready for disclosure/transfer flows";
    }

    return {
      ...mapInvestor(item),
      assetsCount: relatedAssets.size,
      allocation: totalTransferVolume,
      lastActivity,
      sentTransfers: sentTransfers.length,
      receivedTransfers: receivedTransfers.length,
      disclosureGrants: disclosureGrants.length,
      initialHolderAssetsCount: initialHolderAssets.length,
    };
  });
}

export async function getTransfers(): Promise<Transfer[]> {
  const viewerWallet = await getViewerWalletAddress();
  const [transferItems, assetItems, investorItems, disclosureItems] = await Promise.all([
    fetchApiList<BackendTransfer>("/transfers"),
    fetchApiList<BackendAsset>("/assets"),
    fetchApiList<BackendInvestor>("/investors"),
    fetchApiList<BackendDisclosure>("/disclosures"),
  ]);

  if (!transferItems) {
    return [];
  }

  const assetNameById = new Map<number, string>(
    (assetItems ?? []).map((item) => [item.id, item.name]),
  );
  const assetById = new Map<number, BackendAsset>(
    (assetItems ?? []).map((item) => [item.id, item]),
  );
  const investorById = new Map<number, BackendInvestor>(
    (investorItems ?? []).map((item) => [item.id, item]),
  );

  return Promise.all(
    transferItems.map((item) =>
      mapTransfer(item, {
        assetNameById,
        assetById,
        investorById,
        disclosures: disclosureItems ?? [],
        viewerWallet,
      }),
    ),
  );
}

export async function getDisclosures(): Promise<Disclosure[]> {
  const [disclosureItems, assetItems] = await Promise.all([
    fetchApiList<BackendDisclosure>("/disclosures"),
    fetchApiList<BackendAsset>("/assets"),
  ]);

  if (!disclosureItems) {
    return [];
  }

  const assetNameById = new Map<number, string>(
    (assetItems ?? []).map((item) => [item.id, item.name]),
  );

  return disclosureItems.map((item) =>
    mapDisclosure(item, {
      assetNameById,
    }),
  );
}

export async function getAuditEvents(): Promise<AuditEvent[]> {
  const apiItems = await fetchApiList<BackendAuditEvent>("/audit/events");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapAuditEvent);
}

export async function getCompliancePassports(): Promise<CompliancePassport[]> {
  const apiItems = await fetchApiList<BackendCompliancePassport>("/compliance/passports");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapCompliancePassport);
}

export async function getDashboardData(): Promise<DashboardData> {
  const [assets, investors, transfers, disclosures, auditEvents] = await Promise.all([
    getAssets(),
    getInvestors(),
    getTransfers(),
    getDisclosures(),
    getAuditEvents(),
  ]);

  const visibleTransfers = transfers.filter((transfer) => transfer.amountVisibility.startsWith("Visible"));
  const visibleTransferVolume = visibleTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);
  const totalIssuedSupply = assets
    .filter((asset) => asset.aumVisibility === "Visible to owner")
    .reduce((sum, asset) => sum + asset.confidentialAum, 0);

  const metrics: DashboardMetric[] = [
    {
      title: "Live assets",
      value: `${assets.length}`,
      detail: `${disclosures.length} disclosures`,
      tone: "neutral",
      icon: "building",
    },
    {
      title: "Active holders",
      value: `${investors.length}`,
      detail: "From investor registry",
      tone: "success",
      icon: "users",
    },
    {
      title: "Owner-visible AUM",
      value: totalIssuedSupply > 0 ? `$${totalIssuedSupply.toLocaleString()}` : "Encrypted",
      detail: totalIssuedSupply > 0 ? "Visible to connected tenant owner" : "Requires owner or disclosure access",
      tone: "accent",
      icon: "wallet",
    },
    {
      title: "Visible transfers",
      value: visibleTransfers.length > 0 ? `$${visibleTransferVolume.toLocaleString()}` : "Encrypted",
      detail: `${visibleTransfers.length}/${transfers.length} transfer amounts visible to this wallet`,
      tone: "success",
      icon: "shield",
    },
    {
      title: "Audit events",
      value: `${auditEvents.length}`,
      detail: "From audit event stream",
      tone: "warning",
      icon: "shield",
    },
  ];

  const alerts = [
    `Disclosures tracked: ${disclosures.length}.`,
    `Audit events available: ${auditEvents.length}.`,
    `Transfers tracked: ${transfers.length}.`,
  ];

  return {
    metrics,
    alerts,
    transfers,
    auditEvents,
  };
}
