import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type CreateInvestorRequest = {
  legal_name: string;
  jurisdiction: string;
  wallet_address?: string | null;
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

function normalizeWalletAddress(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) {
    return null;
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(trimmed)) {
    throw new Error("`wallet_address` must be a valid EVM address in `0x...` format.");
  }
  return trimmed.toLowerCase();
}

export async function POST(request: Request) {
  let payload: CreateInvestorRequest;
  try {
    payload = (await request.json()) as CreateInvestorRequest;
  } catch {
    return NextResponse.json({ success: false, error: "Invalid JSON body." }, { status: 400 });
  }

  const legalName = payload.legal_name?.trim();
  const jurisdiction = payload.jurisdiction?.trim();
  let walletAddress: string | null = null;

  try {
    walletAddress = normalizeWalletAddress(payload.wallet_address);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid wallet address.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  if (!legalName || !jurisdiction) {
    return NextResponse.json(
      { success: false, error: "`legal_name` and `jurisdiction` are required." },
      { status: 400 },
    );
  }

  const token = getWalletSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing wallet session token. Please reconnect wallet." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/investors`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        legal_name: legalName,
        jurisdiction,
        ...(walletAddress ? { wallet_address: walletAddress } : {}),
      }),
      cache: "no-store",
    });

    const body = await response.text();
    if (!response.ok && walletAddress && body.toLowerCase().includes("wallet_address")) {
      return new NextResponse(
        JSON.stringify({
          success: false,
          error: "Backend rejected `wallet_address`. Deploy the investor wallet mapping backend change before retrying this form.",
        }),
        {
          status: response.status,
          headers: { "content-type": "application/json" },
        },
      );
    }

    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend investors endpoint." },
      { status: 502 },
    );
  }
}
