import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { injectedWallet } from "@rainbow-me/rainbowkit/wallets";
import { createConfig, http } from "wagmi";
import { arbitrumSepolia } from "wagmi/chains";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Browser Wallet",
      wallets: [injectedWallet],
    },
  ],
  {
    appName: "Confidential RWA OS",
    projectId: "injected-only",
  },
);

export const wagmiConfig = createConfig({
  chains: [arbitrumSepolia],
  connectors,
  transports: {
    [arbitrumSepolia.id]: http(),
  },
  ssr: true,
});
