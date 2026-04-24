import { ethers } from "hardhat";
import fs from "fs";
import path from "path";

type DeploymentShape = {
  contracts: {
    ConfidentialRWAToken: string;
    DisclosureRegistry: string;
    TransferController: string;
    AuditAnchor: string;
  };
};

function loadDeployments(): DeploymentShape {
  const deploymentsPath = path.join(__dirname, "..", "deployments", "arbitrumSepolia.json");
  return JSON.parse(fs.readFileSync(deploymentsPath, "utf8")) as DeploymentShape;
}

function explorerTxUrl(hash: string): string {
  return `https://sepolia.arbiscan.io/tx/${hash}`;
}

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const deployment = loadDeployments();

  const disclosure = await ethers.getContractAt("DisclosureRegistry", deployment.contracts.DisclosureRegistry, signer);
  const audit = await ethers.getContractAt("AuditAnchor", deployment.contracts.AuditAnchor, signer);
  const token = await ethers.getContractAt("ConfidentialRWAToken", deployment.contracts.ConfidentialRWAToken, signer);

  const grantee = "0x000000000000000000000000000000000000dEaD";
  const dataId = ethers.keccak256(ethers.toUtf8Bytes("proof:disclosure:arbitrum-sepolia"));
  const expiresAt = 0;
  const metadata = "ipfs://proof/disclosure/arbitrum-sepolia";

  const grantTx = await disclosure.grantDisclosure(dataId, grantee, expiresAt, metadata);
  const grantReceipt = await grantTx.wait();

  const requireRoleTx = await audit.setRequireSubmitterRole(true);
  const requireRoleReceipt = await requireRoleTx.wait();

  const setSubmitterTx = await audit.setSubmitter(signer.address, true);
  const setSubmitterReceipt = await setSubmitterTx.wait();

  const anchorHash = ethers.keccak256(ethers.toUtf8Bytes("proof-anchor:arbitrum-sepolia:v1"));
  const anchorMetadata = "ipfs://proof/audit-anchor/arbitrum-sepolia";
  const commitAnchorTx = await audit.commitAnchor(anchorHash, anchorMetadata);
  const commitAnchorReceipt = await commitAnchorTx.wait();

  const now = Math.floor(Date.now() / 1000);
  const until = now + 7 * 24 * 60 * 60;
  const setOperatorTx = await token.setOperator(deployment.contracts.TransferController, until);
  const setOperatorReceipt = await setOperatorTx.wait();

  const isOperator = await token.isOperator(signer.address, deployment.contracts.TransferController);
  const hasDisclosure = await disclosure.hasDisclosure(dataId, grantee);

  const result = {
    network: network.name,
    chainId: Number(network.chainId),
    signer: signer.address,
    steps: {
      grantDisclosure: {
        txHash: grantTx.hash,
        blockNumber: grantReceipt?.blockNumber ?? null,
        status: grantReceipt?.status ?? null,
        gasUsed: grantReceipt?.gasUsed.toString() ?? null,
        explorerUrl: explorerTxUrl(grantTx.hash)
      },
      setRequireSubmitterRole: {
        txHash: requireRoleTx.hash,
        blockNumber: requireRoleReceipt?.blockNumber ?? null,
        status: requireRoleReceipt?.status ?? null,
        gasUsed: requireRoleReceipt?.gasUsed.toString() ?? null,
        explorerUrl: explorerTxUrl(requireRoleTx.hash)
      },
      setSubmitter: {
        txHash: setSubmitterTx.hash,
        blockNumber: setSubmitterReceipt?.blockNumber ?? null,
        status: setSubmitterReceipt?.status ?? null,
        gasUsed: setSubmitterReceipt?.gasUsed.toString() ?? null,
        explorerUrl: explorerTxUrl(setSubmitterTx.hash)
      },
      commitAnchor: {
        txHash: commitAnchorTx.hash,
        blockNumber: commitAnchorReceipt?.blockNumber ?? null,
        status: commitAnchorReceipt?.status ?? null,
        gasUsed: commitAnchorReceipt?.gasUsed.toString() ?? null,
        explorerUrl: explorerTxUrl(commitAnchorTx.hash)
      },
      setOperator: {
        txHash: setOperatorTx.hash,
        blockNumber: setOperatorReceipt?.blockNumber ?? null,
        status: setOperatorReceipt?.status ?? null,
        gasUsed: setOperatorReceipt?.gasUsed.toString() ?? null,
        explorerUrl: explorerTxUrl(setOperatorTx.hash)
      }
    },
    checks: {
      hasDisclosure,
      isOperator
    }
  };

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
