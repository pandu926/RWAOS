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
  yield: number;
  lastActivity: string;
  description: string;
};

export type Transfer = {
  id: string;
  assetId: string;
  assetName: string;
  from: string;
  to: string;
  amount: number;
  amountVisibility: "Hidden" | "Restricted" | "Visible to authorized users only";
  status: "Submitted" | "Pending" | "Confirmed" | "Failed" | "Rejected";
  submittedAt: string;
  reference: string;
};

export type Disclosure = {
  id: string;
  grantee: string;
  granteeAddress: string;
  assetId: string;
  assetName: string;
  scope: string;
  grantedBy: string;
  grantedAt: string;
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
  status: "Anchored" | "Disclosed to Authorized" | "Confidential";
  policyHash: string;
  disclosureDataId: string;
  anchorHash: string;
  transferTxHash: string;
  anchorTxHash: string;
  createdBy: string;
  createdByRole: string;
  createdAt: string;
  lastAccessedAt: string;
};

export const navigation: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { href: "/assets", label: "Assets", icon: "building" },
  { href: "/investors", label: "Investors", icon: "users" },
  { href: "/transfers", label: "Transfers", icon: "transfers" },
  { href: "/disclosures", label: "Disclosures", icon: "eye" },
  { href: "/audit", label: "Audit", icon: "shield" },
  { href: "/compliance/passports", label: "Passports", icon: "key" },
  { href: "/reports", label: "Reports", icon: "report" },
  { href: "/settings", label: "Settings", icon: "settings" },
];

export const organization = {
  name: "Global Asset Custody Ltd.",
  productName: "Confidential RWA OS",
  environmentLabel: "Pilot environment",
  networkName: "Arbitrum Sepolia",
  supportEmail: "ops-support@globalasset.io",
  healthStatus: "Operational",
};

export const sessionProfile = {
  name: "Alex Rivera",
  role: "Admin",
  walletAddress: "0x71C8a1D2F6C4b38EaA9411e4e8B",
  notifications: 3,
};

export const assets: Asset[] = [
  {
    id: "institutional-treasury",
    name: "Institutional Treasury",
    symbol: "USD-T",
    type: "Sovereign treasury",
    status: "Active",
    issuer: "Global Markets Desk",
    jurisdiction: "Global / Multi-jurisdictional",
    holdersCount: 42,
    confidentialAum: 128_000_000,
    yield: 5.4,
    lastActivity: "2 minutes ago",
    description:
      "AAA-rated short-term treasury instrument used for institutional liquidity management and confidential internal rebalancing.",
  },
  {
    id: "prime-real-estate-fund",
    name: "Prime Real Estate Fund",
    symbol: "PRE-F",
    type: "Commercial real estate",
    status: "Active",
    issuer: "Real Asset Allocation",
    jurisdiction: "Singapore / UAE",
    holdersCount: 18,
    confidentialAum: 76_000_000,
    yield: 8.1,
    lastActivity: "14 minutes ago",
    description:
      "Tokenized office and logistics portfolio with restricted visibility over allocations and settlement amounts.",
  },
  {
    id: "green-energy-debt",
    name: "Green Energy Debt II",
    symbol: "GED-II",
    type: "Private debt",
    status: "Restricted",
    issuer: "Infra Credit Team",
    jurisdiction: "EU",
    holdersCount: 11,
    confidentialAum: 43_500_000,
    yield: 9.3,
    lastActivity: "1 hour ago",
    description:
      "Confidential debt issuance supporting renewable energy projects with selective disclosure for external auditors.",
  },
  {
    id: "global-private-credit",
    name: "Global Private Credit",
    symbol: "GPC-9",
    type: "Credit strategy",
    status: "Paused",
    issuer: "Capital Structuring Office",
    jurisdiction: "US / UK",
    holdersCount: 27,
    confidentialAum: 92_700_000,
    yield: 11.2,
    lastActivity: "Yesterday",
    description:
      "Private credit vehicle with temporary transfer restrictions while updated disclosure scopes are being reviewed.",
  },
];

