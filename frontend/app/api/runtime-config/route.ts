import { NextResponse } from "next/server";
import { isAddress, type Address } from "viem";

type RuntimeConfigPayload = {
  tenantFactoryAddress: Address | null;
  tenantFactoryEnvConfigured: boolean;
  tenantFactoryEnvInvalid: boolean;
  settlementAssetAddress: Address | null;
  settlementVaultAddress: Address | null;
};

function readOptionalEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export async function GET() {
  const tenantFactoryEnvValue = readOptionalEnv("NEXT_PUBLIC_CONTRACT_TENANT_FACTORY");
  const tenantFactoryAddress =
    tenantFactoryEnvValue.length > 0 && isAddress(tenantFactoryEnvValue)
      ? (tenantFactoryEnvValue as Address)
      : null;
  const settlementAssetValue = readOptionalEnv("NEXT_PUBLIC_CONTRACT_SETTLEMENT_ASSET");
  const settlementVaultValue = readOptionalEnv("NEXT_PUBLIC_CONTRACT_SETTLEMENT_VAULT");
  const settlementAssetAddress =
    settlementAssetValue.length > 0 && isAddress(settlementAssetValue) ? (settlementAssetValue as Address) : null;
  const settlementVaultAddress =
    settlementVaultValue.length > 0 && isAddress(settlementVaultValue) ? (settlementVaultValue as Address) : null;

  const payload: RuntimeConfigPayload = {
    tenantFactoryAddress,
    tenantFactoryEnvConfigured: tenantFactoryEnvValue.length > 0,
    tenantFactoryEnvInvalid: tenantFactoryEnvValue.length > 0 && !tenantFactoryAddress,
    settlementAssetAddress,
    settlementVaultAddress,
  };

  return NextResponse.json({
    success: true,
    data: payload,
  });
}
