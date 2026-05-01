import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type CreatePassportRequest = {
  transfer_record_id: number;
  transfer_id_onchain?: string;
  disclosure_scope: string[];
  policy_hash: string;
  disclosure_data_id: string;
  anchor_hash: string;
  transfer_tx_hash: string;
  anchor_tx_hash: string;
  reason: string;
  onchain_metadata?: {
    chain_id?: number;
    transfer_id_onchain?: string;
    transfer_tx_hash?: string;
    anchor_tx_hash?: string;
    policy_hash?: string;
    disclosure_data_id?: string;
    anchor_hash?: string;
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

function isBytes32(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isTxHash(value: string): boolean {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function parseCreatePassportRequest(input: unknown): CreatePassportRequest {
  const body = (input ?? {}) as Record<string, unknown>;
  const transferRecordId = Number(body.transfer_record_id);
  const transferIdOnchain =
    typeof body.transfer_id_onchain === "string" ? body.transfer_id_onchain.trim() : "";
  const disclosureScope = Array.isArray(body.disclosure_scope)
    ? body.disclosure_scope.map((value) => String(value ?? "").trim()).filter(Boolean)
    : [];
  const policyHash = typeof body.policy_hash === "string" ? body.policy_hash.trim() : "";
  const disclosureDataId = typeof body.disclosure_data_id === "string" ? body.disclosure_data_id.trim() : "";
  const anchorHash = typeof body.anchor_hash === "string" ? body.anchor_hash.trim() : "";
  const transferTxHash = typeof body.transfer_tx_hash === "string" ? body.transfer_tx_hash.trim() : "";
  const anchorTxHash = typeof body.anchor_tx_hash === "string" ? body.anchor_tx_hash.trim() : "";
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  const onchainCandidate =
    body.onchain_metadata && typeof body.onchain_metadata === "object"
      ? (body.onchain_metadata as Record<string, unknown>)
      : null;
  const onchainChainId = Number(onchainCandidate?.chain_id);
  const onchainTransferId =
    typeof onchainCandidate?.transfer_id_onchain === "string"
      ? onchainCandidate.transfer_id_onchain.trim()
      : "";
  const onchainTransferTxHash =
    typeof onchainCandidate?.transfer_tx_hash === "string" ? onchainCandidate.transfer_tx_hash.trim() : "";
  const onchainAnchorTxHash =
    typeof onchainCandidate?.anchor_tx_hash === "string" ? onchainCandidate.anchor_tx_hash.trim() : "";
  const onchainPolicyHash =
    typeof onchainCandidate?.policy_hash === "string" ? onchainCandidate.policy_hash.trim() : "";
  const onchainDisclosureDataId =
    typeof onchainCandidate?.disclosure_data_id === "string" ? onchainCandidate.disclosure_data_id.trim() : "";
  const onchainAnchorHash =
    typeof onchainCandidate?.anchor_hash === "string" ? onchainCandidate.anchor_hash.trim() : "";

  if (!Number.isInteger(transferRecordId) || transferRecordId <= 0) {
    throw new Error("`transfer_record_id` must be a positive integer.");
  }
  if (body.transfer_id_onchain !== undefined && transferIdOnchain && !isBytes32(transferIdOnchain)) {
    throw new Error("`transfer_id_onchain` must be a bytes32 hex value when provided.");
  }
  if (!disclosureScope.length) {
    throw new Error("`disclosure_scope` must have at least one value.");
  }
  if (!policyHash || !isBytes32(policyHash)) {
    throw new Error("`policy_hash` must be a bytes32 hex value.");
  }
  if (!disclosureDataId || !isBytes32(disclosureDataId)) {
    throw new Error("`disclosure_data_id` must be a bytes32 hex value.");
  }
  if (!anchorHash || !isBytes32(anchorHash)) {
    throw new Error("`anchor_hash` must be a bytes32 hex value.");
  }
  if (!transferTxHash || !isTxHash(transferTxHash)) {
    throw new Error("`transfer_tx_hash` must be a valid transaction hash.");
  }
  if (!anchorTxHash || !isTxHash(anchorTxHash)) {
    throw new Error("`anchor_tx_hash` must be a valid transaction hash.");
  }
  if (!reason) {
    throw new Error("`reason` is required.");
  }
  if (onchainCandidate) {
    if (onchainCandidate.chain_id !== undefined && (!Number.isInteger(onchainChainId) || onchainChainId <= 0)) {
      throw new Error("`onchain_metadata.chain_id` must be a positive integer when provided.");
    }
    if (onchainTransferId && !isBytes32(onchainTransferId)) {
      throw new Error("`onchain_metadata.transfer_id_onchain` must be a bytes32 hex value when provided.");
    }
    if (onchainTransferTxHash && !isTxHash(onchainTransferTxHash)) {
      throw new Error("`onchain_metadata.transfer_tx_hash` must be a valid transaction hash when provided.");
    }
    if (onchainAnchorTxHash && !isTxHash(onchainAnchorTxHash)) {
      throw new Error("`onchain_metadata.anchor_tx_hash` must be a valid transaction hash when provided.");
    }
    if (onchainPolicyHash && !isBytes32(onchainPolicyHash)) {
      throw new Error("`onchain_metadata.policy_hash` must be a bytes32 hex value when provided.");
    }
    if (onchainDisclosureDataId && !isBytes32(onchainDisclosureDataId)) {
      throw new Error("`onchain_metadata.disclosure_data_id` must be a bytes32 hex value when provided.");
    }
    if (onchainAnchorHash && !isBytes32(onchainAnchorHash)) {
      throw new Error("`onchain_metadata.anchor_hash` must be a bytes32 hex value when provided.");
    }
  }

  return {
    transfer_record_id: transferRecordId,
    ...(transferIdOnchain ? { transfer_id_onchain: transferIdOnchain } : {}),
    disclosure_scope: disclosureScope,
    policy_hash: policyHash,
    disclosure_data_id: disclosureDataId,
    anchor_hash: anchorHash,
    transfer_tx_hash: transferTxHash,
    anchor_tx_hash: anchorTxHash,
    reason,
    ...(onchainCandidate
      ? {
          onchain_metadata: {
            ...(Number.isInteger(onchainChainId) && onchainChainId > 0 ? { chain_id: onchainChainId } : {}),
            ...(onchainTransferId ? { transfer_id_onchain: onchainTransferId } : {}),
            ...(onchainTransferTxHash ? { transfer_tx_hash: onchainTransferTxHash } : {}),
            ...(onchainAnchorTxHash ? { anchor_tx_hash: onchainAnchorTxHash } : {}),
            ...(onchainPolicyHash ? { policy_hash: onchainPolicyHash } : {}),
            ...(onchainDisclosureDataId ? { disclosure_data_id: onchainDisclosureDataId } : {}),
            ...(onchainAnchorHash ? { anchor_hash: onchainAnchorHash } : {}),
          },
        }
      : {}),
  };
}

export async function POST(request: Request) {
  let payload: CreatePassportRequest;
  try {
    payload = parseCreatePassportRequest(await request.json());
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
    const response = await fetch(`${getBackendBaseUrl()}/compliance/passports`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        transfer_record_id: payload.transfer_record_id,
        transfer_id_onchain: payload.transfer_id_onchain,
        disclosure_scope: payload.disclosure_scope,
        policy_hash: payload.policy_hash,
        disclosure_data_id: payload.disclosure_data_id,
        anchor_hash: payload.anchor_hash,
        transfer_tx_hash: payload.transfer_tx_hash,
        anchor_tx_hash: payload.anchor_tx_hash,
        reason: payload.reason,
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
      { success: false, error: "Failed to reach backend compliance passports endpoint." },
      { status: 502 },
    );
  }
}
