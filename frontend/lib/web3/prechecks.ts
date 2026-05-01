import { isAddress, type Address, type Hex } from "viem";

import { web3PublicClient } from "@/lib/web3/client";
import { contractAddresses } from "@/lib/web3/contracts";
import { decodeTransferControllerError, type DecodedContractError } from "@/lib/web3/errors";
import type { TenantBundleRuntime } from "@/lib/web3/tenant-contract-runtime";

const disclosureRegistryReadAbi = [
  {
    type: "function",
    name: "hasDisclosure",
    stateMutability: "view",
    inputs: [
      { name: "dataId", type: "bytes32" },
      { name: "grantee", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

const confidentialRwaTokenReadAbi = [
  {
    type: "function",
    name: "isOperator",
    stateMutability: "view",
    inputs: [
      { name: "holder", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

type PrecheckState = "ready" | "blocked" | "invalid" | "error";

type PrecheckBase = {
  ok: boolean;
  state: PrecheckState;
  code:
    | "OK"
    | "INVALID_ADDRESS"
    | "INVALID_DISCLOSURE_DATA_ID"
    | "DISCLOSURE_MISSING"
    | "OPERATOR_MISSING"
    | "READ_FAILED";
  summary: string;
  detail?: string;
  action?: string;
  error?: DecodedContractError;
};

export type DisclosurePrecheckStatus = PrecheckBase & {
  kind: "disclosure";
  disclosureDataId: Hex;
  caller: Address;
  hasDisclosure: boolean | null;
};

export type OperatorPrecheckStatus = PrecheckBase & {
  kind: "operator";
  from: Address;
  transferController: Address;
  isOperator: boolean | null;
};

export type TransferPrecheckStatus = {
  ok: boolean;
  checks: {
    disclosure: DisclosurePrecheckStatus;
    operator: OperatorPrecheckStatus;
  };
  summary: string;
};

export type ReadinessItem = {
  label: string;
  ready: boolean;
  detail: string;
};

export type TenantRuntimePrecheckStatus = {
  ok: boolean;
  summary: string;
  detail: string;
  action: string;
  missing: string[];
  invalid: string[];
};

type TransferPrecheckParams = {
  disclosureDataId: Hex;
  caller: Address;
  from: Address;
  tokenAddress?: Address;
  disclosureRegistry?: Address;
  transferController?: Address;
};

function isBytes32(value: string): value is Hex {
  return /^0x[a-fA-F0-9]{64}$/.test(value);
}

function invalidDisclosureStatus(disclosureDataId: Hex, caller: Address): DisclosurePrecheckStatus {
  return {
    kind: "disclosure",
    ok: false,
    state: "invalid",
    code: "INVALID_DISCLOSURE_DATA_ID",
    summary: "Disclosure data id harus bytes32.",
    detail: "Gunakan hex 32-byte dengan format `0x` + 64 karakter heksadesimal.",
    action: "Pilih disclosure yang valid sebelum submit transfer.",
    disclosureDataId,
    caller,
    hasDisclosure: null,
  };
}

function invalidAddressStatus(kind: "disclosure", disclosureDataId: Hex, caller: Address): DisclosurePrecheckStatus;
function invalidAddressStatus(kind: "operator", from: Address, transferController: Address): OperatorPrecheckStatus;
function invalidAddressStatus(
  kind: "disclosure" | "operator",
  primary: Address | Hex,
  secondary: Address,
): DisclosurePrecheckStatus | OperatorPrecheckStatus {
  if (kind === "disclosure") {
    return {
      kind,
      ok: false,
      state: "invalid",
      code: "INVALID_ADDRESS",
      summary: "Alamat wallet caller tidak valid.",
      detail: "Caller harus berupa alamat EVM `0x...` yang valid.",
      action: "Hubungkan wallet yang valid lalu ulangi pre-check.",
      disclosureDataId: primary as Hex,
      caller: secondary,
      hasDisclosure: null,
    };
  }

  return {
    kind,
    ok: false,
    state: "invalid",
    code: "INVALID_ADDRESS",
    summary: "Alamat holder atau transfer controller tidak valid.",
    detail: "Pre-check operator membutuhkan alamat `from` dan `transferController` yang valid.",
    action: "Periksa konfigurasi kontrak dan alamat investor sumber.",
    from: primary as Address,
    transferController: secondary,
    isOperator: null,
  };
}

export async function hasDisclosure(
  disclosureDataId: Hex,
  caller: Address,
  disclosureRegistry: Address = contractAddresses.disclosureRegistry,
): Promise<DisclosurePrecheckStatus> {
  if (!isBytes32(disclosureDataId)) {
    return invalidDisclosureStatus(disclosureDataId, caller);
  }
  if (!isAddress(caller) || !isAddress(disclosureRegistry)) {
    return invalidAddressStatus("disclosure", disclosureDataId, caller);
  }

  try {
    const active = await web3PublicClient.readContract({
      address: disclosureRegistry,
      abi: disclosureRegistryReadAbi,
      functionName: "hasDisclosure",
      args: [disclosureDataId, caller],
    });

    if (active) {
      return {
        kind: "disclosure",
        ok: true,
        state: "ready",
        code: "OK",
        summary: "Disclosure aktif untuk caller ini.",
        disclosureDataId,
        caller,
        hasDisclosure: true,
      };
    }

    return {
      kind: "disclosure",
      ok: false,
      state: "blocked",
      code: "DISCLOSURE_MISSING",
      summary: "Disclosure belum diberikan ke wallet ini.",
      detail: "Transfer controller akan revert dengan `disclosure required` bila transfer tetap dikirim.",
      action: "Grant disclosure untuk wallet caller sebelum submit transfer.",
      disclosureDataId,
      caller,
      hasDisclosure: false,
    };
  } catch (error) {
    const decoded = decodeTransferControllerError(error);

    return {
      kind: "disclosure",
      ok: false,
      state: "error",
      code: "READ_FAILED",
      summary: decoded.message,
      detail: decoded.detail,
      action: decoded.action,
      error: decoded,
      disclosureDataId,
      caller,
      hasDisclosure: null,
    };
  }
}

export async function isOperator(
  from: Address,
  transferController: Address = contractAddresses.transferController,
  tokenAddress: Address = contractAddresses.confidentialRwaToken,
): Promise<OperatorPrecheckStatus> {
  if (!isAddress(from) || !isAddress(transferController) || !isAddress(tokenAddress)) {
    return invalidAddressStatus("operator", from, transferController);
  }

  try {
    const active = await web3PublicClient.readContract({
      address: tokenAddress,
      abi: confidentialRwaTokenReadAbi,
      functionName: "isOperator",
      args: [from, transferController],
    });

    if (active) {
      return {
        kind: "operator",
        ok: true,
        state: "ready",
        code: "OK",
        summary: "Transfer controller sudah menjadi operator untuk holder ini.",
        from,
        transferController,
        isOperator: true,
      };
    }

    return {
      kind: "operator",
      ok: false,
      state: "blocked",
      code: "OPERATOR_MISSING",
      summary: "Transfer controller belum di-set sebagai operator.",
      detail: "Transfer controller akan revert dengan `operator missing` bila transfer tetap dikirim.",
      action: "Jalankan `setOperator(transferController, until)` dari wallet holder sebelum submit transfer.",
      from,
      transferController,
      isOperator: false,
    };
  } catch (error) {
    const decoded = decodeTransferControllerError(error);

    return {
      kind: "operator",
      ok: false,
      state: "error",
      code: "READ_FAILED",
      summary: decoded.message,
      detail: decoded.detail,
      action: decoded.action,
      error: decoded,
      from,
      transferController,
      isOperator: null,
    };
  }
}

export async function getTransferPrecheckStatus({
  disclosureDataId,
  caller,
  from,
  tokenAddress = contractAddresses.confidentialRwaToken,
  disclosureRegistry = contractAddresses.disclosureRegistry,
  transferController = contractAddresses.transferController,
}: TransferPrecheckParams): Promise<TransferPrecheckStatus> {
  const [disclosure, operator] = await Promise.all([
    hasDisclosure(disclosureDataId, caller, disclosureRegistry),
    isOperator(from, transferController, tokenAddress),
  ]);

  const ok = disclosure.ok && operator.ok;
  const summary = ok
    ? "Semua pre-check on-chain lolos."
    : [disclosure.summary, operator.summary]
        .filter((value, index, items) => items.indexOf(value) === index)
        .join(" ");

  return {
    ok,
    checks: {
      disclosure,
      operator,
    },
    summary,
  };
}

export function getTransferReadinessItems(status: TransferPrecheckStatus | null): ReadinessItem[] {
  if (!status) {
    return [
      {
        label: "Disclosure",
        ready: false,
        detail: "Select a valid disclosure data ID to run the on-chain disclosure check.",
      },
      {
        label: "Operator",
        ready: false,
        detail: "Select a sender with mapped wallet to run the operator check.",
      },
    ];
  }

  return [
    {
      label: "Disclosure",
      ready: status.checks.disclosure.ok,
      detail: status.checks.disclosure.action || status.checks.disclosure.summary,
    },
    {
      label: "Operator",
      ready: status.checks.operator.ok,
      detail: status.checks.operator.action || status.checks.operator.summary,
    },
  ];
}

export function getTenantRuntimePrecheckStatus(
  runtime: TenantBundleRuntime | null,
  targetChainId: number,
): TenantRuntimePrecheckStatus {
  if (!runtime) {
    return {
      ok: false,
      summary: "Tenant runtime has not loaded yet.",
      detail: "The app is still fetching the tenant-owned contract bundle.",
      action: "Wait for tenant runtime to load before running confidential actions.",
      missing: ["tenant bundle"],
      invalid: [],
    };
  }

  if (runtime.state === "error") {
    return {
      ok: false,
      summary: "Tenant runtime could not be resolved.",
      detail: runtime.error ?? "Tenant bundle fetch failed.",
      action: "Fix the tenant runtime API/config and reload the page.",
      missing: [],
      invalid: ["tenant runtime"],
    };
  }

  if (runtime.state === "missing" || !runtime.bundle) {
    return {
      ok: false,
      summary: "Tenant bundle is not configured for this institution.",
      detail: "Core NOX/confidential flows require a saved tenant-owned contract bundle.",
      action: "Complete onboarding and save the tenant bundle first.",
      missing: ["tenant bundle"],
      invalid: [],
    };
  }

  if (runtime.bundle.chainId !== targetChainId) {
    return {
      ok: false,
      summary: "Tenant bundle is saved for the wrong chain.",
      detail: `Bundle chain ID ${runtime.bundle.chainId} does not match required ${targetChainId}.`,
      action: "Re-deploy or re-save the tenant bundle on the correct chain.",
      missing: [],
      invalid: ["chain_id"],
    };
  }

  if (runtime.bundle.mode !== "tenant-factory") {
    return {
      ok: false,
      summary: "Managed global tenant bundle is not allowed for the core demo flow.",
      detail: "Confidential transfer, disclosure, and passport flows require a tenant-owned bundle deployed from TenantFactory.",
      action: "Redeploy the tenant bundle from onboarding using the institution wallet, then save it again.",
      missing: [],
      invalid: ["deployment_mode"],
    };
  }

  return {
    ok: true,
    summary: "Tenant runtime contract bundle is ready.",
    detail: "Tenant-owned token, registry, controller, and audit contracts are available for this chain.",
    action: "Runtime pre-check passed.",
    missing: [],
    invalid: [],
  };
}
