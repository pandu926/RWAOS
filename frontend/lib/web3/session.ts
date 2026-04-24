export const WALLET_SESSION_COOKIE = "rwaos_wallet_session";
const DEFAULT_MAX_AGE_SECONDS = 60 * 60 * 24;

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
  const configured = process.env.NEXT_PUBLIC_ALLOWED_WALLETS?.trim() ?? "";
  if (!configured) {
    return true;
  }

  const allowlist = configured
    .split(",")
    .map((item) => normalizeAddress(item))
    .filter(Boolean);

  return allowlist.includes(normalizeAddress(address));
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
    if (!isLikelyEvmAddress(parsed.address) || !Number.isFinite(parsed.chainId)) {
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
