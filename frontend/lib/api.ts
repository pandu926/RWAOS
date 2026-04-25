import type { IconName } from "@/components/icons";
import {
  type Asset,
  type AuditEvent,
  type CompliancePassport,
  type Disclosure,
  type Investor,
  type StatusTone,
  type Transfer,
} from "@/lib/site-data";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};

type BackendAsset = {
  id: number;
  name: string;
  asset_type: string;
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

function getAuthHeader(): Record<string, string> {
  const token =
    process.env.INTERNAL_API_AUTH_TOKEN?.trim() ||
    process.env.API_AUTH_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_API_AUTH_TOKEN?.trim() ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
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

function describeTransferActivity(count: number): string {
  if (count <= 0) {
    return "No transfer activity yet";
  }
  if (count === 1) {
    return "1 transfer record";
  }
  return `${count} transfer records`;
}

async function fetchApiList<T>(path: string): Promise<T[] | null> {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return [];
  }

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      headers: {
        Accept: "application/json",
        ...getAuthHeader(),
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as ApiEnvelope<T[]> | T[];
    if (Array.isArray(payload)) {
      return payload;
    }
    if (payload.success && Array.isArray(payload.data)) {
      return payload.data;
    }
    return null;
  } catch {
    return null;
  }
}

function mapAsset(item: BackendAsset): Asset {
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
    issuer: "Confidential issuer registry",
    jurisdiction: "Arbitrum Sepolia",
    holdersCount: 0,
    confidentialAum: 0,
    yield: 0,
    lastActivity: "Registry synced",
    description: item.asset_type ? `Asset type: ${item.asset_type}.` : "Asset awaiting type classification.",
  };
}

function mapInvestor(item: BackendInvestor): Investor {
  return {
    id: `investor-${item.id}`,
    name: item.legal_name,
    address: item.wallet_address || "Wallet not mapped",
    role: item.jurisdiction,
    whitelistStatus: hasWalletAddress(item.wallet_address) ? "Verified" : "Pending review",
    assetsCount: 0,
    allocation: 0,
    lastActivity: hasWalletAddress(item.wallet_address) ? "Wallet mapped" : "Awaiting wallet mapping",
  };
}

function mapTransfer(
  item: BackendTransfer,
  context: {
    assetNameById: Map<number, string>;
    investorById: Map<number, BackendInvestor>;
  },
): Transfer {
  const assetName = context.assetNameById.get(item.asset_id) ?? `Asset ${item.asset_id}`;
  const fromInvestor = context.investorById.get(item.from_investor_id);
  const toInvestor = context.investorById.get(item.to_investor_id);
  const fromLabel = fromInvestor?.wallet_address || fromInvestor?.legal_name || `Investor ${item.from_investor_id}`;
  const toLabel = toInvestor?.wallet_address || toInvestor?.legal_name || `Investor ${item.to_investor_id}`;

  return {
    id: `TRF-${item.id}`,
    assetId: `asset-${item.asset_id}`,
    assetName,
    from: fromLabel,
    to: toLabel,
    amount: item.amount,
    amountVisibility: item.tx_hash ? "Restricted" : "Hidden",
    status: item.tx_hash ? "Confirmed" : "Pending",
    submittedAt: item.tx_hash || "Awaiting on-chain hash",
    reference: item.tx_hash || `Transfer ${item.id}`,
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
  const targetFromAction = item.action
    .split("_")
    .filter(Boolean)
    .join(" ");

  return {
    id: `AUD-${item.id}`,
    eventType: item.action,
    actor: item.actor,
    target: targetFromAction || "Registry event",
    visibility: "Restricted",
    result: item.action.startsWith("create_") ? "Verified" : "Review required",
    timestamp: formatUtcFromUnix(item.timestamp_unix),
    reference: `Event ${item.id}`,
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
    const holdersCount = new Set(
      transferMatches.flatMap((transfer) => [transfer.from_investor_id, transfer.to_investor_id]),
    ).size;
    const confidentialAum = transferMatches.reduce((sum, transfer) => sum + transfer.amount, 0);
    const lastActivity = transferMatches.length > 0
      ? `${transferMatches.length} tracked transfer${transferMatches.length === 1 ? "" : "s"}`
      : disclosureMatches.length > 0
        ? `${disclosureMatches.length} disclosure${disclosureMatches.length === 1 ? "" : "s"} active`
        : "Awaiting first operational event";

    return {
      ...mapAsset(item),
      holdersCount,
      confidentialAum,
      lastActivity,
      status: disclosureMatches.some((disclosure) => disclosure.tx_hash)
        ? "Active"
        : transferMatches.length > 0
          ? "Restricted"
          : "Paused",
    };
  });
}

export async function getInvestors(): Promise<Investor[]> {
  const [investorItems, transferItems] = await Promise.all([
    fetchApiList<BackendInvestor>("/investors"),
    fetchApiList<BackendTransfer>("/transfers"),
  ]);

  if (!investorItems) {
    return [];
  }

  return investorItems.map((item) => {
    const relatedTransfers = (transferItems ?? []).filter(
      (transfer) =>
        transfer.from_investor_id === item.id || transfer.to_investor_id === item.id,
    );
    const relatedAssets = new Set(relatedTransfers.map((transfer) => transfer.asset_id));
    const allocation = relatedTransfers.reduce((sum, transfer) => sum + transfer.amount, 0);

    return {
      ...mapInvestor(item),
      assetsCount: relatedAssets.size,
      allocation,
      lastActivity: describeTransferActivity(relatedTransfers.length),
    };
  });
}

export async function getTransfers(): Promise<Transfer[]> {
  const [transferItems, assetItems, investorItems] = await Promise.all([
    fetchApiList<BackendTransfer>("/transfers"),
    fetchApiList<BackendAsset>("/assets"),
    fetchApiList<BackendInvestor>("/investors"),
  ]);

  if (!transferItems) {
    return [];
  }

  const assetNameById = new Map<number, string>(
    (assetItems ?? []).map((item) => [item.id, item.name]),
  );
  const investorById = new Map<number, BackendInvestor>(
    (investorItems ?? []).map((item) => [item.id, item]),
  );

  return transferItems.map((item) =>
    mapTransfer(item, {
      assetNameById,
      investorById,
    }),
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
      title: "Transfer volume",
      value: `$${transfers.reduce((sum, transfer) => sum + transfer.amount, 0).toLocaleString()}`,
      detail: "From recorded transfer amounts",
      tone: "accent",
      icon: "wallet",
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
