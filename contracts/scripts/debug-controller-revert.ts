import { ethers } from "hardhat";
import { createViemHandleClient } from "@iexec-nox/handle";
import { createWalletClient, http } from "viem";
import { arbitrumSepolia } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";
import fs from "node:fs";
import path from "node:path";

async function main() {
  const dep = JSON.parse(
    fs.readFileSync(path.resolve(__dirname, "..", "deployments", "arbitrumSepolia.json"), "utf8")
  );
  const [owner] = await ethers.getSigners();
  const receiver = ethers.Wallet.createRandom().address;
  const pk = process.env.PRIVATE_KEY as `0x${string}`;
  const rpc = process.env.ARBITRUM_SEPOLIA_RPC_URL ?? "https://sepolia-rollup.arbitrum.io/rpc";

  const walletClient = createWalletClient({
    account: privateKeyToAccount(pk),
    chain: arbitrumSepolia,
    transport: http(rpc),
  });
  const handleClient = await createViemHandleClient(walletClient);

  const token = await ethers.getContractAt("ConfidentialRWAToken", dep.contracts.ConfidentialRWAToken, owner);
  const disclosure = await ethers.getContractAt("DisclosureRegistry", dep.contracts.DisclosureRegistry, owner);
  const controller = await ethers.getContractAt("TransferController", dep.contracts.TransferController, owner);

  const mintEnc = await handleClient.encryptInput(111n, "uint256", dep.contracts.ConfidentialRWAToken);
  const tx1 = await token.mint(owner.address, mintEnc.handle, mintEnc.handleProof);
  await tx1.wait();

  const tx2 = await token.setOperator(dep.contracts.TransferController, BigInt(Math.floor(Date.now() / 1000) + 3600));
  await tx2.wait();

  const dataId = ethers.keccak256(ethers.toUtf8Bytes(`dbg-${Date.now()}`));
  const tx3 = await disclosure.grantDisclosure(dataId, owner.address, 0, "ipfs://dbg");
  await tx3.wait();

  const encToken = await handleClient.encryptInput(11n, "uint256", dep.contracts.ConfidentialRWAToken);
  const encController = await handleClient.encryptInput(11n, "uint256", dep.contracts.TransferController);

  try {
    await token["confidentialTransferFrom(address,address,bytes32,bytes)"](
      owner.address,
      receiver,
      encToken.handle,
      encToken.handleProof
    );
    console.log("direct transfer ok");
  } catch (e) {
    console.log("direct transfer fail", e);
  }

  try {
    await controller.confidentialTransferFromWithDisclosure(
      owner.address,
      receiver,
      encToken.handle,
      encToken.handleProof,
      dataId
    );
    console.log("controller transfer token-bound ok");
  } catch (e) {
    console.log("controller transfer token-bound fail");
    console.log(e);
  }

  try {
    await controller.confidentialTransferFromWithDisclosure(
      owner.address,
      receiver,
      encController.handle,
      encController.handleProof,
      dataId
    );
    console.log("controller transfer controller-bound ok");
  } catch (e) {
    console.log("controller transfer controller-bound fail");
    console.log(e);
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

