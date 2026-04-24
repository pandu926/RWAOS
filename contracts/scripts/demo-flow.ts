import { ethers } from "hardhat";

async function main() {
  const [owner, alice, bob] = await ethers.getSigners();
  console.log(`Owner: ${owner.address}`);

  const tokenFactory = await ethers.getContractFactory("ConfidentialRWAToken");
  const token = await tokenFactory.deploy();
  await token.waitForDeployment();

  const disclosureFactory = await ethers.getContractFactory("DisclosureRegistry");
  const disclosureRegistry = await disclosureFactory.deploy();
  await disclosureRegistry.waitForDeployment();

  const controllerFactory = await ethers.getContractFactory("TransferController");
  const transferController = await controllerFactory.deploy(await token.getAddress(), await disclosureRegistry.getAddress());
  await transferController.waitForDeployment();

  const dataId = ethers.keccak256(ethers.toUtf8Bytes("demo-disclosure"));
  await disclosureRegistry.connect(alice).grantDisclosure(dataId, bob.address, 0, "ipfs://demo-grant");

  console.log("Token:", await token.getAddress());
  console.log("DisclosureRegistry:", await disclosureRegistry.getAddress());
  console.log("TransferController:", await transferController.getAddress());
  console.log("Disclosure grant active for bob:", await disclosureRegistry.hasDisclosure(dataId, bob.address));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
