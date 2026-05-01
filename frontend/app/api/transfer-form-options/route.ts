import { NextResponse } from "next/server";

import { getWalletSessionTokenFromRequest } from "@/lib/web3/session";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};

type BackendAsset = {
  id: number;
  name: string;
  issuance_wallet?: string | null;
};

type BackendInvestor = {
  id: number;
  legal_name: string;
  wallet_address?: string | null;
};

type BackendTransfer = {
  id: number;
  asset_id: number;
  from_investor_id: number;
  to_investor_id: number;
  amount: number;
  tx_hash?: string | null;
  status?: string | null;
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

async function fetchList<T>(url: string, token: string): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status} for ${url}.`);
  }
  const payload = (await response.json()) as ApiEnvelope<T[]> | T[];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload.success && Array.isArray(payload.data)) {
    return payload.data;
  }
  throw new Error(payload.error || `Unexpected API response from ${url}.`);
}

export async function GET(request: Request) {
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
    const [assets, investors, transfers] = await Promise.all([
      fetchList<BackendAsset>(`${backendBaseUrl}/assets`, token),
      fetchList<BackendInvestor>(`${backendBaseUrl}/investors`, token),
      fetchList<BackendTransfer>(`${backendBaseUrl}/transfers`, token),
    ]);

    const assetNameById = new Map<number, string>(
      assets.map((asset) => [asset.id, asset.name]),
    );
    const investorById = new Map<number, BackendInvestor>(
      investors.map((investor) => [investor.id, investor]),
    );

    return NextResponse.json({
      success: true,
      data: {
        assets: assets.map((asset) => ({
          id: asset.id,
          name: asset.name,
          issuance_wallet: asset.issuance_wallet?.trim() || null,
        })),
        investors: investors.map((investor) => ({
          id: investor.id,
          name: investor.legal_name,
          wallet_address: investor.wallet_address?.trim() || null,
        })),
        transfers: transfers.map((transfer) => {
          const fromInvestor = investorById.get(transfer.from_investor_id);
          const toInvestor = investorById.get(transfer.to_investor_id);
          return {
            id: transfer.id,
            asset_id: transfer.asset_id,
            asset_name: assetNameById.get(transfer.asset_id) || `Asset #${transfer.asset_id}`,
            from_investor_id: transfer.from_investor_id,
            from_investor_name: fromInvestor?.legal_name || `Investor #${transfer.from_investor_id}`,
            from_investor_wallet_address: fromInvestor?.wallet_address?.trim() || null,
            to_investor_id: transfer.to_investor_id,
            to_investor_name: toInvestor?.legal_name || `Investor #${transfer.to_investor_id}`,
            to_investor_wallet_address: toInvestor?.wallet_address?.trim() || null,
            amount: transfer.amount,
            tx_hash: transfer.tx_hash?.trim() || null,
            status: transfer.status?.trim().toLowerCase() || null,
          };
        }),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load transfer form options.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
