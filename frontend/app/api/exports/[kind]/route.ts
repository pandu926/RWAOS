import { NextResponse } from "next/server";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};

type Asset = { id: number; name: string; asset_type: string };
type Investor = { id: number; legal_name: string; jurisdiction: string };
type Transfer = { id: number; asset_id: number; from_investor_id: number; to_investor_id: number; amount: number };
type Disclosure = { id: number; asset_id: number; title: string; content: string };
type AuditEvent = { id: number; actor: string; action: string; timestamp_unix: number };
type Passport = {
  id: number;
  transfer_id: number;
  status: string;
  policy_hash: string;
  anchor_hash: string;
  created_by: string;
  created_by_role: string;
  created_at_unix: number;
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

function getAuthHeader(): Record<string, string> {
  const token =
    process.env.INTERNAL_API_AUTH_TOKEN?.trim() ||
    process.env.API_AUTH_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_API_AUTH_TOKEN?.trim() ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchList<T>(url: string): Promise<T[]> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      ...getAuthHeader(),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }
  const payload = (await response.json()) as ApiEnvelope<T[]> | T[];
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload.success && Array.isArray(payload.data)) {
    return payload.data;
  }
  throw new Error(payload.error || "Unexpected API response");
}

function toCsv(headers: string[], rows: Array<Array<string | number>>): string {
  const escape = (value: string | number) =>
    `"${String(value).replaceAll("\"", "\"\"")}"`;
  const lines = [
    headers.map(escape).join(","),
    ...rows.map((row) => row.map(escape).join(",")),
  ];
  return `${lines.join("\n")}\n`;
}

function csvResponse(filename: string, content: string): NextResponse {
  return new NextResponse(content, {
    status: 200,
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

function jsonResponse(filename: string, payload: unknown): NextResponse {
  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ kind: string }> },
) {
  const { kind } = await params;
  const backend = getBackendBaseUrl();

  try {
    if (kind === "investor-template") {
      return csvResponse(
        "investor-import-template.csv",
        toCsv(["legal_name", "jurisdiction"], [["Example Institutional LP", "SG"]]),
      );
    }

    if (kind === "passport-template") {
      return csvResponse(
        "passport-template.csv",
        toCsv(
          ["transfer_id", "policy_hash", "anchor_hash", "status"],
          [[1, "0xpolicy...", "0xanchor...", "Anchored"]],
        ),
      );
    }

    if (kind === "assets") {
      const rows = await fetchList<Asset>(`${backend}/assets`);
      return csvResponse(
        "assets.csv",
        toCsv(["id", "name", "asset_type"], rows.map((x) => [x.id, x.name, x.asset_type])),
      );
    }

    if (kind === "investors") {
      const rows = await fetchList<Investor>(`${backend}/investors`);
      return csvResponse(
        "investors.csv",
        toCsv(["id", "legal_name", "jurisdiction"], rows.map((x) => [x.id, x.legal_name, x.jurisdiction])),
      );
    }

    if (kind === "transfers") {
      const rows = await fetchList<Transfer>(`${backend}/transfers`);
      return csvResponse(
        "transfers.csv",
        toCsv(
          ["id", "asset_id", "from_investor_id", "to_investor_id", "amount"],
          rows.map((x) => [x.id, x.asset_id, x.from_investor_id, x.to_investor_id, x.amount]),
        ),
      );
    }

    if (kind === "disclosures") {
      const rows = await fetchList<Disclosure>(`${backend}/disclosures`);
      return csvResponse(
        "disclosures.csv",
        toCsv(
          ["id", "asset_id", "title", "content"],
          rows.map((x) => [x.id, x.asset_id, x.title, x.content]),
        ),
      );
    }

    if (kind === "audit") {
      const rows = await fetchList<AuditEvent>(`${backend}/audit/events`);
      return csvResponse(
        "audit-events.csv",
        toCsv(
          ["id", "actor", "action", "timestamp_unix"],
          rows.map((x) => [x.id, x.actor, x.action, x.timestamp_unix]),
        ),
      );
    }

    if (kind === "passports") {
      const rows = await fetchList<Passport>(`${backend}/compliance/passports`);
      return csvResponse(
        "compliance-passports.csv",
        toCsv(
          ["id", "transfer_id", "status", "policy_hash", "anchor_hash", "created_by", "created_by_role", "created_at_unix"],
          rows.map((x) => [x.id, x.transfer_id, x.status, x.policy_hash, x.anchor_hash, x.created_by, x.created_by_role, x.created_at_unix]),
        ),
      );
    }

    if (kind === "report-summary") {
      const [assets, investors, transfers, disclosures, audits] = await Promise.all([
        fetchList<Asset>(`${backend}/assets`),
        fetchList<Investor>(`${backend}/investors`),
        fetchList<Transfer>(`${backend}/transfers`),
        fetchList<Disclosure>(`${backend}/disclosures`),
        fetchList<AuditEvent>(`${backend}/audit/events`),
      ]);
      return jsonResponse("report-summary.json", {
        generated_at: new Date().toISOString(),
        totals: {
          assets: assets.length,
          investors: investors.length,
          transfers: transfers.length,
          disclosures: disclosures.length,
          audit_events: audits.length,
          transfer_volume: transfers.reduce((sum, t) => sum + Number(t.amount || 0), 0),
        },
      });
    }

    return NextResponse.json({ success: false, error: "Unknown export kind." }, { status: 404 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to export data.";
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
