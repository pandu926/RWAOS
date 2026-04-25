import { createPublicClient, http } from "viem";

import { chainConfig } from "@/lib/web3/contracts";

export const web3PublicClient = createPublicClient({
  transport: http(chainConfig.rpcUrl),
});
