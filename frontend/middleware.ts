import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

import { WALLET_SESSION_COOKIE, parseWalletSession } from "@/lib/web3/session";

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

export function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const sessionCookie = request.cookies.get(WALLET_SESSION_COOKIE)?.value ?? null;
  const session = parseWalletSession(sessionCookie);

  if (pathname === "/login" && session) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (isProtectedPath(pathname) && !session) {
    const target = `${pathname}${search}`;
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
