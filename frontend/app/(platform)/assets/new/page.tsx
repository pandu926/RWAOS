"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button, InlineNotice, PageHeader, SectionCard } from "@/components/ui";

type Envelope = { success: boolean; error?: string | null };

export default function NewAssetPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [assetType, setAssetType] = useState("fund");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    if (!name.trim()) {
      setError("Asset name is required.");
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/assets", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name, asset_type: assetType }),
      });
      const payload = (await response.json()) as Envelope;
      if (!response.ok || !payload.success) {
        throw new Error(payload.error || "Failed to create asset.");
      }
      router.push("/assets");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create asset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Asset registry" title="Create asset" description="Create a new asset in backend registry." />
      <SectionCard title="Asset form">
        <div className="grid gap-4">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Asset name" className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none" />
          <select value={assetType} onChange={(e) => setAssetType(e.target.value)} className="w-full rounded-xl border border-border bg-surface-soft px-4 py-3 text-sm text-foreground outline-none">
            <option value="fund">fund</option>
            <option value="debt">debt</option>
            <option value="equity">equity</option>
            <option value="revenue-share">revenue-share</option>
          </select>
          <div className="flex gap-3">
            <Button onClick={() => void submit()} disabled={busy}>{busy ? "Creating..." : "Create asset"}</Button>
            <Button variant="secondary" href="/assets">Cancel</Button>
          </div>
        </div>
      </SectionCard>
      {error ? <InlineNotice title="Create asset failed" description={error} tone="danger" /> : null}
    </div>
  );
}
