import fs from "fs";
import path from "path";
import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Deploying TenantFactory with: ${deployer.address}`);

  const factoryFactory = await ethers.getContractFactory("TenantFactory");
  const factory = await factoryFactory.deploy();
  await factory.waitForDeployment();

  const address = await factory.getAddress();
  const network = await ethers.provider.getNetwork();
  const output = {
    network: "arbitrumSepolia",
    chainId: Number(network.chainId),
    deployer: deployer.address,
    contracts: {
      TenantFactory: address,
    },
    timestamp: new Date().toISOString(),
  };

  const outputPath = path.resolve(__dirname, "..", "deployments", "tenantFactory.arbitrumSepolia.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`);

  console.log("TenantFactory:", address);
  console.log("Deployment file:", outputPath);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
