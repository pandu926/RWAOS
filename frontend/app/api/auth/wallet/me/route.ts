import { NextResponse } from "next/server";

import { WALLET_SESSION_COOKIE, getWalletSessionFromCookieHeader } from "@/lib/web3/session";

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

function toProxyResponse(response: Response, responseBody: string): NextResponse {
  const headers = new Headers(response.headers);
  if (!headers.get("content-type")) {
    headers.set("content-type", "application/json");
  }
  headers.set("cache-control", "no-store");
  return new NextResponse(responseBody, {
    status: response.status,
    headers,
  });
}

function readTokenFromCookieHeader(cookieHeader: string | null): string | null {
  const strictToken = getWalletSessionFromCookieHeader(cookieHeader)?.token?.trim();
  if (strictToken) {
    return strictToken;
  }
  if (!cookieHeader) {
    return null;
  }

  const segments = cookieHeader.split(";").map((segment) => segment.trim());
  const targetCookie = segments.find((segment) => segment.startsWith(`${WALLET_SESSION_COOKIE}=`));
  if (!targetCookie) {
    return null;
  }

  const rawValue = targetCookie.slice(WALLET_SESSION_COOKIE.length + 1);
  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as { token?: unknown };
    const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
    return token || null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const token = readTokenFromCookieHeader(request.headers.get("cookie"));
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

  try {
    const response = await fetch(`${backendBaseUrl}/auth/me`, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const responseBody = await response.text();
    return toProxyResponse(response, responseBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend auth me endpoint." },
      { status: 502 },
    );
  }
}
