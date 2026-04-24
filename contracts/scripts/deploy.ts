import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying with: ${deployer.address}`);

  const tokenFactory = await ethers.getContractFactory("ConfidentialRWAToken");
  const token = await tokenFactory.deploy();
  await token.waitForDeployment();

  const disclosureFactory = await ethers.getContractFactory("DisclosureRegistry");
  const disclosureRegistry = await disclosureFactory.deploy();
  await disclosureRegistry.waitForDeployment();

  const controllerFactory = await ethers.getContractFactory("TransferController");
  const transferController = await controllerFactory.deploy(await token.getAddress(), await disclosureRegistry.getAddress());
  await transferController.waitForDeployment();

  const auditFactory = await ethers.getContractFactory("AuditAnchor");
  const auditAnchor = await auditFactory.deploy(deployer.address);
  await auditAnchor.waitForDeployment();

  console.log("ConfidentialRWAToken:", await token.getAddress());
  console.log("DisclosureRegistry:", await disclosureRegistry.getAddress());
  console.log("TransferController:", await transferController.getAddress());
  console.log("AuditAnchor:", await auditAnchor.getAddress());
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
