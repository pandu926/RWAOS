import fs from "node:fs";
import path from "node:path";
import { ethers } from "hardhat";
import { createViemHandleClient } from "@iexec-nox/handle";
import { createWalletClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

type DeploymentFile = {
  chainId: number;
  contracts: {
    ConfidentialRWAToken: string;
    DisclosureRegistry: string;
    TransferController: string;
    AuditAnchor: string;
  };
};

async function main() {
  const deploymentPath = path.resolve(__dirname, "..", "deployments", "arbitrumSepolia.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8")) as DeploymentFile;

  const [owner] = await ethers.getSigners();
  const receiverAddress = ethers.Wallet.createRandom().address;
  const privateKey = process.env.PRIVATE_KEY as `0x${string}` | undefined;
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";
  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in env");
  }

  const walletClient = createWalletClient({
    account: privateKeyToAccount(privateKey),
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const handleClient = await createViemHandleClient(walletClient);

  const token = await ethers.getContractAt("ConfidentialRWAToken", deployment.contracts.ConfidentialRWAToken, owner);
  const disclosure = await ethers.getContractAt("DisclosureRegistry", deployment.contracts.DisclosureRegistry, owner);
  const controller = await ethers.getContractAt("TransferController", deployment.contracts.TransferController, owner);
  const audit = await ethers.getContractAt("AuditAnchor", deployment.contracts.AuditAnchor, owner);

  const mintEncrypted = await handleClient.encryptInput(500n, "uint256", deployment.contracts.ConfidentialRWAToken);
  const transferEncrypted = await handleClient.encryptInput(125n, "uint256", deployment.contracts.ConfidentialRWAToken);
  const transferEncryptedForController = await handleClient.encryptInput(
    75n,
    "uint256",
    deployment.contracts.TransferController
  );

  const txs: Record<string, unknown> = {};

  const dataId = ethers.keccak256(ethers.toUtf8Bytes(`proof-disclosure-${Date.now()}`));
  const anchorHash = ethers.keccak256(ethers.toUtf8Bytes(`proof-anchor-${Date.now()}`));

  async function runStep(name: string, fn: () => Promise<{ hash: string; wait: () => Promise<{ blockNumber: number; status: number; gasUsed?: bigint }> }>) {
    try {
      const tx = await fn();
      const rcpt = await tx.wait();
      txs[name] = {
        ok: true,
        hash: tx.hash,
        blockNumber: rcpt?.blockNumber ?? null,
        status: rcpt?.status ?? null,
        gasUsed: rcpt?.gasUsed?.toString?.() ?? null,
      };
    } catch (error) {
      txs[name] = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  await runStep("mint", async () => token.mint(owner.address, mintEncrypted.handle, mintEncrypted.handleProof));

  const operatorUntil = BigInt(Math.floor(Date.now() / 1000) + 3600);
  await runStep("setOperator", async () => token.setOperator(deployment.contracts.TransferController, operatorUntil));

  await runStep("disclosure", async () =>
    disclosure.grantDisclosure(dataId, owner.address, 0, "ipfs://proof-disclosure")
  );

  await runStep("directConfidentialTransfer", async () =>
    token["confidentialTransferFrom(address,address,bytes32,bytes)"](
      owner.address,
      receiverAddress,
      transferEncrypted.handle,
      transferEncrypted.handleProof
    )
  );

  await runStep("confidentialTransferViaController", async () =>
    controller.confidentialTransferFromWithDisclosure(
      owner.address,
      receiverAddress,
      transferEncryptedForController.handle,
      transferEncryptedForController.handleProof,
      dataId
    )
  );

  await runStep("auditAnchor", async () => audit.commitAnchor(anchorHash, "ipfs://proof-anchor"));

  const output = {
    network: "arbitrumSepolia",
    chainId: deployment.chainId,
    owner: owner.address,
    receiver: receiverAddress,
    contracts: deployment.contracts,
    txs,
  };

  const outPath = path.resolve(__dirname, "..", "deployments", "onchain-proof-latest.json");
  fs.writeFileSync(outPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
