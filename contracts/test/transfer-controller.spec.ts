import { expect } from "chai";
import { ethers } from "hardhat";

describe("TransferController", function () {
  async function deployFixture() {
    const [owner, initiator, receiver] = await ethers.getSigners();

    const disclosureFactory = await ethers.getContractFactory("DisclosureRegistry");
    const disclosure = await disclosureFactory.deploy();
    await disclosure.waitForDeployment();

    const mockTokenFactory = await ethers.getContractFactory("MockControllerToken");
    const mockToken = await mockTokenFactory.deploy();
    await mockToken.waitForDeployment();

    const controllerFactory = await ethers.getContractFactory("TransferController");
    const controller = await controllerFactory.deploy(await mockToken.getAddress(), await disclosure.getAddress());
    await controller.waitForDeployment();

    return { owner, initiator, receiver, disclosure, mockToken, controller };
  }

  it("succeeds via controller when disclosure and operator are present", async function () {
    const { owner, initiator, receiver, disclosure, mockToken, controller } = await deployFixture();
    const dataId = ethers.keccak256(ethers.toUtf8Bytes("controller-success"));
    const encryptedAmount = ethers.keccak256(ethers.toUtf8Bytes("enc-amount"));
    const inputProof = "0x12345678";

    await disclosure.connect(owner).grantDisclosure(dataId, initiator.address, 0, "ipfs://grant");
    await mockToken.setOperatorStatus(owner.address, await controller.getAddress(), true);

    await expect(
      controller
        .connect(initiator)
        .confidentialTransferFromWithDisclosure(owner.address, receiver.address, encryptedAmount, inputProof, dataId)
    ).to.emit(controller, "ConfidentialTransferRequested");

    expect(await mockToken.lastCaller()).to.equal(await controller.getAddress());
    expect(await mockToken.lastFrom()).to.equal(owner.address);
    expect(await mockToken.lastTo()).to.equal(receiver.address);
    expect(await mockToken.lastEncryptedAmount()).to.equal(encryptedAmount);
    expect(await mockToken.lastInputProof()).to.equal("0x");
  });

  it("reverts when disclosure is missing", async function () {
    const { owner, initiator, receiver, mockToken, controller } = await deployFixture();
    const dataId = ethers.keccak256(ethers.toUtf8Bytes("controller-missing-disclosure"));

    await mockToken.setOperatorStatus(owner.address, await controller.getAddress(), true);

    await expect(
      controller
        .connect(initiator)
        .confidentialTransferFromWithDisclosure(owner.address, receiver.address, ethers.ZeroHash, "0x", dataId)
    ).to.be.revertedWith("TransferController: disclosure required");
  });

  it("reverts when operator permission is missing", async function () {
    const { owner, initiator, receiver, disclosure, controller } = await deployFixture();
    const dataId = ethers.keccak256(ethers.toUtf8Bytes("controller-missing-operator"));

    await disclosure.connect(owner).grantDisclosure(dataId, initiator.address, 0, "ipfs://grant");

    await expect(
      controller
        .connect(initiator)
        .confidentialTransferFromWithDisclosure(owner.address, receiver.address, ethers.ZeroHash, "0x", dataId)
    ).to.be.revertedWith("TransferController: operator missing");
  });

  it("emits compliance passport event on passport flow", async function () {
    const { owner, initiator, receiver, disclosure, mockToken, controller } = await deployFixture();
    const dataId = ethers.keccak256(ethers.toUtf8Bytes("controller-passport-disclosure"));
    const transferId = ethers.keccak256(ethers.toUtf8Bytes("transfer-001"));
    const policyHash = ethers.keccak256(ethers.toUtf8Bytes("policy-001"));
    const anchorHash = ethers.keccak256(ethers.toUtf8Bytes("anchor-001"));

    await disclosure.connect(owner).grantDisclosure(dataId, initiator.address, 0, "ipfs://passport");
    await mockToken.setOperatorStatus(owner.address, await controller.getAddress(), true);

    await expect(
      controller.connect(initiator).confidentialTransferFromWithPassport(
        owner.address,
        receiver.address,
        ethers.keccak256(ethers.toUtf8Bytes("enc-passport")),
        "0x",
        dataId,
        transferId,
        policyHash,
        anchorHash
      )
    )
      .to.emit(controller, "CompliancePassportIssued")
      .withArgs(transferId, dataId, policyHash, anchorHash, initiator.address);
  });
});
