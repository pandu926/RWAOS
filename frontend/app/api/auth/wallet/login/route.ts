import { NextResponse } from "next/server";

type WalletLoginRequest = {
  address: string;
  chain_id: number;
  signature: string;
};

const TARGET_CHAIN_ID = 421614;

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

function isValidEvmAddress(value: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function isLikelyWalletSignature(value: string): boolean {
  return /^0x[a-fA-F0-9]{130}$/.test(value.trim());
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

function parseWalletLoginRequest(input: unknown): WalletLoginRequest {
  const body = (input ?? {}) as Record<string, unknown>;
  const address = typeof body.address === "string" ? body.address.trim().toLowerCase() : "";
  const chainIdInput = body.chain_id ?? body.chainId;
  const chainId = Number(chainIdInput);
  const signature = typeof body.signature === "string" ? body.signature.trim() : "";

  if (!isValidEvmAddress(address)) {
    throw new Error("`address` must be a valid EVM address.");
  }
  if (!Number.isInteger(chainId) || chainId <= 0) {
    throw new Error("`chain_id` must be a positive integer.");
  }
  if (chainId !== TARGET_CHAIN_ID) {
    throw new Error("`chain_id` must be Arbitrum Sepolia (421614).");
  }
  if (!isLikelyWalletSignature(signature)) {
    throw new Error("`signature` must be a valid 65-byte hex signature.");
  }

  return { address, chain_id: chainId, signature };
}

export async function POST(request: Request) {
  let payload: WalletLoginRequest;
  try {
    payload = parseWalletLoginRequest(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body.";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
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
    const response = await fetch(`${backendBaseUrl}/auth/wallet/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });
    const responseBody = await response.text();
    return toProxyResponse(response, responseBody);
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend wallet login endpoint." },
      { status: 502 },
    );
  }
}
