import { isAddress, isHex, type Address, type Hex, type WalletClient } from "viem";

export type NoxProofGenerationRequest = {
  amount: bigint;
  contractAddress: Address;
  chainId?: number;
  solidityType?: "uint256";
};

export type GeneratedEncryptedInput = {
  ok: true;
  adapter: string;
  encryptedAmount: Hex;
  inputProof: Hex;
};

export type ProofGenerationFailureCode =
  | "INVALID_AMOUNT"
  | "INVALID_CONTRACT_ADDRESS"
  | "NOX_CLIENT_UNAVAILABLE"
  | "UNSUPPORTED_CHAIN"
  | "PROOF_GENERATION_FAILED"
  | "INVALID_PROOF_OUTPUT";

export type ProofGenerationFailure = {
  ok: false;
  blocker: true;
  adapter: string | null;
  code: ProofGenerationFailureCode;
  message: string;
  detail?: string;
  action: string;
  cause?: unknown;
};

export type ProofGenerationResult = GeneratedEncryptedInput | ProofGenerationFailure;

export type ProofReadinessInput = {
  hasWallet: boolean;
  onTargetChain: boolean;
  amountValid: boolean;
  adapterReady: boolean;
};

export type ProofReadinessItem = {
  label: string;
  ready: boolean;
  detail: string;
};

export type NoxHandleClientLike = {
  encryptInput: (
    value: bigint,
    solidityType: "uint256",
    contractAddress: Address,
  ) => Promise<{
    handle: Hex;
    handleProof: Hex;
  }>;
};

export type NoxProofAdapter = {
  name: string;
  isAvailable: () => boolean | Promise<boolean>;
  supportsChain?: (chainId: number) => boolean | Promise<boolean>;
  generate: (request: NoxProofGenerationRequest) => Promise<{
    encryptedAmount: Hex;
    inputProof: Hex;
  }>;
};

function isBytes32(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function unavailableFailure(detail?: string): ProofGenerationFailure {
  return {
    ok: false,
    blocker: true,
    adapter: null,
    code: "NOX_CLIENT_UNAVAILABLE",
    message: "Generator proof NOX belum tersedia di frontend.",
    detail:
      detail ??
      "Package/runtime browser untuk membuat `externalEuint256` dan `inputProof` belum terpasang atau belum diinisialisasi.",
    action:
      "Tambahkan adapter browser yang membungkus NOX handle client, mis. dari `@iexec-nox/handle`, lalu teruskan adapter itu ke helper ini.",
  };
}

export function createNoxHandleClientAdapter(
  handleClient: NoxHandleClientLike,
  name = "nox-handle-client",
): NoxProofAdapter {
  return {
    name,
    isAvailable: () => true,
    async generate(request) {
      const encrypted = await handleClient.encryptInput(
        request.amount,
        request.solidityType ?? "uint256",
        request.contractAddress,
      );

      return {
        encryptedAmount: encrypted.handle,
        inputProof: encrypted.handleProof,
      };
    },
  };
}

export function createViemWalletClientProofAdapter(
  walletClient: WalletClient | undefined,
  name = "@iexec-nox/handle",
): NoxProofAdapter | null {
  if (!walletClient?.account) {
    return null;
  }

  return {
    name,
    isAvailable: () => Boolean(walletClient.account),
    supportsChain: (chainId) => walletClient.chain?.id === chainId,
    async generate(request) {
      const { createViemHandleClient } = await import("@iexec-nox/handle");
      const handleClient = await createViemHandleClient(walletClient);
      const encrypted = await handleClient.encryptInput(
        request.amount,
        request.solidityType ?? "uint256",
        request.contractAddress,
      );

      return {
        encryptedAmount: encrypted.handle,
        inputProof: encrypted.handleProof,
      };
    },
  };
}

export async function generateEncryptedAmountAndProof(
  request: NoxProofGenerationRequest,
  adapter: NoxProofAdapter | null,
): Promise<ProofGenerationResult> {
  if (request.amount <= BigInt(0)) {
    return {
      ok: false,
      blocker: true,
      adapter: adapter?.name ?? null,
      code: "INVALID_AMOUNT",
      message: "Amount harus lebih besar dari 0 untuk membuat proof.",
      action: "Validasi amount di UI sebelum memanggil generator proof.",
    };
  }

  if (!isAddress(request.contractAddress)) {
    return {
      ok: false,
      blocker: true,
      adapter: adapter?.name ?? null,
      code: "INVALID_CONTRACT_ADDRESS",
      message: "Alamat kontrak target untuk proof tidak valid.",
      action: "Pastikan helper dipanggil dengan address kontrak token/controller yang benar.",
    };
  }

  if (!adapter) {
    return unavailableFailure(
      "Tidak ada adapter NOX yang di-pass ke helper untuk sesi wallet ini.",
    );
  }

  if (!(await adapter.isAvailable())) {
    return unavailableFailure(`Adapter \`${adapter.name}\` terdaftar tetapi runtime-nya belum siap dipakai.`);
  }

  if (
    typeof request.chainId === "number" &&
    Number.isFinite(request.chainId) &&
    adapter.supportsChain &&
    !(await adapter.supportsChain(request.chainId))
  ) {
    return {
      ok: false,
      blocker: true,
      adapter: adapter.name,
      code: "UNSUPPORTED_CHAIN",
      message: "Adapter proof NOX tidak mendukung network yang aktif.",
      detail: `Chain ID ${request.chainId} tidak didukung oleh adapter \`${adapter.name}\`.`,
      action: "Ganti ke chain yang didukung atau sediakan adapter yang sesuai untuk network ini.",
    };
  }

  try {
    const output = await adapter.generate(request);
    if (!isBytes32(output.encryptedAmount) || !isHex(output.inputProof)) {
      return {
        ok: false,
        blocker: true,
        adapter: adapter.name,
        code: "INVALID_PROOF_OUTPUT",
        message: "Adapter proof mengembalikan output yang tidak valid.",
        detail:
          "`encryptedAmount` wajib bytes32 dan `inputProof` wajib hex bytes. Helper memblokir output yang tidak memenuhi kontrak.",
        action: "Perbaiki implementasi adapter agar mengembalikan handle/proof real dari NOX client.",
      };
    }

    return {
      ok: true,
      adapter: adapter.name,
      encryptedAmount: output.encryptedAmount,
      inputProof: output.inputProof,
    };
  } catch (cause) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    return {
      ok: false,
      blocker: true,
      adapter: adapter.name,
      code: "PROOF_GENERATION_FAILED",
      message: "Gagal menghasilkan encrypted amount dan input proof.",
      detail,
      action:
        "Pastikan wallet client NOX aktif di browser, dependency NOX tersedia di frontend, dan kontrak target sesuai dengan handle generation.",
      cause,
    };
  }
}

export function getProofReadinessItems(input: ProofReadinessInput): ProofReadinessItem[] {
  return [
    {
      label: "Wallet",
      ready: input.hasWallet,
      detail: input.hasWallet ? "Wallet connected." : "Connect wallet before generating proof.",
    },
    {
      label: "Network",
      ready: input.onTargetChain,
      detail: input.onTargetChain ? "Arbitrum Sepolia active." : "Switch wallet to Arbitrum Sepolia.",
    },
    {
      label: "Amount",
      ready: input.amountValid,
      detail: input.amountValid ? "Proof input amount is valid." : "Amount must be a positive integer.",
    },
    {
      label: "NOX adapter",
      ready: input.adapterReady,
      detail: input.adapterReady
        ? "Browser NOX adapter is available."
        : "NOX browser adapter is not ready for this wallet session.",
    },
  ];
}
