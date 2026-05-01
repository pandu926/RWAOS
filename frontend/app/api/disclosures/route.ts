import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type CreateDisclosureRequest = {
  asset_id: number;
  title: string;
  content: string;
  grantee_investor_id?: number;
  grantee_wallet_address?: string;
  disclosure_data_id?: string;
  expires_at_unix?: number;
  grant_tx_hash?: string;
  onchain_metadata?: {
    chain_id?: number;
    disclosure_registry_address?: string;
    disclosure_data_id?: string;
    grantee_wallet_address?: string;
    expires_at_unix?: number;
    grant_tx_hash?: string;
  };
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

export async function GET(request: Request) {
  const token = getWalletSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing wallet session token. Please reconnect wallet." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/disclosures`, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      cache: "no-store",
    });
    const body = await response.text();
    return new NextResponse(body, {
      status: response.status,
      headers: { "content-type": "application/json" },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend disclosures endpoint." },
      { status: 502 },
    );
  }
}

function parseCreateDisclosureRequest(input: unknown): CreateDisclosureRequest {
  const body = (input ?? {}) as Record<string, unknown>;
  const assetId = Number(body.asset_id);
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const content = typeof body.content === "string" ? body.content.trim() : "";
  const granteeInvestorId = Number(body.grantee_investor_id);
  const granteeWalletAddress =
    typeof body.grantee_wallet_address === "string" ? body.grantee_wallet_address.trim() : "";
  const disclosureDataId = typeof body.disclosure_data_id === "string" ? body.disclosure_data_id.trim() : "";
  const expiresAtUnix = Number(body.expires_at_unix);
  const grantTxHash = typeof body.grant_tx_hash === "string" ? body.grant_tx_hash.trim() : "";
  const onchainCandidate =
    body.onchain_metadata && typeof body.onchain_metadata === "object"
      ? (body.onchain_metadata as Record<string, unknown>)
      : null;
  const onchainChainId = Number(onchainCandidate?.chain_id);
  const onchainRegistryAddress =
    typeof onchainCandidate?.disclosure_registry_address === "string"
      ? onchainCandidate.disclosure_registry_address.trim()
      : "";
  const onchainDataId =
    typeof onchainCandidate?.disclosure_data_id === "string" ? onchainCandidate.disclosure_data_id.trim() : "";
  const onchainGrantee =
    typeof onchainCandidate?.grantee_wallet_address === "string"
      ? onchainCandidate.grantee_wallet_address.trim()
      : "";
  const onchainExpiresAtUnix = Number(onchainCandidate?.expires_at_unix);
  const onchainGrantTxHash =
    typeof onchainCandidate?.grant_tx_hash === "string" ? onchainCandidate.grant_tx_hash.trim() : "";

  if (!Number.isInteger(assetId) || assetId <= 0) {
    throw new Error("`asset_id` must be a positive integer.");
  }
  if (!title || !content) {
    throw new Error("`title` and `content` are required.");
  }
  if (body.grantee_investor_id !== undefined && (!Number.isInteger(granteeInvestorId) || granteeInvestorId <= 0)) {
    throw new Error("`grantee_investor_id` must be a positive integer when provided.");
  }
  if (granteeWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(granteeWalletAddress)) {
    throw new Error("`grantee_wallet_address` must be a valid EVM address.");
  }
  if (disclosureDataId && !/^0x[a-fA-F0-9]{64}$/.test(disclosureDataId)) {
    throw new Error("`disclosure_data_id` must be a bytes32 hex value.");
  }
  if (body.expires_at_unix !== undefined && (!Number.isInteger(expiresAtUnix) || expiresAtUnix <= 0)) {
    throw new Error("`expires_at_unix` must be a positive UNIX timestamp when provided.");
  }
  if (grantTxHash && !/^0x[a-fA-F0-9]{64}$/.test(grantTxHash)) {
    throw new Error("`grant_tx_hash` must be a valid transaction hash.");
  }
  if ((disclosureDataId || grantTxHash || body.expires_at_unix !== undefined) && !granteeWalletAddress) {
    throw new Error("`grantee_wallet_address` is required when submitting on-chain disclosure grant metadata.");
  }
  if (onchainCandidate) {
    if (onchainCandidate.chain_id !== undefined && (!Number.isInteger(onchainChainId) || onchainChainId <= 0)) {
      throw new Error("`onchain_metadata.chain_id` must be a positive integer when provided.");
    }
    if (onchainRegistryAddress && !/^0x[a-fA-F0-9]{40}$/.test(onchainRegistryAddress)) {
      throw new Error("`onchain_metadata.disclosure_registry_address` must be a valid EVM address.");
    }
    if (onchainDataId && !/^0x[a-fA-F0-9]{64}$/.test(onchainDataId)) {
      throw new Error("`onchain_metadata.disclosure_data_id` must be a bytes32 hex value.");
    }
    if (onchainGrantee && !/^0x[a-fA-F0-9]{40}$/.test(onchainGrantee)) {
      throw new Error("`onchain_metadata.grantee_wallet_address` must be a valid EVM address.");
    }
    if (
      onchainCandidate.expires_at_unix !== undefined &&
      (!Number.isInteger(onchainExpiresAtUnix) || onchainExpiresAtUnix <= 0)
    ) {
      throw new Error("`onchain_metadata.expires_at_unix` must be a positive UNIX timestamp when provided.");
    }
    if (onchainGrantTxHash && !/^0x[a-fA-F0-9]{64}$/.test(onchainGrantTxHash)) {
      throw new Error("`onchain_metadata.grant_tx_hash` must be a valid transaction hash.");
    }
  }

  return {
    asset_id: assetId,
    title,
    content,
    ...(Number.isInteger(granteeInvestorId) && granteeInvestorId > 0 ? { grantee_investor_id: granteeInvestorId } : {}),
    ...(granteeWalletAddress ? { grantee_wallet_address: granteeWalletAddress.toLowerCase() } : {}),
    ...(disclosureDataId ? { disclosure_data_id: disclosureDataId } : {}),
    ...(Number.isInteger(expiresAtUnix) && expiresAtUnix > 0 ? { expires_at_unix: expiresAtUnix } : {}),
    ...(grantTxHash ? { grant_tx_hash: grantTxHash } : {}),
    ...(onchainCandidate
      ? {
          onchain_metadata: {
            ...(Number.isInteger(onchainChainId) && onchainChainId > 0 ? { chain_id: onchainChainId } : {}),
            ...(onchainRegistryAddress
              ? { disclosure_registry_address: onchainRegistryAddress.toLowerCase() }
              : {}),
            ...(onchainDataId ? { disclosure_data_id: onchainDataId } : {}),
            ...(onchainGrantee ? { grantee_wallet_address: onchainGrantee.toLowerCase() } : {}),
            ...(Number.isInteger(onchainExpiresAtUnix) && onchainExpiresAtUnix > 0
              ? { expires_at_unix: onchainExpiresAtUnix }
              : {}),
            ...(onchainGrantTxHash ? { grant_tx_hash: onchainGrantTxHash } : {}),
          },
        }
      : {}),
  };
}

export async function POST(request: Request) {
  let payload: CreateDisclosureRequest;
  try {
    payload = parseCreateDisclosureRequest(await request.json());
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid JSON body.";
    return NextResponse.json({ success: false, error: message }, { status: 400 });
  }

  const token = getWalletSessionTokenFromRequest(request);
  if (!token) {
    return NextResponse.json(
      { success: false, error: "Missing wallet session token. Please reconnect wallet." },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(`${getBackendBaseUrl()}/disclosures`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        asset_id: payload.asset_id,
        title: payload.title,
        content: payload.content,
        data_id:
          payload.onchain_metadata?.disclosure_data_id ??
          payload.disclosure_data_id,
        grantee:
          payload.onchain_metadata?.grantee_wallet_address ??
          payload.grantee_wallet_address,
        expires_at:
          payload.onchain_metadata?.expires_at_unix ??
          payload.expires_at_unix,
        tx_hash:
          payload.onchain_metadata?.grant_tx_hash ??
          payload.grant_tx_hash,
        ...(payload.onchain_metadata ? { onchain_metadata: payload.onchain_metadata } : {}),
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
      { success: false, error: "Failed to reach backend disclosures endpoint." },
      { status: 502 },
    );
  }
}
