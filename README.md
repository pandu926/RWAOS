# Confidential RWA OS (iExec NOX / ERC-7984)

This repository contains a Confidential RWA prototype aligned to the iExec Vibe Coding Challenge requirements.

## Stack

- Frontend: Next.js + Tailwind
- Backend: Rust (Axum) + PostgreSQL
- Smart contracts: Hardhat + Solidity (NOX ERC-7984 aligned)
- Network target: Arbitrum Sepolia

## Run (Docker)

```bash
cd /root/RWAOS
docker compose up -d --build
```

Frontend: `http://127.0.0.1:3313`  
Backend (internal): `http://backend:8080`

## Contracts

```bash
cd /root/RWAOS/contracts
npm install
npm run compile
npm test
```

Arbitrum Sepolia deployment addresses are tracked in:

- `contracts/deployments/arbitrumSepolia.json`

## E2E and Runtime Proof

- E2E proof: `docs/e2e-proof.md`
- Runtime proof: `docs/runtime-proof.md`
- Hackathon requirements scan: `docs/hackathon-requirements-scan.md`
- Repo compliance scan: `docs/repo-compliance-scan.md`

## Submission Notes

- Challenge reference summary: `docs/iexec-vibe-coding-challenge.md`
- iExec tools feedback: `feedback.md`

