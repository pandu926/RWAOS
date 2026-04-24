import { expect } from "chai";
import { ethers } from "hardhat";
import { time } from "@nomicfoundation/hardhat-network-helpers";
import { anyValue } from "@nomicfoundation/hardhat-chai-matchers/withArgs";

describe("Confidential RWA OS prototype", function () {
  async function deployFixture() {
    const [owner, alice, bob, auditor] = await ethers.getSigners();

    const tokenFactory = await ethers.getContractFactory("ConfidentialRWAToken");
    const token = await tokenFactory.deploy();
    await token.waitForDeployment();

    const disclosureFactory = await ethers.getContractFactory("DisclosureRegistry");
    const disclosure = await disclosureFactory.deploy();
    await disclosure.waitForDeployment();

    const controllerFactory = await ethers.getContractFactory("TransferController");
    const controller = await controllerFactory.deploy(await token.getAddress(), await disclosure.getAddress());
    await controller.waitForDeployment();

    const auditFactory = await ethers.getContractFactory("AuditAnchor");
    const audit = await auditFactory.deploy(owner.address);
    await audit.waitForDeployment();

    return { owner, alice, bob, auditor, token, disclosure, controller, audit };
  }

  it("deploys ERC-7984 token and controller wiring", async function () {
    const { token, disclosure, controller } = await deployFixture();
    expect(await token.name()).to.equal("Confidential RWA Token");
    expect(await token.symbol()).to.equal("cRWA");
    expect(await controller.token()).to.equal(await token.getAddress());
    expect(await controller.disclosureRegistry()).to.equal(await disclosure.getAddress());
  });

  it("grants and revokes disclosure", async function () {
    const { alice, auditor, disclosure } = await deployFixture();
    const dataId = ethers.keccak256(ethers.toUtf8Bytes("audit:dataset:1"));
    const expiry = (await time.latest()) + 600;

    await disclosure.connect(alice).grantDisclosure(dataId, auditor.address, expiry, "ipfs://policy");
    expect(await disclosure.hasDisclosure(dataId, auditor.address)).to.equal(true);

    await disclosure.connect(alice).revokeDisclosure(dataId, auditor.address);
    expect(await disclosure.hasDisclosure(dataId, auditor.address)).to.equal(false);
  });

  it("commits an audit anchor record", async function () {
    const { owner, audit } = await deployFixture();
    const anchorHash = ethers.keccak256(ethers.toUtf8Bytes("audit-anchor-payload"));
    const uri = "ipfs://audit-anchor";

    await expect(audit.connect(owner).commitAnchor(anchorHash, uri))
      .to.emit(audit, "AnchorCommitted")
      .withArgs(1, anchorHash, owner.address, uri, anyValue);

    const record = await audit.anchors(1);
    expect(record.anchorHash).to.equal(anchorHash);
    expect(record.submitter).to.equal(owner.address);
    expect(record.metadataURI).to.equal(uri);
  });
});
