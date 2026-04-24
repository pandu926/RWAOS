import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentShape = {
  contracts: {
    ConfidentialRWAToken: string;
    TransferController: string;
  };
};

function loadDeployments(): DeploymentShape {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "arbitrumSepolia.json");
  return JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as DeploymentShape;
}

function extractErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

async function main() {
  const [signer] = await ethers.getSigners();
  const deployment = loadDeployments();

  const token = await ethers.getContractAt("ConfidentialRWAToken", deployment.contracts.ConfidentialRWAToken, signer);
  const controller = await ethers.getContractAt("TransferController", deployment.contracts.TransferController, signer);

  // Placeholder external encrypted handle and proof intentionally invalid.
  // This is used to prove the execution blocker without fabricating confidential inputs.
  const invalidExternalAmount = "0x0000000000000000000000000000000000000000000000000000000000000000";
  const invalidInputProof = "0x";
  const disclosureDataId = ethers.keccak256(ethers.toUtf8Bytes("proof:disclosure:arbitrum-sepolia"));

  const output: Record<string, unknown> = {
    signer: signer.address,
    attempts: {
      mint: null,
      confidentialTransferFromWithDisclosure: null
    },
    blocker:
      "Valid NOX confidential operation requires SDK-generated externalEuint256 + inputProof. This repository does not include a configured NOX handle/proof generation runtime in scripts."
  };

  try {
    const mintTx = await token.mint(signer.address, invalidExternalAmount, invalidInputProof);
    const mintReceipt = await mintTx.wait();
    output.attempts = {
      ...(output.attempts as object),
      mint: {
        txHash: mintTx.hash,
        blockNumber: mintReceipt?.blockNumber ?? null,
        status: mintReceipt?.status ?? null,
        gasUsed: mintReceipt?.gasUsed.toString() ?? null
      }
    };
  } catch (error) {
    output.attempts = {
      ...(output.attempts as object),
      mint: {
        status: "failed",
        error: extractErrorMessage(error)
      }
    };
  }

  try {
    const transferTx = await controller.confidentialTransferFromWithDisclosure(
      signer.address,
      "0x000000000000000000000000000000000000dEaD",
      invalidExternalAmount,
      invalidInputProof,
      disclosureDataId
    );
    const transferReceipt = await transferTx.wait();
    output.attempts = {
      ...(output.attempts as object),
      confidentialTransferFromWithDisclosure: {
        txHash: transferTx.hash,
        blockNumber: transferReceipt?.blockNumber ?? null,
        status: transferReceipt?.status ?? null,
        gasUsed: transferReceipt?.gasUsed.toString() ?? null
      }
    };
  } catch (error) {
    output.attempts = {
      ...(output.attempts as object),
      confidentialTransferFromWithDisclosure: {
        status: "failed",
        error: extractErrorMessage(error)
      }
    };
  }

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
