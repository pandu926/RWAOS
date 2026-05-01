import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type CreateTransferRequest = {
  asset_id: number;
  from_investor_id: number;
  to_investor_id: number;
  amount: number;
  tx_hash?: string;
  tx_status?: "pending" | "confirmed" | "reverted" | "failed";
  sender_wallet_address?: string;
  recipient_wallet_address?: string;
  disclosure_data_id?: string;
  reference_note?: string;
  onchain_metadata?: {
    chain_id?: number;
    tx_hash?: string;
    tx_status?: "pending" | "confirmed" | "reverted" | "failed";
    sender_wallet_address?: string;
    recipient_wallet_address?: string;
    disclosure_data_id?: string;
    disclosure_registry_address?: string;
    transfer_controller_address?: string;
    token_address?: string;
    encrypted_amount?: string;
    input_proof?: string;
    reference_note?: string;
  };
};
type TransferTxStatus = NonNullable<CreateTransferRequest["tx_status"]>;

const TRANSFER_STATUS_VALUES = new Set(["pending", "confirmed", "reverted", "failed"]);

function parseCreateTransferRequest(input: unknown): CreateTransferRequest {
  const body = (input ?? {}) as Record<string, unknown>;
  const assetId = Number(body.asset_id);
  const fromInvestorId = Number(body.from_investor_id);
  const toInvestorId = Number(body.to_investor_id);
  const amount = Number(body.amount);
  const txHashValue = typeof body.tx_hash === "string" ? body.tx_hash.trim() : "";
  const txStatusValue = typeof body.tx_status === "string" ? body.tx_status.trim().toLowerCase() : "";
  const senderWalletAddress =
    typeof body.sender_wallet_address === "string" ? body.sender_wallet_address.trim() : "";
  const recipientWalletAddress =
    typeof body.recipient_wallet_address === "string" ? body.recipient_wallet_address.trim() : "";
  const disclosureDataId = typeof body.disclosure_data_id === "string" ? body.disclosure_data_id.trim() : "";
  const referenceNote = typeof body.reference_note === "string" ? body.reference_note.trim() : "";
  const onchainCandidate =
    body.onchain_metadata && typeof body.onchain_metadata === "object"
      ? (body.onchain_metadata as Record<string, unknown>)
      : null;
  const onchainChainId = Number(onchainCandidate?.chain_id);
  const onchainTxHash = typeof onchainCandidate?.tx_hash === "string" ? onchainCandidate.tx_hash.trim() : "";
  const onchainTxStatus =
    typeof onchainCandidate?.tx_status === "string" ? onchainCandidate.tx_status.trim().toLowerCase() : "";
  const onchainSenderWallet =
    typeof onchainCandidate?.sender_wallet_address === "string"
      ? onchainCandidate.sender_wallet_address.trim()
      : "";
  const onchainRecipientWallet =
    typeof onchainCandidate?.recipient_wallet_address === "string"
      ? onchainCandidate.recipient_wallet_address.trim()
      : "";
  const onchainDisclosureDataId =
    typeof onchainCandidate?.disclosure_data_id === "string"
      ? onchainCandidate.disclosure_data_id.trim()
      : "";
  const onchainDisclosureRegistry =
    typeof onchainCandidate?.disclosure_registry_address === "string"
      ? onchainCandidate.disclosure_registry_address.trim()
      : "";
  const onchainTransferController =
    typeof onchainCandidate?.transfer_controller_address === "string"
      ? onchainCandidate.transfer_controller_address.trim()
      : "";
  const onchainTokenAddress =
    typeof onchainCandidate?.token_address === "string"
      ? onchainCandidate.token_address.trim()
      : "";
  const onchainEncryptedAmount =
    typeof onchainCandidate?.encrypted_amount === "string" ? onchainCandidate.encrypted_amount.trim() : "";
  const onchainInputProof =
    typeof onchainCandidate?.input_proof === "string" ? onchainCandidate.input_proof.trim() : "";
  const onchainReferenceNote =
    typeof onchainCandidate?.reference_note === "string" ? onchainCandidate.reference_note.trim() : "";

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
  if (txStatusValue && !TRANSFER_STATUS_VALUES.has(txStatusValue)) {
    throw new Error("`tx_status` must be one of pending, confirmed, reverted, or failed.");
  }
  if (senderWalletAddress && !/^0x[a-fA-F0-9]{40}$/.test(senderWalletAddress)) {
    throw new Error("`sender_wallet_address` must be a valid EVM address.");
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
  if (onchainCandidate) {
    if (onchainCandidate.chain_id !== undefined && (!Number.isInteger(onchainChainId) || onchainChainId <= 0)) {
      throw new Error("`onchain_metadata.chain_id` must be a positive integer when provided.");
    }
    if (onchainTxHash && !/^0x[a-fA-F0-9]{64}$/.test(onchainTxHash)) {
      throw new Error("`onchain_metadata.tx_hash` must be a valid transaction hash.");
    }
    if (onchainTxStatus && !TRANSFER_STATUS_VALUES.has(onchainTxStatus)) {
      throw new Error(
        "`onchain_metadata.tx_status` must be one of pending, confirmed, reverted, or failed.",
      );
    }
    if (onchainSenderWallet && !/^0x[a-fA-F0-9]{40}$/.test(onchainSenderWallet)) {
      throw new Error("`onchain_metadata.sender_wallet_address` must be a valid EVM address.");
    }
    if (onchainRecipientWallet && !/^0x[a-fA-F0-9]{40}$/.test(onchainRecipientWallet)) {
      throw new Error("`onchain_metadata.recipient_wallet_address` must be a valid EVM address.");
    }
    if (onchainDisclosureDataId && !/^0x[a-fA-F0-9]{64}$/.test(onchainDisclosureDataId)) {
      throw new Error("`onchain_metadata.disclosure_data_id` must be a bytes32 hex value.");
    }
    if (onchainDisclosureRegistry && !/^0x[a-fA-F0-9]{40}$/.test(onchainDisclosureRegistry)) {
      throw new Error("`onchain_metadata.disclosure_registry_address` must be a valid EVM address.");
    }
    if (onchainTransferController && !/^0x[a-fA-F0-9]{40}$/.test(onchainTransferController)) {
      throw new Error("`onchain_metadata.transfer_controller_address` must be a valid EVM address.");
    }
    if (onchainTokenAddress && !/^0x[a-fA-F0-9]{40}$/.test(onchainTokenAddress)) {
      throw new Error("`onchain_metadata.token_address` must be a valid EVM address.");
    }
    if (onchainEncryptedAmount && !/^0x[a-fA-F0-9]{64}$/.test(onchainEncryptedAmount)) {
      throw new Error("`onchain_metadata.encrypted_amount` must be a bytes32 hex value.");
    }
    if (onchainInputProof && !/^0x[a-fA-F0-9]*$/.test(onchainInputProof)) {
      throw new Error("`onchain_metadata.input_proof` must be a valid hex string.");
    }
    if (onchainReferenceNote.length > 500) {
      throw new Error("`onchain_metadata.reference_note` must be 500 characters or fewer.");
    }
  }

  return {
    asset_id: assetId,
    from_investor_id: fromInvestorId,
    to_investor_id: toInvestorId,
    amount,
    ...(txHashValue ? { tx_hash: txHashValue } : {}),
    ...(txStatusValue ? { tx_status: txStatusValue as CreateTransferRequest["tx_status"] } : {}),
    ...(senderWalletAddress ? { sender_wallet_address: senderWalletAddress.toLowerCase() } : {}),
    ...(recipientWalletAddress ? { recipient_wallet_address: recipientWalletAddress.toLowerCase() } : {}),
    ...(disclosureDataId ? { disclosure_data_id: disclosureDataId } : {}),
    ...(referenceNote ? { reference_note: referenceNote } : {}),
    ...(onchainCandidate
      ? {
          onchain_metadata: {
            ...(Number.isInteger(onchainChainId) && onchainChainId > 0 ? { chain_id: onchainChainId } : {}),
            ...(onchainTxHash ? { tx_hash: onchainTxHash } : {}),
            ...(onchainTxStatus
              ? { tx_status: onchainTxStatus as TransferTxStatus }
              : {}),
            ...(onchainSenderWallet ? { sender_wallet_address: onchainSenderWallet.toLowerCase() } : {}),
            ...(onchainRecipientWallet ? { recipient_wallet_address: onchainRecipientWallet.toLowerCase() } : {}),
            ...(onchainDisclosureDataId ? { disclosure_data_id: onchainDisclosureDataId } : {}),
            ...(onchainDisclosureRegistry
              ? { disclosure_registry_address: onchainDisclosureRegistry.toLowerCase() }
              : {}),
            ...(onchainTransferController
              ? { transfer_controller_address: onchainTransferController.toLowerCase() }
              : {}),
            ...(onchainTokenAddress ? { token_address: onchainTokenAddress.toLowerCase() } : {}),
            ...(onchainEncryptedAmount ? { encrypted_amount: onchainEncryptedAmount } : {}),
            ...(onchainInputProof ? { input_proof: onchainInputProof } : {}),
            ...(onchainReferenceNote ? { reference_note: onchainReferenceNote } : {}),
          },
        }
      : {}),
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
  const token = getWalletSessionTokenFromRequest(request);

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
        ...(payload.tx_status ? { status: payload.tx_status === "failed" ? "reverted" : payload.tx_status } : {}),
        ...(payload.tx_status === "reverted" || payload.tx_status === "failed"
          ? { failure_reason: "Transfer reverted on-chain." }
          : {}),
        ...(payload.sender_wallet_address ? { sender_wallet_address: payload.sender_wallet_address } : {}),
        ...(payload.recipient_wallet_address ? { recipient_wallet_address: payload.recipient_wallet_address } : {}),
        ...(payload.disclosure_data_id ? { disclosure_data_id: payload.disclosure_data_id } : {}),
        ...(payload.reference_note ? { reference_note: payload.reference_note } : {}),
        ...((payload.onchain_metadata || payload.reference_note)
          ? {
              onchain_metadata: {
                ...(payload.onchain_metadata ?? {}),
                ...(payload.reference_note ? { reference_note: payload.reference_note } : {}),
              },
            }
          : {}),
      }),
      cache: "no-store",
    });
    const responseText = await response.text();
    const contentType = response.headers.get("content-type") || "application/json";

    let parsed: unknown = null;
    if (contentType.includes("application/json")) {
      try {
        parsed = JSON.parse(responseText) as unknown;
      } catch {
        parsed = null;
      }
    }

    if (parsed && typeof parsed === "object") {
      const envelope = parsed as {
        success?: boolean;
        error?: string | null;
        data?: Record<string, unknown> | null;
      };
      const data = envelope.data ?? {};
      const transferStatus =
        typeof data.tx_status === "string"
          ? data.tx_status.toLowerCase()
          : typeof data.status === "string"
            ? data.status.toLowerCase()
            : payload.tx_status ?? null;
      const isReverted = transferStatus === "reverted" || transferStatus === "failed";

      if (isReverted) {
        return NextResponse.json(
          {
            success: false,
            error:
              envelope.error ??
              "Transfer transaction reverted on-chain. Backend record was not marked as confirmed.",
            data: {
              ...data,
              tx_status: transferStatus,
              ...(payload.tx_hash ? { tx_hash: payload.tx_hash } : {}),
            },
          },
          { status: 409 },
        );
      }

      return NextResponse.json(
        {
          ...envelope,
          ...(envelope.success
            ? {
                data: {
                  ...data,
                  ...(payload.tx_status ? { tx_status: payload.tx_status } : {}),
                  ...(payload.sender_wallet_address
                    ? { sender_wallet_address: payload.sender_wallet_address }
                    : {}),
                  ...(payload.recipient_wallet_address
                    ? { recipient_wallet_address: payload.recipient_wallet_address }
                    : {}),
                  ...(payload.disclosure_data_id ? { disclosure_data_id: payload.disclosure_data_id } : {}),
                  ...(payload.reference_note ? { reference_note: payload.reference_note } : {}),
                  ...(payload.onchain_metadata ? { onchain_metadata: payload.onchain_metadata } : {}),
                },
              }
            : {}),
        },
        { status: response.status },
      );
    }

    return new NextResponse(responseText, {
      status: response.status,
      headers: { "content-type": contentType },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to reach backend transfer endpoint." },
      { status: 502 },
    );
  }
}
