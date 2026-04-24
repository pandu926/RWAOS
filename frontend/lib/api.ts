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
};

type BackendTransfer = {
  id: number;
  asset_id: number;
  from_investor_id: number;
  to_investor_id: number;
  amount: number;
};

type BackendDisclosure = {
  id: number;
  asset_id: number;
  title: string;
  content: string;
};

type BackendAuditEvent = {
  id: number;
  actor: string;
  action: string;
  timestamp_unix: number;
};

type BackendCompliancePassport = {
  id: number;
  transfer_id: number;
  policy_hash: string;
  disclosure_data_id: string;
  anchor_hash: string;
  status: string;
  transfer_tx_hash: string;
  anchor_tx_hash: string;
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
  return {
    id: `asset-${item.id}`,
    name: item.name,
    symbol: `AST-${item.id}`,
    type: item.asset_type,
    status: "Active",
    issuer: "Backend registry",
    jurisdiction: "Not specified",
    holdersCount: 0,
    confidentialAum: 0,
    yield: 0,
    lastActivity: "Live API",
    description: `Asset type: ${item.asset_type}.`,
  };
}

function mapInvestor(item: BackendInvestor): Investor {
  return {
    id: `investor-${item.id}`,
    name: item.legal_name,
    address: `investor-${item.id}`,
    role: item.jurisdiction,
    whitelistStatus: "Verified",
    assetsCount: 0,
    allocation: 0,
    lastActivity: "Live API",
  };
}

function mapTransfer(item: BackendTransfer): Transfer {
  return {
    id: `TRF-${item.id}`,
    assetId: `asset-${item.asset_id}`,
    assetName: `Asset #${item.asset_id}`,
    from: `Investor #${item.from_investor_id}`,
    to: `Investor #${item.to_investor_id}`,
    amount: item.amount,
    amountVisibility: "Visible to authorized users only",
    status: "Confirmed",
    submittedAt: "Live API",
    reference: `Transfer #${item.id}`,
  };
}

function mapDisclosure(item: BackendDisclosure): Disclosure {
  return {
    id: `DCL-${item.id}`,
    grantee: item.title,
    granteeAddress: "Live API",
    assetId: `asset-${item.asset_id}`,
    assetName: `Asset #${item.asset_id}`,
    scope: item.content,
    grantedBy: "Backend API",
    grantedAt: "Live API",
    status: "Active",
  };
}

function mapAuditEvent(item: BackendAuditEvent): AuditEvent {
  return {
    id: `AUD-${item.id}`,
    eventType: item.action,
    actor: item.actor,
    target: "Backend API event",
    visibility: "Visible to authorized users only",
    result: "Verified",
    timestamp: formatUtcFromUnix(item.timestamp_unix),
    reference: `Event #${item.id}`,
  };
}

function mapCompliancePassport(item: BackendCompliancePassport): CompliancePassport {
  return {
    id: `PAS-${item.id}`,
    transferId: `TRF-${item.transfer_id}`,
    status:
      item.status === "Anchored" || item.status === "Disclosed to Authorized"
        ? item.status
        : "Confidential",
    policyHash: item.policy_hash,
    disclosureDataId: item.disclosure_data_id,
    anchorHash: item.anchor_hash,
    transferTxHash: item.transfer_tx_hash,
    anchorTxHash: item.anchor_tx_hash,
    createdBy: item.created_by,
    createdByRole: item.created_by_role,
    createdAt: formatUtcFromUnix(item.created_at_unix),
    lastAccessedAt: item.last_accessed_unix ? formatUtcFromUnix(item.last_accessed_unix) : "Never",
  };
}

export async function getAssets(): Promise<Asset[]> {
  const apiItems = await fetchApiList<BackendAsset>("/assets");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapAsset);
}

export async function getInvestors(): Promise<Investor[]> {
  const apiItems = await fetchApiList<BackendInvestor>("/investors");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapInvestor);
}

export async function getTransfers(): Promise<Transfer[]> {
  const apiItems = await fetchApiList<BackendTransfer>("/transfers");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapTransfer);
}

export async function getDisclosures(): Promise<Disclosure[]> {
  const apiItems = await fetchApiList<BackendDisclosure>("/disclosures");
  if (!apiItems) {
    return [];
  }
  return apiItems.map(mapDisclosure);
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
      title: "Confidential transfer volume",
      value: `$${transfers.reduce((sum, transfer) => sum + transfer.amount, 0).toLocaleString()}`,
      detail: "Aggregated from transfer records",
      tone: "accent",
      icon: "wallet",
    },
    {
      title: "Open compliance actions",
      value: `${disclosures.filter((item) => item.status !== "Revoked").length}`,
      detail: "Derived from disclosures",
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
