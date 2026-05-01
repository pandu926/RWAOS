import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type CreateAssetRequest = {
  name: string;
  asset_type: string;
  metadata_uri?: string;
  issuance_wallet?: string;
  initial_supply?: number;
  anchor_hash?: string;
  anchor_tx_hash?: string;
  issuance_tx_hash?: string;
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

  const metadataUri = typeof payload.metadata_uri === "string" ? payload.metadata_uri.trim() : "";
  const issuanceWallet = typeof payload.issuance_wallet === "string" ? payload.issuance_wallet.trim() : "";
  const initialSupply =
    typeof payload.initial_supply === "number" && Number.isInteger(payload.initial_supply) && payload.initial_supply > 0
      ? payload.initial_supply
      : undefined;
  const anchorHash = typeof payload.anchor_hash === "string" ? payload.anchor_hash.trim() : "";
  const anchorTxHash = typeof payload.anchor_tx_hash === "string" ? payload.anchor_tx_hash.trim() : "";
  const issuanceTxHash = typeof payload.issuance_tx_hash === "string" ? payload.issuance_tx_hash.trim() : "";

  const token = getWalletSessionTokenFromRequest(request);
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
        ...(metadataUri ? { metadata_uri: metadataUri } : {}),
        ...(issuanceWallet ? { issuance_wallet: issuanceWallet } : {}),
        ...(initialSupply ? { initial_supply: initialSupply } : {}),
        ...(anchorHash ? { anchor_hash: anchorHash } : {}),
        ...(anchorTxHash ? { anchor_tx_hash: anchorTxHash } : {}),
        ...(issuanceTxHash ? { issuance_tx_hash: issuanceTxHash } : {}),
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
