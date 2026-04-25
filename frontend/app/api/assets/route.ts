import { NextResponse } from "next/server";

import { getWalletSessionFromCookieHeader } from "@/lib/web3/session";

type CreateAssetRequest = {
  name: string;
  asset_type: string;
};

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

export async function POST(request: Request) {
  let payload: CreateAssetRequest;
  try {
    payload = (await request.json()) as CreateAssetRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  if (!payload.name?.trim() || !payload.asset_type?.trim()) {
    return NextResponse.json(
      { success: false, error: "`name` and `asset_type` are required." },
      { status: 400 },
    );
  }

  const token = getWalletSessionFromCookieHeader(request.headers.get("cookie"))?.token;
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing wallet session token. Please reconnect wallet." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/assets`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        name: payload.name.trim(),
        asset_type: payload.asset_type.trim(),
      }),
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend assets endpoint." },
      { status: 502 },
    );
  }
}
