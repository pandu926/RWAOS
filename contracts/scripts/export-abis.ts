import fs from "node:fs";
import path from "node:path";

type ContractName =
  | "ConfidentialRWAToken"
  | "DisclosureRegistry"
  | "TransferController"
  | "SettlementVault"
  | "AuditAnchor"
  | "TenantFactory";

const contracts: ContractName[] = [
  "ConfidentialRWAToken",
  "DisclosureRegistry",
  "TransferController",
  "SettlementVault",
  "AuditAnchor",
  "TenantFactory"
];

function main() {
  const rootDir = path.resolve(__dirname, "..");
  const artifactsDir = path.join(rootDir, "artifacts", "contracts");
  const outputDir = path.join(rootDir, "deployments", "abi");

  fs.mkdirSync(outputDir, { recursive: true });

  for (const contractName of contracts) {
    const artifactPath = path.join(
      artifactsDir,
      `${contractName}.sol`,
      `${contractName}.json`
    );
    const artifactRaw = fs.readFileSync(artifactPath, "utf-8");
    const artifact = JSON.parse(artifactRaw) as { abi: unknown };
    const outputPath = path.join(outputDir, `${contractName}.json`);
    fs.writeFileSync(outputPath, `${JSON.stringify(artifact.abi, null, 2)}\n`, "utf-8");
    console.log(`Exported ABI: ${outputPath}`);
  }
}

main();
