"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import { useAccount, useDisconnect, useSignMessage, useSwitchChain } from "wagmi";

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

type Eip1193Provider = {
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

function getProvider(): Eip1193Provider | null {
  if (typeof window === "undefined") {
    return null;
  }
  return (window as Window & { ethereum?: Eip1193Provider }).ethereum ?? null;
}

function getReadableError(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  if (typeof error === "object" && error !== null) {
    const maybe = error as { shortMessage?: string; details?: string; message?: string };
    return maybe.shortMessage || maybe.details || maybe.message || "Failed to connect wallet.";
  }
  return "Failed to connect wallet.";
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
  const { address, isConnected, chainId } = useAccount();
  const { disconnect } = useDisconnect();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<WalletSession | null>(() => getWalletSessionFromDocumentCookie());
  const autoAuthAddressRef = useRef<string | null>(null);

  const nextPath = searchParams.get("next") || "/dashboard";
  const isSessionActiveForConnectedAddress =
    !!session?.address && !!address && session.address.toLowerCase() === address.toLowerCase();

  async function authenticateWallet(authAddress: string): Promise<void> {
    if (!isAllowedWallet(authAddress)) {
      throw new Error("Wallet is not in the organization allowlist.");
    }

    if (chainId !== TARGET_CHAIN_ID) {
      try {
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      } catch (error) {
        const provider = getProvider();
        if (!provider) {
          throw error;
        }
        await provider.request({
          method: "wallet_addEthereumChain",
          params: [
            {
              chainId: TARGET_CHAIN_HEX,
              chainName: "Arbitrum Sepolia",
              rpcUrls: ["https://sepolia-rollup.arbitrum.io/rpc"],
              nativeCurrency: {
                name: "Ethereum",
                symbol: "ETH",
                decimals: 18,
              },
              blockExplorerUrls: ["https://sepolia.arbiscan.io"],
            },
          ],
        });
        await switchChainAsync({ chainId: TARGET_CHAIN_ID });
      }
    }

    const challengeResponse = await fetch("/api/auth/wallet/challenge", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ address: authAddress, chain_id: TARGET_CHAIN_ID }),
    });
    const challengePayload = (await challengeResponse.json()) as ChallengeEnvelope;
    if (!challengeResponse.ok || !challengePayload.success || !challengePayload.data?.message) {
      throw new Error(challengePayload.error || "Failed to request wallet challenge.");
    }

    const signature = await signMessageAsync({ message: challengePayload.data.message });
    if (!signature) {
      throw new Error("Wallet did not return a signature.");
    }

    const loginResponse = await fetch("/api/auth/wallet/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: authAddress,
        chain_id: TARGET_CHAIN_ID,
        signature,
      }),
    });

    const loginPayload = (await loginResponse.json()) as WalletLoginEnvelope;
    if (!loginResponse.ok || !loginPayload.success || !loginPayload.data?.token) {
      throw new Error(loginPayload.error || "Wallet login failed.");
    }

    const nextSession: WalletSession = {
      address: authAddress,
      chainId: TARGET_CHAIN_ID,
      role: loginPayload.data.role,
      token: loginPayload.data.token,
      connectedAt: new Date().toISOString(),
    };

    writeWalletSessionCookie(nextSession);
    setSession(nextSession);
    router.push(nextPath);
    router.refresh();
  }

  async function handleWalletAction(openConnectModal?: (() => void) | null) {
    setError(null);

    if (!isConnected || !address) {
      if (openConnectModal) {
        openConnectModal();
        return;
      }
      setError("No wallet connector available.");
      return;
    }

    setBusy(true);
    try {
      await authenticateWallet(address);
    } catch (error) {
      setError(getReadableError(error));
    } finally {
      setBusy(false);
    }
  }

  function handleDisconnect() {
    disconnect();
    clearWalletSessionCookie();
    setSession(null);
    setError(null);
    router.push("/login");
    router.refresh();
  }

  const triggerAutoAuth = useEffectEvent(() => {
    void handleWalletAction();
  });

  useEffect(() => {
    if (!isConnected || !address || busy || isSessionActiveForConnectedAddress) {
      return;
    }
    if (autoAuthAddressRef.current === address.toLowerCase()) {
      return;
    }

    autoAuthAddressRef.current = address.toLowerCase();
    triggerAutoAuth();
  }, [address, busy, isConnected, isSessionActiveForConnectedAddress]);

  if (mode === "header") {
    return (
      <ConnectButton.Custom>
        {({ account, openConnectModal }) => {
          const activeAddress = account?.address;
          const activeSession = session?.address?.toLowerCase() === activeAddress?.toLowerCase();
          if (activeSession && session) {
            return (
              <div className="flex items-center gap-2">
                <span className="hidden rounded-xl border border-border bg-surface-soft px-2.5 py-1.5 font-mono text-xs text-muted sm:inline-flex">
                  {`${session.address.slice(0, 6)}...${session.address.slice(-4)}`}
                </span>
                <Button variant="secondary" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </div>
            );
          }

          return (
            <Button
              icon="wallet"
              size="sm"
              onClick={() => {
                void handleWalletAction(openConnectModal);
              }}
              disabled={busy}
              className={className}
            >
              {busy ? "Connecting..." : "Connect Wallet"}
            </Button>
          );
        }}
      </ConnectButton.Custom>
    );
  }

  return (
    <div className={className}>
      <ConnectButton.Custom>
        {({ openConnectModal }) => (
          <Button
            icon="wallet"
            className="w-full justify-center"
            size="lg"
            onClick={() => {
              void handleWalletAction(openConnectModal);
            }}
            disabled={busy || (isConnected && isSessionActiveForConnectedAddress)}
          >
            {busy
              ? "Connecting..."
              : isSessionActiveForConnectedAddress
                ? "Connected"
                : "Connect wallet"}
          </Button>
        )}
      </ConnectButton.Custom>
      {error ? <p className="mt-3 text-center text-sm text-danger">{error}</p> : null}
    </div>
  );
}