export const investors: Investor[] = [
  {
    id: "northbridge-capital",
    name: "Northbridge Capital",
    address: "0xA93b4120d7Ab82dB2E2F8C2391AF1324",
    role: "Institutional holder",
    whitelistStatus: "Verified",
    assetsCount: 3,
    allocation: 31_200_000,
    lastActivity: "5 minutes ago",
  },
  {
    id: "veridian-treasury",
    name: "Veridian Treasury",
    address: "0xCe6B22b113dcB0072e3A944A8Bf66219",
    role: "Treasury desk",
    whitelistStatus: "Verified",
    assetsCount: 2,
    allocation: 18_500_000,
    lastActivity: "29 minutes ago",
  },
  {
    id: "atlas-family-office",
    name: "Atlas Family Office",
    address: "0x11F39AbC781Ad4e4Bb79091d189fEc22",
    role: "Accredited investor",
    whitelistStatus: "Pending review",
    assetsCount: 1,
    allocation: 7_800_000,
    lastActivity: "Today",
  },
  {
    id: "quartz-advisory",
    name: "Quartz Advisory",
    address: "0x90Bd6CC571c7dbF0a20E1a421cA64818",
    role: "Auditor",
    whitelistStatus: "Verified",
    assetsCount: 4,
    allocation: 0,
    lastActivity: "Today",
  },
  {
    id: "horizon-lending",
    name: "Horizon Lending",
    address: "0x6aFC1a2bcfd9271b6B9d7Af3c01331F5",
    role: "Credit counterparty",
    whitelistStatus: "Restricted",
    assetsCount: 1,
    allocation: 5_400_000,
    lastActivity: "2 days ago",
  },
];

export const transfers: Transfer[] = [
  {
    id: "TRF-240422-001",
    assetId: "institutional-treasury",
    assetName: "Institutional Treasury",
    from: "0x4a72...d9e1",
    to: "0x1c81...a3f4",
    amount: 1_250_000,
    amountVisibility: "Visible to authorized users only",
    status: "Confirmed",
    submittedAt: "2026-04-22 14:22 UTC",
    reference: "Internal treasury rebalance",
  },
  {
    id: "TRF-240422-002",
    assetId: "institutional-treasury",
    assetName: "Institutional Treasury",
    from: "0x7b54...e422",
    to: "0x71C8...4e8B",
    amount: 820_000,
    amountVisibility: "Hidden",
    status: "Confirmed",
    submittedAt: "2026-04-22 10:15 UTC",
    reference: "Liquidity routing",
  },
  {
    id: "TRF-240421-018",
    assetId: "prime-real-estate-fund",
    assetName: "Prime Real Estate Fund",
    from: "0x2f30...88b2",
    to: "0x9a77...cc31",
    amount: 500_000,
    amountVisibility: "Restricted",
    status: "Pending",
    submittedAt: "2026-04-21 18:04 UTC",
    reference: "Investor distribution cycle",
  },
  {
    id: "TRF-240421-013",
    assetId: "green-energy-debt",
    assetName: "Green Energy Debt II",
    from: "0x31c4...991b",
    to: "0x8e28...7d40",
    amount: 1_900_000,
    amountVisibility: "Visible to authorized users only",
    status: "Submitted",
    submittedAt: "2026-04-21 13:41 UTC",
    reference: "Debt tranche allocation",
  },
  {
    id: "TRF-240420-007",
    assetId: "global-private-credit",
    assetName: "Global Private Credit",
    from: "0x1f1b...14cc",
    to: "0xd2e0...ad11",
    amount: 300_000,
    amountVisibility: "Restricted",
    status: "Rejected",
    submittedAt: "2026-04-20 09:40 UTC",
    reference: "Pre-settlement transfer blocked",
  },
];

export const disclosures: Disclosure[] = [
  {
    id: "DCL-001",
    grantee: "SEC Regulatory Body",
    granteeAddress: "0x4F19...aB92",
    assetId: "prime-real-estate-fund",
    assetName: "Prime Real Estate Fund",
    scope: "View transfer amounts",
    grantedBy: "Compliance Lead",
    grantedAt: "2026-04-22 09:20 UTC",
    status: "Active",
  },
  {
    id: "DCL-002",
    grantee: "Internal Audit Team",
    granteeAddress: "Role: SUPER_VIEWER",
    assetId: "institutional-treasury",
    assetName: "Institutional Treasury",
    scope: "Full metadata read",
    grantedBy: "Admin System",
    grantedAt: "2026-04-12 09:15 UTC",
    status: "Active",
  },
  {
    id: "DCL-003",
    grantee: "Tax Advisory Partners",
    granteeAddress: "0x2A10...fC11",
    assetId: "global-private-credit",
    assetName: "Global Private Credit",
    scope: "View P&L data",
    grantedBy: "Fund Manager",
    grantedAt: "2026-04-02 16:45 UTC",
    status: "Active",
  },
  {
    id: "DCL-004",
    grantee: "Temp Analyst",
    granteeAddress: "0x71Df...eE04",
    assetId: "green-energy-debt",
    assetName: "Green Energy Debt II",
    scope: "Identity verification only",
    grantedBy: "Compliance Lead",
    grantedAt: "2026-03-28 11:30 UTC",
    status: "Revoked",
  },
];

