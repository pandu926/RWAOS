import type { IconName } from "@/components/icons";

export type StatusTone =
  | "neutral"
  | "success"
  | "warning"
  | "danger"
  | "accent";

export type Asset = {
  id: string;
  name: string;
  symbol: string;
  type: string;
  status: "Active" | "Paused" | "Restricted" | "Archived";
  issuer: string;
  jurisdiction: string;
  holdersCount: number;
  confidentialAum: number;
  aumVisibility: "Restricted" | "Visible to owner";
  yield: number;
  lastActivity: string;
  description: string;
  metadataUri?: string | null;
  issuanceWallet?: string | null;
  initialSupply?: number | null;
  anchorHash?: string | null;
  anchorTxHash?: string | null;
  issuanceTxHash?: string | null;
  createdAtUnix?: number | null;
};

export type Transfer = {
  id: string;
  assetId: string;
  assetName: string;
  from: string;
  to: string;
  amount: number;
  amountVisibility: "Hidden" | "Restricted" | "Visible to owner" | "Visible to authorized wallet";
  status: "Submitted" | "Pending" | "Confirmed" | "Failed" | "Rejected";
  submittedAt: string;
  reference: string;
  txHash?: string | null;
  disclosureDataId?: string | null;
  senderWallet?: string | null;
  recipientWallet?: string | null;
  failureReason?: string | null;
  referenceNote?: string | null;
};

export type Disclosure = {
  id: string;
  grantee: string;
  granteeAddress: string;
  assetId: string;
  assetName: string;
  scope: string;
  grantedBy: string;
  expiresAt: string;
  status: "Active" | "Revoked" | "Expired";
};

export type Investor = {
  id: string;
  name: string;
  address: string;
  role: string;
  whitelistStatus: "Verified" | "Pending review" | "Restricted";
  assetsCount: number;
  allocation: number;
  lastActivity: string;
  jurisdiction: string;
  walletMapped: boolean;
  sentTransfers: number;
  receivedTransfers: number;
  disclosureGrants: number;
  initialHolderAssetsCount: number;
  readiness: "Ready" | "Needs wallet mapping";
};

export type AuditEvent = {
  id: string;
  eventType: string;
  actor: string;
  target: string;
  visibility: "Confidential" | "Restricted" | "Visible to authorized users only";
  result: "Verified" | "Review required" | "Rejected";
  timestamp: string;
  reference: string;
};

export type CompliancePassport = {
  id: string;
  transferId: string;
  transferIdOnchain: string | null;
  status: "Anchored" | "Disclosed to Authorized" | "Confidential";
  policyHash: string;
  disclosureDataId: string;
  anchorHash: string;
  transferTxHash: string;
  anchorTxHash: string;
  disclosureScope: string[];
  reason: string | null;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  lastAccessedAt: string;
};

export const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/onboarding", label: "Onboarding", icon: "sparkles" },
  { href: "/assets", label: "Assets", icon: "building" },
  { href: "/investors", label: "Investors", icon: "users" },
  { href: "/settlement", label: "Settlement", icon: "wallet" },
  { href: "/transfers", label: "Transfers", icon: "transfers" },
  { href: "/disclosures", label: "Disclosures", icon: "eye" },
  { href: "/audit", label: "Audit", icon: "shield" },
  { href: "/compliance/passports", label: "Passports", icon: "key" },
  { href: "/reports", label: "Reports", icon: "report" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

function readRuntimeValue(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }
  return value.trim();
}

export const organization = {
  name: readRuntimeValue("NEXT_PUBLIC_ORGANIZATION_NAME", "RWA Organization"),
  productName: readRuntimeValue("NEXT_PUBLIC_PRODUCT_NAME", "Confidential RWA OS"),
  environmentLabel: readRuntimeValue("NEXT_PUBLIC_ENVIRONMENT_LABEL", "Runtime environment"),
  networkName: readRuntimeValue("NEXT_PUBLIC_NETWORK_NAME", "Arbitrum Sepolia"),
  supportEmail: readRuntimeValue("NEXT_PUBLIC_SUPPORT_EMAIL", "support@example.com"),
  healthStatus: readRuntimeValue("NEXT_PUBLIC_HEALTH_STATUS", "Live"),
};

export function assetTone(status: Asset["status"]): StatusTone {
  switch (status) {
    case "Active":
      return "success";
    case "Paused":
      return "warning";
    case "Restricted":
      return "danger";
    case "Archived":
      return "neutral";
  }
}

export function transferTone(status: Transfer["status"]): StatusTone {
  switch (status) {
    case "Confirmed":
      return "success";
    case "Pending":
    case "Submitted":
      return "warning";
    case "Failed":
    case "Rejected":
      return "danger";
  }
}

export function disclosureTone(status: Disclosure["status"]): StatusTone {
  switch (status) {
    case "Active":
      return "success";
    case "Revoked":
      return "danger";
    case "Expired":
      return "warning";
  }
}

export function investorTone(status: Investor["whitelistStatus"]): StatusTone {
  switch (status) {
    case "Verified":
      return "success";
    case "Pending review":
      return "warning";
    case "Restricted":
      return "danger";
  }
}

export function auditTone(result: AuditEvent["result"]): StatusTone {
  switch (result) {
    case "Verified":
      return "success";
    case "Review required":
      return "warning";
    case "Rejected":
      return "danger";
  }
}
