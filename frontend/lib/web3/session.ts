export const WALLET_SESSION_COOKIE = "rwaos_wallet_session";
export const TARGET_CHAIN_ID = 421614;
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

export type WalletSession = {
  address: string;
  chainId: number;
  role?: "admin" | "operator" | "auditor";
  token?: string;
  connectedAt: string;
};

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase();
}

function isLikelyEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

export function isAllowedWallet(address: string): boolean {
  // Open signup mode: any valid wallet can start a tenant session.
  return isLikelyEvmAddress(address);
}

function appendWalletCsv(target: Set<string>, csv: string | undefined) {
  if (!csv?.trim()) {
    return;
  }
  for (const item of csv.split(",").map((entry) => normalizeAddress(entry)).filter(Boolean)) {
    target.add(item);
  }
}

export function getAllowlistedWalletsFromEnv(): Set<string> {
  const wallets = new Set<string>();
  appendWalletCsv(wallets, process.env.NEXT_PUBLIC_ALLOWED_WALLETS);
  appendWalletCsv(wallets, process.env.AUTH_ADMIN_WALLETS);
  appendWalletCsv(wallets, process.env.AUTH_OPERATOR_WALLETS);
  appendWalletCsv(wallets, process.env.AUTH_AUDITOR_WALLETS);
  return wallets;
}

function isLikelySessionToken(token: WalletSession["token"]): boolean {
  if (typeof token !== "string") {
    return false;
  }
  return token.trim().length > 0;
}

export function validateWalletSession(session: WalletSession | null): boolean {
  if (!session) {
    return false;
  }
  if (!isLikelyEvmAddress(session.address)) {
    return false;
  }
  if (!Number.isFinite(session.chainId) || session.chainId !== TARGET_CHAIN_ID) {
    return false;
  }
  if (!session.connectedAt || !ISO_DATE_RE.test(session.connectedAt) || Number.isNaN(Date.parse(session.connectedAt))) {
    return false;
  }
  if (!isLikelySessionToken(session.token)) {
    return false;
  }
  return true;
}

export function getWalletSessionToken(session: WalletSession | null): string | null {
  if (!session?.token) {
    return null;
  }
  const token = session.token.trim();
  return token.length > 0 ? token : null;
}

export function serializeWalletSession(value: WalletSession): string {
  return encodeURIComponent(JSON.stringify(value));
}

export function parseWalletSession(serialized: string | null | undefined): WalletSession | null {
  if (!serialized) {
    return null;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(serialized)) as WalletSession;
    if (!validateWalletSession(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getWalletSessionFromCookieHeader(cookieHeader: string | null): WalletSession | null {
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((part) => part.trim());
  const target = segments.find((part) => part.startsWith(`${WALLET_SESSION_COOKIE}=`));
  if (!target) {
    return null;
  }

  const serialized = target.slice(WALLET_SESSION_COOKIE.length + 1);
  return parseWalletSession(serialized);
}

function tokenFromAuthorizationHeader(authorizationHeader: string | null): string | null {
  if (!authorizationHeader) {
    return null;
  }
  const [scheme, ...rest] = authorizationHeader.trim().split(/\s+/);
  if (!scheme || scheme.toLowerCase() !== "bearer") {
    return null;
  }
  const token = rest.join(" ").trim();
  return token.length > 0 ? token : null;
}

export function getWalletSessionTokenFromRequest(request: Request): string | null {
  const bearerToken = tokenFromAuthorizationHeader(request.headers.get("authorization"));
  if (bearerToken) {
    return bearerToken;
  }
  const cookieToken = getWalletSessionFromCookieHeader(request.headers.get("cookie"))?.token?.trim();
  return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}

export function getWalletSessionFromDocumentCookie(): WalletSession | null {
  if (typeof document === "undefined") {
    return null;
  }

  return getWalletSessionFromCookieHeader(document.cookie);
}

export function writeWalletSessionCookie(session: WalletSession, maxAgeSeconds = DEFAULT_MAX_AGE_SECONDS) {
  if (typeof document === "undefined") {
    return;
  }

  const serialized = serializeWalletSession(session);
  document.cookie = `${WALLET_SESSION_COOKIE}=${serialized}; Path=/; Max-Age=${maxAgeSeconds}; SameSite=Lax`;
}

export function clearWalletSessionCookie() {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${WALLET_SESSION_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`;
}
