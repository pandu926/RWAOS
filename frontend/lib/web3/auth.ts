const DEFAULT_POST_LOGIN_PATH = "/dashboard";

export function sanitizeNextPath(rawNext: string | null | undefined): string {
  if (!rawNext) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  const candidate = rawNext.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return DEFAULT_POST_LOGIN_PATH;
  }
  if (candidate.startsWith("/login")) {
    return DEFAULT_POST_LOGIN_PATH;
  }

  return candidate;
}

type ApiErrorPayload = {
  error?: string | null;
};

export function mapWalletAuthError(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Proses login wallet gagal. Coba lagi.";
  }

  const message = error.message.toLowerCase();
  if (message.includes("allowlist")) {
    return "Wallet ini belum berhasil diproses oleh layanan auth. Coba login ulang.";
  }
  if (message.includes("unsupported chain id")) {
    return "Network tidak sesuai. Pindah ke Arbitrum Sepolia lalu coba lagi.";
  }
  if (message.includes("signature") || message.includes("user rejected")) {
    return "Signature ditolak atau tidak valid. Silakan sign ulang di wallet.";
  }
  if (message.includes("backend")) {
    return "Layanan auth backend belum bisa diakses. Coba beberapa saat lagi.";
  }
  if (message.includes("challenge")) {
    return "Gagal mengambil challenge login wallet. Coba lagi.";
  }

  return error.message;
}

export async function readApiError(response: Response, fallback: string): Promise<string> {
  try {
    const payload = (await response.json()) as ApiErrorPayload;
    return payload.error?.trim() || fallback;
  } catch {
    return fallback;
  }
}
