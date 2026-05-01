import { BaseError, ContractFunctionRevertedError } from "viem";

export type DecodedContractError = {
  code:
    | "DISCLOSURE_REQUIRED"
    | "OPERATOR_MISSING"
    | "ZERO_CONFIDENTIAL_BALANCE"
    | "ZERO_ACCOUNT"
    | "INVALID_PROOF"
    | "USE_TRANSFER_CONTROLLER"
    | "USER_REJECTED"
    | "INSUFFICIENT_FUNDS"
    | "CHAIN_MISMATCH"
    | "NONCE_OR_REPLAY"
    | "GAS_ESTIMATION_FAILED"
    | "NETWORK_ERROR"
    | "UNKNOWN";
  message: string;
  detail?: string;
  action?: string;
  rawMessage: string;
  retryable: boolean;
};

function extractRawMessage(error: unknown): string {
  if (error instanceof BaseError) {
    const revertError = error.walk(
      (candidate) => candidate instanceof ContractFunctionRevertedError,
    ) as ContractFunctionRevertedError | null;

    const parts = [
      revertError?.reason,
      revertError?.shortMessage,
      error.shortMessage,
      error.details,
      error.message,
    ].filter((value): value is string => Boolean(value && value.trim()));

    return parts.join(" | ");
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function decodeTransferControllerError(error: unknown): DecodedContractError {
  const rawMessage = extractRawMessage(error);

  const normalized = rawMessage.toLowerCase();

  if (normalized.includes("transfercontroller: disclosure required")) {
    return {
      code: "DISCLOSURE_REQUIRED",
      message: "Disclosure untuk caller belum aktif.",
      detail: "Kontrak transfer controller mensyaratkan caller memiliki disclosure grant yang aktif untuk `disclosureDataId` yang dipakai.",
      action: "Grant disclosure ke wallet caller sebelum submit transfer.",
      rawMessage,
      retryable: false,
    };
  }

  if (normalized.includes("transfercontroller: operator missing")) {
    return {
      code: "OPERATOR_MISSING",
      message: "Transfer controller belum menjadi operator untuk holder sumber.",
      detail: "Kontrak token mengecek `isOperator(from, transferController)` sebelum transfer rahasia dijalankan.",
      action: "Panggil `setOperator(transferController, until)` dari wallet holder sumber.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("rejected the request") ||
    normalized.includes("denied transaction signature") ||
    normalized.includes("request rejected")
  ) {
    return {
      code: "USER_REJECTED",
      message: "Transaksi dibatalkan dari wallet.",
      detail: "Wallet mengembalikan penolakan tanda tangan/transaksi oleh user.",
      action: "Ulangi dan approve transaksi pada wallet.",
      rawMessage,
      retryable: true,
    };
  }

  if (
    normalized.includes("insufficient funds") ||
    normalized.includes("intrinsic gas too low")
  ) {
    return {
      code: "INSUFFICIENT_FUNDS",
      message: "Saldo native token tidak cukup untuk gas.",
      detail: "Wallet tidak memiliki cukup ETH pada network aktif untuk mengeksekusi transaksi.",
      action: "Isi saldo wallet untuk gas lalu submit ulang.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("chain mismatch") ||
    normalized.includes("wrong chain") ||
    normalized.includes("chain id") && normalized.includes("expected")
  ) {
    return {
      code: "CHAIN_MISMATCH",
      message: "Wallet berada di chain yang salah untuk transaksi ini.",
      detail: "Chain wallet tidak cocok dengan chain kontrak transfer confidential.",
      action: "Switch wallet ke Arbitrum Sepolia lalu ulangi.",
      rawMessage,
      retryable: true,
    };
  }

  if (
    normalized.includes("nonce too low") ||
    normalized.includes("already known") ||
    normalized.includes("replacement transaction underpriced")
  ) {
    return {
      code: "NONCE_OR_REPLAY",
      message: "Transaksi bentrok dengan nonce wallet saat ini.",
      detail: "Node RPC menolak transaksi karena nonce/replay atau replacement fee yang tidak memadai.",
      action: "Refresh wallet nonce (atau tunggu tx pending selesai) lalu kirim ulang.",
      rawMessage,
      retryable: true,
    };
  }

  if (
    normalized.includes("failed to estimate gas") ||
    normalized.includes("cannot estimate gas") ||
    normalized.includes("gas required exceeds allowance")
  ) {
    return {
      code: "GAS_ESTIMATION_FAILED",
      message: "Estimasi gas gagal karena call akan revert dengan input saat ini.",
      detail: "Biasanya terjadi ketika salah satu precondition kontrak belum terpenuhi.",
      action: "Periksa disclosure/operator/proof lalu submit ulang.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("erc7984zerobalance") ||
    normalized.includes("0x5ff91cdc")
  ) {
    return {
      code: "ZERO_CONFIDENTIAL_BALANCE",
      message: "Wallet sender belum punya saldo token confidential untuk ditransfer.",
      detail: "Kontrak token me-revert dengan `ERC7984ZeroBalance(holder)`.",
      action: "Mint/token issuance dulu ke wallet sender, lalu ulang transfer.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("transfercontroller: zero account") ||
    normalized.includes("zero token") ||
    normalized.includes("zero registry") ||
    normalized.includes("erc20invalidsender") ||
    normalized.includes("erc20invalidreceiver") ||
    normalized.includes("erc20invalidspender") ||
    normalized.includes("erc20invalidapprover") ||
    normalized.includes("ownableinvalidowner")
  ) {
    return {
      code: "ZERO_ACCOUNT",
      message: "Ada alamat nol atau alamat kontrak yang tidak valid di request ini.",
      detail: "Kontrak menolak transfer bila alamat `from`, `to`, atau dependency kontrak bernilai zero address.",
      action: "Periksa alamat wallet input dan konfigurasi address kontrak publik.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("invalid proof") ||
    normalized.includes("handleproof") ||
    normalized.includes("externaleuint256") ||
    normalized.includes("nox") ||
    normalized.includes("proof verification") ||
    normalized.includes("proof")
  ) {
    return {
      code: "INVALID_PROOF",
      message: "Proof terenkripsi tidak valid atau tidak cocok dengan network/contract target.",
      detail: "Browser/frontend belum boleh menganggap sukses tanpa NOX handle dan `inputProof` yang benar untuk kontrak target.",
      action: "Generate ulang proof memakai NOX client yang benar untuk chain dan kontrak tujuan.",
      rawMessage,
      retryable: false,
    };
  }

  if (normalized.includes("usetransfercontroller")) {
    return {
      code: "USE_TRANSFER_CONTROLLER",
      message: "Transfer rahasia harus lewat transfer controller, bukan langsung ke token.",
      detail: "Kontrak token mengunci jalur transfer tertentu agar compliance/disclosure tetap diterapkan.",
      action: "Gunakan method pada transfer controller untuk transfer confidential.",
      rawMessage,
      retryable: false,
    };
  }

  if (
    normalized.includes("network error") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("http request failed") ||
    normalized.includes("fetch failed") ||
    normalized.includes("timeout") ||
    normalized.includes("disconnected") ||
    normalized.includes("rpc")
  ) {
    return {
      code: "NETWORK_ERROR",
      message: "Jaringan RPC atau wallet tidak merespons.",
      detail: "Pembacaan/pengiriman transaksi gagal di level network, bukan karena validasi bisnis kontrak.",
      action: "Coba lagi setelah koneksi wallet dan RPC stabil.",
      rawMessage,
      retryable: true,
    };
  }

  return {
    code: "UNKNOWN",
    message: "Transaksi atau pre-check gagal dengan error yang belum terpetakan.",
    detail: rawMessage || "Tidak ada detail revert yang bisa dibaca.",
    action: "Lihat raw error untuk diagnosis lebih lanjut.",
    rawMessage,
    retryable: false,
  };
}
