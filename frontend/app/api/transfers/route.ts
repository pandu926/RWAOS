import { NextResponse } from "next/server";

import { getWalletSessionFromCookieHeader } from "@/lib/web3/session";

type CreateTransferRequest = {
  asset_id: number;
  from_investor_id: number;
  to_investor_id: number;
  amount: number;
  tx_hash?: string;
  recipient_wallet_address?: string;
  disclosure_data_id?: string;
  reference_note?: string;
};

function parseCreateTransferRequest(input: unknown): CreateTransferRequest {
  const body = (input ?? {}) as Record<string, unknown>;
  const assetId = Number(body.asset_id);
  const fromInvestorId = Number(body.from_investor_id);
  const toInvestorId = Number(body.to_investor_id);
  const amount = Number(body.amount);
  const txHashValue = typeof body.tx_hash === "string" ? body.tx_hash.trim() : "";
  const recipientWalletAddress =
    typeof body.recipient_wallet_address === "string" ? body.recipient_wallet_address.trim() : "";
  const disclosureDataId = typeof body.disclosure_data_id === "string" ? body.disclosure_data_id.trim() : "";
  const referenceNote = typeof body.reference_note === "string" ? body.reference_note.trim() : "";

  if (!Number.isInteger(assetId) || assetId <= 0) {
    throw new Error("`asset_id` must be a positive integer.");
  }
  if (!Number.isInteger(fromInvestorId) || fromInvestorId <= 0) {
    throw new Error("`from_investor_id` must be a positive integer.");
  }
  if (!Number.isInteger(toInvestorId) || toInvestorId <= 0) {
    throw new Error("`to_investor_id` must be a positive integer.");
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("`amount` must be a positive number.");
  }
  if (txHashValue && !/^0x[a-fA-F0-9]{64}$/.test(txHashValue)) {
    throw new Error("`tx_hash` must be a valid transaction hash.");
  }
  if (recipientWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(recipientWalletAddress)) {
    throw new Error("`recipient_wallet_address` must be a valid EVM address.");
  }
  if (disclosureDataId && !/^0x[a-fA-F0-9]{64}$/.test(disclosureDataId)) {
    throw new Error("`disclosure_data_id` must be a bytes32 hex value.");
  }
  if (referenceNote.length > 500) {
    throw new Error("`reference_note` must be 500 characters or fewer.");
  }

  return {
    asset_id: assetId,
    from_investor_id: fromInvestorId,
    to_investor_id: toInvestorId,
    amount,
    ...(txHashValue ? { tx_hash: txHashValue } : {}),
    ...(recipientWalletAddress ? { recipient_wallet_address: recipientWalletAddress.toLowerCase() } : {}),
    ...(disclosureDataId ? { disclosure_data_id: disclosureDataId } : {}),
    ...(referenceNote ? { reference_note: referenceNote } : {}),
  };
}

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
  let payload: CreateTransferRequest;
  try {
    payload = parseCreateTransferRequest(await request.json());
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Invalid transfer payload. Expected numeric `asset_id`, `from_investor_id`, `to_investor_id`, and `amount`.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const cookie = request.headers.get("cookie");
  const token = getWalletSessionFromCookieHeader(cookie)?.token;

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
    const response = await fetch(`${backendBaseUrl}/transfers`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(cookie ? { cookie } : {}),
      },
      body: JSON.stringify({
        asset_id: payload.asset_id,
        from_investor_id: payload.from_investor_id,
        to_investor_id: payload.to_investor_id,
        amount: payload.amount,
        ...(payload.tx_hash ? { tx_hash: payload.tx_hash } : {}),
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
      { success: false, error: "Failed to reach backend transfer endpoint." },
      { status: 502 },
    );
  }
}