export const auditEvents: AuditEvent[] = [
  {
    id: "AUD-501",
    eventType: "Transfer confirmed",
    actor: "Alex Rivera",
    target: "Institutional Treasury / TRF-240422-001",
    visibility: "Visible to authorized users only",
    result: "Verified",
    timestamp: "2026-04-22 14:24 UTC",
    reference: "Proof hash 0x0bc3...19d8",
  },
  {
    id: "AUD-500",
    eventType: "Disclosure granted",
    actor: "Compliance Lead",
    target: "Prime Real Estate Fund / SEC Regulatory Body",
    visibility: "Restricted",
    result: "Verified",
    timestamp: "2026-04-22 09:20 UTC",
    reference: "Scope policy update",
  },
  {
    id: "AUD-499",
    eventType: "Transfer rejected",
    actor: "Policy Engine",
    target: "Global Private Credit / TRF-240420-007",
    visibility: "Confidential",
    result: "Rejected",
    timestamp: "2026-04-20 09:41 UTC",
    reference: "Whitelist mismatch",
  },
  {
    id: "AUD-498",
    eventType: "Role reviewed",
    actor: "Operations Admin",
    target: "Atlas Family Office",
    visibility: "Restricted",
    result: "Review required",
    timestamp: "2026-04-19 17:30 UTC",
    reference: "Pending credential refresh",
  },
];

export const dashboardMetrics = [
  {
    title: "Live assets",
    value: "12",
    detail: "4 require disclosure review",
    tone: "neutral" as StatusTone,
    icon: "building" as IconName,
  },
  {
    title: "Active holders",
    value: "1,402",
    detail: "+4.1% vs last cycle",
    tone: "success" as StatusTone,
    icon: "users" as IconName,
  },
  {
    title: "Confidential transfer volume",
    value: "$248.5M",
    detail: "Aggregated, shielded on-chain",
    tone: "accent" as StatusTone,
    icon: "wallet" as IconName,
  },
  {
    title: "Open compliance actions",
    value: "3",
    detail: "Review disclosure expiry today",
    tone: "warning" as StatusTone,
    icon: "shield" as IconName,
  },
];

export const dashboardAlerts = [
  "Pending compliance reviews: 3 assets require disclosure updates before next transfer window.",
  "One operator wallet still awaits credential refresh after role change.",
  "Weekly auditor package is ready to share with external reviewers.",
];

export const reportTrend = [
  { label: "Jan", value: 42 },
  { label: "Feb", value: 56 },
  { label: "Mar", value: 50 },
  { label: "Apr", value: 74 },
  { label: "May", value: 61 },
  { label: "Jun", value: 70 },
  { label: "Jul", value: 86 },
];

export const reportDistribution = [
  { label: "Auto-approved", value: 88.5, color: "#0f172a" },
  { label: "Manual review", value: 5.5, color: "#c5d2e6" },
  { label: "Rejected", value: 6, color: "#d45a5a" },
];

export const settingsData = {
  organizationSettings: {
    environment: "Pilot / Arbitrum Sepolia",
    supportEmail: organization.supportEmail,
    retentionPolicy: "7 years audit retention",
    privacyMode: "Selective disclosure by default",
  },
  roles: [
    {
      name: "Admin",
      description: "Full system configuration and governance access.",
      members: 2,
    },
    {
      name: "Operator",
      description: "Asset lifecycle operations and transfer execution.",
      members: 8,
    },
    {
      name: "Auditor",
      description: "Read-only access to approved logs and disclosure scopes.",
      members: 4,
    },
    {
      name: "Investor",
      description: "Portfolio visibility and role-scoped confirmations.",
      members: 142,
    },
  ],
  network: {
    chain: organization.networkName,
    settlementTime: "< 2 minutes",
    privacyMethod: "zk-SNARKs",
    systemHealth: 99.98,
  },
};

export function getAssetById(id: string) {
  return assets.find((asset) => asset.id === id);
}

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
