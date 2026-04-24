# Confidential RWA OS Contracts (NOX ERC-7984)

This module is aligned with iExec NOX confidential token patterns.

## Contracts

- `ConfidentialRWAToken.sol`
  - Uses `ERC7984` from `@iexec-nox/nox-confidential-contracts`
  - Owner-restricted `mint` / `burn` with encrypted inputs (`externalEuint256 + inputProof`)
- `TransferController.sol`
  - Uses `IERC7984.confidentialTransferFrom(...)`
  - Enforces disclosure grant gate via `DisclosureRegistry`
- `DisclosureRegistry.sol`
  - Grant/revoke disclosure rights for data IDs
- `AuditAnchor.sol`
  - Anchor immutable audit hashes and metadata

## Requirements

- Solidity `0.8.28`
- Hardhat + TypeScript
- Packages:
  - `@iexec-nox/nox-confidential-contracts`
  - `@iexec-nox/nox-protocol-contracts`

## Commands

```bash
cd /root/RWAOS/contracts
npm install
npm run compile
npm test
npm run export:abis
```

## Deployment

Local:

```bash
npx hardhat run scripts/deploy.ts
```

Arbitrum Sepolia:

```bash
PRIVATE_KEY=0x... \
ARBITRUM_SEPOLIA_RPC_URL=https://sepolia-rollup.arbitrum.io/rpc \
npx hardhat run scripts/deploy.ts --network arbitrumSepolia
```

Latest deployed addresses are recorded in:

- `deployments/arbitrumSepolia.json`

## Frontend ABI Sync

ABI export path:

- `deployments/abi/*.json`

Frontend ABI destination:

- `/root/RWAOS/frontend/lib/web3/abi/*.json`
