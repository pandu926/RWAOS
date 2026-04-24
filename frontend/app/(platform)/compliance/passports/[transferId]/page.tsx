import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { PageHeader, SectionCard, StatusBadge } from "@/components/ui";
import { shortenAddress } from "@/lib/utils";
import { WALLET_SESSION_COOKIE, parseWalletSession } from "@/lib/web3/session";

type ApiEnvelope<T> = {
  success: boolean;
  data?: T;
  error?: string | null;
};

type PassportDetail = {
  transfer_id: number;
  policy_hash: string;
  disclosure_data_id: string;
  anchor_hash: string;
  status: string;
  transfer_tx_hash: string;
  anchor_tx_hash: string;
  created_by: string;
  created_by_role: string;
  created_at_unix: number;
  last_accessed_unix: number | null;
};

function getApiBaseUrl(): string {
  const configured =
    process.env.INTERNAL_API_BASE_URL?.trim() ||
    process.env.NEXT_PUBLIC_API_BASE_URL?.trim() ||
    "";
  if (!configured) {
    throw new Error("Missing API base URL configuration");
  }
  return configured.endsWith("/") ? configured.slice(0, -1) : configured;
}

function getAuthHeader(): Record<string, string> {
  const token =
    process.env.INTERNAL_API_AUTH_TOKEN?.trim() ||
    process.env.API_AUTH_TOKEN?.trim() ||
    process.env.NEXT_PUBLIC_API_AUTH_TOKEN?.trim() ||
    "";
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function formatUnix(unix: number | null): string {
  if (!unix) return "Never";
  return new Date(unix * 1000).toISOString().replace("T", " ").replace(".000Z", " UTC");
}

function tone(status: string): "success" | "accent" | "neutral" {
  if (status === "Anchored") return "success";
  if (status === "Disclosed to Authorized") return "accent";
  return "neutral";
}

export default async function PassportDetailPage({
  params,
}: {
  params: Promise<{ transferId: string }>;
}) {
  const cookieStore = await cookies();
  const session = parseWalletSession(cookieStore.get(WALLET_SESSION_COOKIE)?.value ?? null);
  const { transferId } = await params;
  if (!session) {
    redirect(`/login?next=${encodeURIComponent(`/compliance/passports/${transferId}`)}`);
  }
  const response = await fetch(`${getApiBaseUrl()}/compliance/passports/${transferId}`, {
    headers: {
      Accept: "application/json",
      ...getAuthHeader(),
    },
    cache: "no-store",
  });

  if (response.status === 404) {
    notFound();
  }

  const payload = (await response.json()) as ApiEnvelope<PassportDetail>;
  if (!response.ok || !payload.success || !payload.data) {
    notFound();
  }

  const detail = payload.data;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Compliance Passport Detail"
        title={`Transfer #${detail.transfer_id}`}
        description="Role-scoped detail view for selective disclosure and audit references."
        meta={<StatusBadge tone={tone(detail.status)}>{detail.status}</StatusBadge>}
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Core references">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Policy hash</dt>
              <dd className="mt-1 font-mono text-foreground">{detail.policy_hash}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Disclosure data ID</dt>
              <dd className="mt-1 font-mono text-foreground">{detail.disclosure_data_id}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Anchor hash</dt>
              <dd className="mt-1 font-mono text-foreground">{detail.anchor_hash}</dd>
            </div>
          </dl>
        </SectionCard>

        <SectionCard title="Evidence trail">
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Transfer tx</dt>
              <dd className="mt-1 font-mono text-foreground">{shortenAddress(detail.transfer_tx_hash)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Anchor tx</dt>
              <dd className="mt-1 font-mono text-foreground">{shortenAddress(detail.anchor_tx_hash)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Created by</dt>
              <dd className="mt-1 text-foreground">
                {detail.created_by} ({detail.created_by_role})
              </dd>
            </div>
            <div>
              <dt className="text-xs uppercase tracking-[0.16em] text-muted">Last accessed</dt>
              <dd className="mt-1 text-foreground">{formatUnix(detail.last_accessed_unix)}</dd>
            </div>
          </dl>
        </SectionCard>
      </div>
    </div>
  );
}
