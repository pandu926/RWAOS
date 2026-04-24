"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui";
import {
  type WalletSession,
  clearWalletSessionCookie,
  getWalletSessionFromDocumentCookie,
  isAllowedWallet,
  writeWalletSessionCookie,
} from "@/lib/web3/session";

const TARGET_CHAIN_ID = 421614;
const TARGET_CHAIN_HEX = "0x66eee";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

type ChallengeEnvelope = {
  success: boolean;
  data?: { message: string; nonce: string };
  error?: string | null;
};

type WalletLoginEnvelope = {
  success: boolean;
  data?: { token: string; role: "admin" | "operator" | "auditor" };
  error?: string | null;
};

function getEthereum(): EthereumProvider | null {
  if (typeof window === "undefined") {
    return null;
  }

  return (window as Window & { ethereum?: EthereumProvider }).ethereum ?? null;
}

async function ensureTargetChain(ethereum: EthereumProvider): Promise<void> {
  const chainIdHex = (await ethereum.request({ method: "eth_chainId" })) as string;
  const currentChainId = Number.parseInt(chainIdHex, 16);

  if (currentChainId === TARGET_CHAIN_ID) {
    return;
  }

  await ethereum.request({
    method: "wallet_switchEthereumChain",
    params: [{ chainId: TARGET_CHAIN_HEX }],
  });
}

async function requestConnectedAddress(ethereum: EthereumProvider): Promise<string> {
  const accounts = (await ethereum.request({
    method: "eth_requestAccounts",
  })) as string[];

  if (!Array.isArray(accounts) || accounts.length === 0) {
    throw new Error("Wallet did not return an address.");
  }

  return accounts[0]!;
}

async function signLoginMessage(ethereum: EthereumProvider, address: string, message: string): Promise<string> {
  const signature = (await ethereum.request({
    method: "personal_sign",
    params: [message, address],
  })) as string;

  if (!signature) {
    throw new Error("Wallet did not return a signature.");
  }

  return signature;
}

export function WalletConnectButton({
  mode = "header",
  className,
}: {
  mode?: "header" | "login";
  className?: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession | null>(() => getWalletSessionFromDocumentCookie());

  const nextPath = searchParams.get("next") || "/dashboard";

  async function connect() {
    setError(null);
    setBusy(true);

    try {
      const ethereum = getEthereum();
      if (!ethereum) {
        throw new Error("No wallet detected. Install MetaMask or another EVM wallet.");
      }

      const address = await requestConnectedAddress(ethereum);
      if (!isAllowedWallet(address)) {
        throw new Error("Wallet is not in the organization allowlist.");
      }

      await ensureTargetChain(ethereum);

      const challengeResponse = await fetch("/api/auth/wallet/challenge", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ address, chain_id: TARGET_CHAIN_ID }),
      });
      const challengePayload = (await challengeResponse.json()) as ChallengeEnvelope;
      if (!challengeResponse.ok || !challengePayload.success || !challengePayload.data?.message) {
        throw new Error(challengePayload.error || "Failed to get wallet challenge.");
      }

      const signature = await signLoginMessage(ethereum, address, challengePayload.data.message);
      const loginResponse = await fetch("/api/auth/wallet/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          address,
          chain_id: TARGET_CHAIN_ID,
          signature,
        }),
      });
      const loginPayload = (await loginResponse.json()) as WalletLoginEnvelope;
      if (!loginResponse.ok || !loginPayload.success || !loginPayload.data?.token) {
        throw new Error(loginPayload.error || "Wallet login failed.");
      }

      const nextSession: WalletSession = {
        address,
        chainId: TARGET_CHAIN_ID,
        role: loginPayload.data.role,
        token: loginPayload.data.token,
        connectedAt: new Date().toISOString(),
      };

      writeWalletSessionCookie(nextSession);
      setSession(nextSession);
      router.push(nextPath);
      router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to connect wallet.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  function disconnect() {
    clearWalletSessionCookie();
    setSession(null);
    setError(null);
    router.push("/login");
    router.refresh();
  }

  if (mode === "header") {
    if (session) {
      return (
        <div className="flex items-center gap-2">
          <span className="hidden rounded-xl border border-border bg-surface-soft px-2.5 py-1.5 font-mono text-xs text-muted sm:inline-flex">
            {`${session.address.slice(0, 6)}...${session.address.slice(-4)}`}
          </span>
          <Button variant="secondary" size="sm" onClick={disconnect}>
            Disconnect
          </Button>
        </div>
      );
    }

    return (
      <Button icon="wallet" size="sm" onClick={connect} disabled={busy} className={className}>
        {busy ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  return (
    <div className={className}>
      <Button icon="wallet" className="w-full justify-center" size="lg" onClick={connect} disabled={busy}>
        {busy ? "Connecting..." : "Connect wallet"}
      </Button>
      {error ? <p className="mt-3 text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}
