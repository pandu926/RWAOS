import auditAnchorAbiJson from "@/lib/web3/abi/audit-anchor.json";
import confidentialRwaTokenAbiJson from "@/lib/web3/abi/confidential-rwa-token.json";
import disclosureRegistryAbiJson from "@/lib/web3/abi/disclosure-registry.json";
import transferControllerAbiJson from "@/lib/web3/abi/transfer-controller.json";

type HexAddress = `0x${string}`;
type ContractName =
  | "confidentialRwaToken"
  | "disclosureRegistry"
  | "transferController"
  | "auditAnchor";

type AbiItem = {
  type: string;
  name?: string;
  inputs?: Array<{ name: string; type: string; internalType?: string; indexed?: boolean }>;
  outputs?: Array<{ name: string; type: string; internalType?: string }>;
  stateMutability?: string;
  anonymous?: boolean;
};

type ConfigValidation = {
  ok: boolean;
  missing: string[];
  invalid: string[];
};

const DEFAULTS = {
  chainId: "421614",
  rpcUrl: "https://sepolia-rollup.arbitrum.io/rpc",
  addresses: {
    confidentialRwaToken: "0x00094fc240029a342fB1152bBc7a15F73C7142C2",
    disclosureRegistry: "0x5118aEC317dC21361Cad981944532F1f90D7aBb8",
    transferController: "0x049B1712B9E624a01Eb4C40d10aBF42E89a14314",
    auditAnchor: "0x79279257A998d3a5E26B70cb538b09fEe2f90174",
  },
} as const;

function readEnv(name: string, fallback: string): string {
  const value = process.env[name];
  if (!value || value.trim().length === 0) {
    return fallback;
  }

  return value.trim();
}

function isHexAddress(value: string): value is HexAddress {
  return /^0x[a-fA-F0-9]{40}$/.test(value);
}

function isChainId(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export const chainConfig = {
  chainId: readEnv("NEXT_PUBLIC_CHAIN_ID", DEFAULTS.chainId),
  rpcUrl: readEnv("NEXT_PUBLIC_RPC_URL", DEFAULTS.rpcUrl),
} as const;

export const contractAddresses: Record<ContractName, HexAddress> = {
  confidentialRwaToken: readEnv(
    "NEXT_PUBLIC_CONTRACT_CONFIDENTIAL_RWA_TOKEN",
    DEFAULTS.addresses.confidentialRwaToken,
  ) as HexAddress,
  disclosureRegistry: readEnv(
    "NEXT_PUBLIC_CONTRACT_DISCLOSURE_REGISTRY",
    DEFAULTS.addresses.disclosureRegistry,
  ) as HexAddress,
  transferController: readEnv(
    "NEXT_PUBLIC_CONTRACT_TRANSFER_CONTROLLER",
    DEFAULTS.addresses.transferController,
  ) as HexAddress,
  auditAnchor: readEnv(
    "NEXT_PUBLIC_CONTRACT_AUDIT_ANCHOR",
    DEFAULTS.addresses.auditAnchor,
  ) as HexAddress,
};

const abiMap: Record<ContractName, AbiItem[]> = {
  confidentialRwaToken: confidentialRwaTokenAbiJson as AbiItem[],
  disclosureRegistry: disclosureRegistryAbiJson as AbiItem[],
  transferController: transferControllerAbiJson as AbiItem[],
  auditAnchor: auditAnchorAbiJson as AbiItem[],
};

export function getContractAbi(name: ContractName): AbiItem[] {
  return abiMap[name];
}

export function validatePublicWeb3Config(): ConfigValidation {
  const missing: string[] = [];
  const invalid: string[] = [];
  const requiredKeys = [
    "NEXT_PUBLIC_CHAIN_ID",
    "NEXT_PUBLIC_RPC_URL",
    "NEXT_PUBLIC_CONTRACT_CONFIDENTIAL_RWA_TOKEN",
    "NEXT_PUBLIC_CONTRACT_DISCLOSURE_REGISTRY",
    "NEXT_PUBLIC_CONTRACT_TRANSFER_CONTROLLER",
    "NEXT_PUBLIC_CONTRACT_AUDIT_ANCHOR",
  ];

  for (const key of requiredKeys) {
    if (!process.env[key] || process.env[key]?.trim().length === 0) {
      missing.push(key);
    }
  }

  if (!isChainId(chainConfig.chainId)) {
    invalid.push("NEXT_PUBLIC_CHAIN_ID");
  }
  if (!chainConfig.rpcUrl.startsWith("http")) {
    invalid.push("NEXT_PUBLIC_RPC_URL");
  }

  for (const [key, value] of Object.entries(contractAddresses)) {
    if (!isHexAddress(value)) {
      invalid.push(`NEXT_PUBLIC_CONTRACT_${key.toUpperCase()}`);
    }
  }

  return { ok: missing.length === 0 && invalid.length === 0, missing, invalid };
}

export function validateRequiredWeb3ConfigInProduction(): ConfigValidation {
  const validation = validatePublicWeb3Config();
  if (process.env.NODE_ENV === "production" && !validation.ok) {
    throw new Error(
      `Invalid web3 public config. Missing: ${validation.missing.join(", ") || "-"} | Invalid: ${
        validation.invalid.join(", ") || "-"
      }`,
    );
  }

  return validation;
}
