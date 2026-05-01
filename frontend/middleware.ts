import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { sanitizeNextPath } from "@/lib/web3/auth";
import {
  WALLET_SESSION_COOKIE,
  getWalletSessionToken,
  parseWalletSession,
  validateWalletSession,
} from "@/lib/web3/session";

const protectedPaths = [
  "/dashboard",
  "/assets",
  "/investors",
  "/transfers",
  "/disclosures",
  "/audit",
  "/compliance",
  "/compliance/passports",
  "/reports",
  "/settings",
];

function isProtectedPath(pathname: string): boolean {
  return protectedPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function getBackendBaseUrl(): string | null {
  const base =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  if (!base) {
    return null;
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
}

async function verifySessionWithBackend(token: string): Promise<boolean> {
  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return false;
  }

  try {
    const response = await fetch(`${backendBaseUrl}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    return response.ok;
  } catch {
    return false;
  }
}

function buildLoginRedirectUrl(request: NextRequest): URL {
  const target = sanitizeNextPath(`${request.nextUrl.pathname}${request.nextUrl.search}`);
  return new URL(`/login?next=${encodeURIComponent(target)}`, request.url);
}

function withClearedSessionCookie(response: NextResponse): NextResponse {
  response.cookies.delete(WALLET_SESSION_COOKIE);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get(WALLET_SESSION_COOKIE)?.value ?? null;
  const session = parseWalletSession(sessionCookie);
  const hasValidSession = validateWalletSession(session);
  const isProtected = isProtectedPath(pathname);

  if (!hasValidSession && sessionCookie) {
    if (isProtected) {
      return withClearedSessionCookie(NextResponse.redirect(buildLoginRedirectUrl(request)));
    }

    return withClearedSessionCookie(NextResponse.next());
  }

  if (hasValidSession) {
    const token = getWalletSessionToken(session);
    const hasVerifiedSession = token ? await verifySessionWithBackend(token) : false;
    if (!hasVerifiedSession) {
      if (isProtected || pathname === "/login") {
        return withClearedSessionCookie(NextResponse.redirect(buildLoginRedirectUrl(request)));
      }
      return withClearedSessionCookie(NextResponse.next());
    }

    if (pathname === "/login") {
      const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
      return NextResponse.redirect(new URL(nextPath, request.url));
    }
  }

  if (isProtected && !hasValidSession) {
    const target = sanitizeNextPath(`${pathname}${search}`);
    const loginUrl = new URL(`/login?next=${encodeURIComponent(target)}`, request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/login",
    "/dashboard/:path*",
    "/assets/:path*",
    "/investors/:path*",
    "/transfers/:path*",
    "/disclosures/:path*",
    "/audit/:path*",
    "/compliance/:path*",
    "/reports/:path*",
    "/settings/:path*",
  ],
};
