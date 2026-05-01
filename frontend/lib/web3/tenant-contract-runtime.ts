export type TenantBundleMode = "tenant-factory" | "managed-global";

export type TenantContractBundle = {
  institutionId: number;
  chainId: number;
  contracts: {
    confidentialRwaToken: `0x${string}`;
    disclosureRegistry: `0x${string}`;
    transferController: `0x${string}`;
    auditAnchor: `0x${string}`;
    settlementAsset?: `0x${string}`;
    settlementVault?: `0x${string}`;
  };
  factoryTxHash: `0x${string}`;
  ownerWallet: `0x${string}`;
  deploymentStatus: string;
  mode: TenantBundleMode;
  sourceLabel: string;
  createdAtUnix: number;
};

export type TenantBundleState = "configured" | "missing" | "error";

export type TenantBundleRuntime = {
  state: TenantBundleState;
  configured: boolean;
  bundle: TenantContractBundle | null;
  error: string | null;
};

export type TenantBundleApiEnvelope = {
  success: boolean;
  data?: unknown;
  error?: string | null;
};

function inferMode(deploymentStatus: string): TenantBundleMode {
  return deploymentStatus.trim().toLowerCase() === "managed-global" ? "managed-global" : "tenant-factory";
}

export function toTenantBundleRuntime(
  bundle: TenantContractBundle | null,
  error: string | null = null,
): TenantBundleRuntime {
  if (error) {
    return { state: "error", configured: false, bundle: null, error };
  }

  if (!bundle) {
    return { state: "missing", configured: false, bundle: null, error: null };
  }

  return { state: "configured", configured: true, bundle, error: null };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asRuntime(value: unknown): TenantBundleRuntime | null {
  if (!isObject(value)) {
    return null;
  }

  const state = value.state;
  const configured = value.configured;
  const bundle = value.bundle;
  const error = value.error;

  if (state !== "configured" && state !== "missing" && state !== "error") {
    return null;
  }
  if (typeof configured !== "boolean") {
    return null;
  }
  if (!(bundle === null || isObject(bundle))) {
    return null;
  }
  if (!(error === null || typeof error === "string" || error === undefined)) {
    return null;
  }

  return {
    state,
    configured,
    bundle: bundle === null ? null : (bundle as TenantContractBundle),
    error: typeof error === "string" ? error : null,
  };
}

export function runtimeFromTenantBundleApiEnvelope(envelope: TenantBundleApiEnvelope): TenantBundleRuntime {
  if (!envelope.success) {
    return toTenantBundleRuntime(null, envelope.error ?? "Failed to resolve tenant contracts.");
  }

  const runtime = asRuntime(envelope.data);
  if (!runtime) {
    return toTenantBundleRuntime(null, "Invalid tenant contract payload from API route.");
  }

  if (runtime.state === "configured" && runtime.bundle) {
    return {
      ...runtime,
      bundle: {
        ...runtime.bundle,
        mode: inferMode(runtime.bundle.deploymentStatus),
      },
    };
  }

  return runtime;
}

export async function fetchTenantBundleRuntime(init?: RequestInit): Promise<TenantBundleRuntime> {
  try {
    const response = await fetch("/api/tenant/contracts", {
      method: "GET",
      cache: "no-store",
      ...init,
    });

    const payload = (await response.json().catch(() => null)) as TenantBundleApiEnvelope | null;
    if (!payload) {
      return toTenantBundleRuntime(null, "Tenant contract API route returned invalid JSON.");
    }

    const runtime = runtimeFromTenantBundleApiEnvelope(payload);
    if (!response.ok && runtime.state !== "error") {
      return toTenantBundleRuntime(null, payload.error ?? "Failed to resolve tenant contracts.");
    }

    return runtime;
  } catch {
    return toTenantBundleRuntime(null, "Failed to load tenant contract runtime.");
  }
}
