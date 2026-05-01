import { expect } from "chai";
import { ethers } from "hardhat";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("TenantFactory", function () {
  async function deployFixture() {
    const [, tenantOwner] = await ethers.getSigners();

    const factoryFactory = await ethers.getContractFactory("TenantFactory");
    const factory = await factoryFactory.deploy();
    await factory.waitForDeployment();

    return { tenantOwner, factory };
  }

  function parseTenantBundleCreated(factory: Awaited<ReturnType<typeof deployFixture>>["factory"], logs: readonly unknown[]) {
    for (const log of logs) {
      try {
        const parsed = factory.interface.parseLog(log as Parameters<typeof factory.interface.parseLog>[0]);
        if (parsed?.name === "TenantBundleCreated") {
          return parsed.args;
        }
      } catch {
        // Ignore logs emitted by child contracts during bundle creation.
      }
    }

    throw new Error("TenantBundleCreated event not found");
  }

  it("deploys a tenant bundle owned by the requested user and wires the controller", async function () {
    const { tenantOwner, factory } = await deployFixture();

    const tx = await factory.createTenantBundle(tenantOwner.address);

    await expect(tx)
      .to.emit(factory, "TenantBundleCreated")
      .withArgs(tenantOwner.address, anyValue, anyValue, anyValue, anyValue);

    const receipt = await tx.wait();
    const eventArgs = parseTenantBundleCreated(factory, receipt?.logs ?? []);
    const [, tokenAddress, registryAddress, controllerAddress, auditAnchorAddress] = eventArgs;

    for (const deployedAddress of [tokenAddress, registryAddress, controllerAddress, auditAnchorAddress]) {
      expect(ethers.isAddress(deployedAddress)).to.equal(true);
      expect(deployedAddress).to.not.equal(ethers.ZeroAddress);
    }

    const token = await ethers.getContractAt("ConfidentialRWAToken", tokenAddress);
    const auditAnchor = await ethers.getContractAt("AuditAnchor", auditAnchorAddress);
    const controller = await ethers.getContractAt("TransferController", controllerAddress);

    expect(await token.owner()).to.equal(tenantOwner.address);
    expect(await auditAnchor.owner()).to.equal(tenantOwner.address);
    expect(await controller.token()).to.equal(tokenAddress);
    expect(await controller.disclosureRegistry()).to.equal(registryAddress);
  });

  it("deploys a tenant settlement bundle with a vault authorized to mint confidential settlement tokens", async function () {
    const { tenantOwner, factory } = await deployFixture();
    const usdtFactory = await ethers.getContractFactory("MockUSDT");
    const usdt = await usdtFactory.deploy();
    await usdt.waitForDeployment();

    const tx = await factory.createTenantSettlementBundle(tenantOwner.address, await usdt.getAddress());

    await expect(tx)
      .to.emit(factory, "TenantSettlementBundleCreated")
      .withArgs(tenantOwner.address, await usdt.getAddress(), anyValue, anyValue, anyValue, anyValue, anyValue);

    const receipt = await tx.wait();
    const parsed = receipt?.logs
      .map((log) => {
        try {
          return factory.interface.parseLog(log);
        } catch {
          return null;
        }
      })
      .find((event) => event?.name === "TenantSettlementBundleCreated");

    if (!parsed) {
      throw new Error("TenantSettlementBundleCreated event not found");
    }

    const [, settlementAsset, tokenAddress, registryAddress, controllerAddress, auditAnchorAddress, vaultAddress] = parsed.args;
    const token = await ethers.getContractAt("ConfidentialRWAToken", tokenAddress);
    const vault = await ethers.getContractAt("SettlementVault", vaultAddress);

    for (const deployedAddress of [settlementAsset, tokenAddress, registryAddress, controllerAddress, auditAnchorAddress, vaultAddress]) {
      expect(ethers.isAddress(deployedAddress)).to.equal(true);
      expect(deployedAddress).to.not.equal(ethers.ZeroAddress);
    }

    expect(await token.owner()).to.equal(tenantOwner.address);
    expect(await token.isAuthorizedMinter(vaultAddress)).to.equal(true);
    expect(await vault.settlementAsset()).to.equal(await usdt.getAddress());
    expect(await vault.confidentialToken()).to.equal(tokenAddress);
  });
});
