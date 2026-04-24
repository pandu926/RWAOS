import { NextResponse } from "next/server";

type WalletLoginRequest = {
  address: string;
  chain_id: number;
  signature: string;
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
  let payload: WalletLoginRequest;
  try {
    payload = (await request.json()) as WalletLoginRequest;
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/auth/wallet/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend wallet login endpoint." },
      { status: 502 },
    );
  }
}
