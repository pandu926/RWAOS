# Submission Pack Draft — iExec Vibe Coding Challenge

## 1) Public Repository

- Repo URL: `<ADD_PUBLIC_REPO_URL>`
- Branch/tag for submission snapshot: `<ADD_TAG_OR_COMMIT>`

## 2) Demo Video (<= 4 minutes)

- Video URL: `<ADD_VIDEO_URL>`
- Duration target: `<= 4:00`
- Content checklist:
  - Problem statement (DeFi/RWA privacy)
  - Architecture (Frontend + Backend + NOX/ERC-7984 contracts)
  - Live flow demo (no mock)
  - Arbitrum Sepolia deployment proof
  - Closing impact statement

## 3) X Post Draft (Required by challenge)

Draft text:

```text
We built Confidential RWA OS for the iExec Vibe Coding Challenge.

Our app uses NOX + Confidential Tokens (ERC-7984) to enable privacy-preserving RWA/DeFi workflows with selective disclosure and audit anchoring.

✅ Deployed on Arbitrum Sepolia
✅ End-to-end app flow
✅ Open-source repo + docs

Demo: <VIDEO_URL>
Code: <GITHUB_REPO_URL>

@iEx_ec @Chain_GPT
#iExec #Nox #ConfidentialToken #Arbitrum #RWA #DeFi
```

## 4) Required Files Checklist

- [x] Root `README.md`
- [x] Root `feedback.md`
- [x] Hackathon requirement summary (`docs/iexec-vibe-coding-challenge.md`)
- [x] Runtime proof (`docs/runtime-proof.md`)
- [x] E2E proof (`docs/e2e-proof.md`)
- [ ] Final public repo URL filled
- [ ] Final demo video URL filled
- [ ] X post published

## 5) On-chain Deployment (Current)

- Network: Arbitrum Sepolia (`421614`)
- Proof artifact: `contracts/deployments/onchain-proof-latest.json`
- `ConfidentialRWAToken`: `0x00094fc240029a342fB1152bBc7a15F73C7142C2`
- `DisclosureRegistry`: `0x5118aEC317dC21361Cad981944532F1f90D7aBb8`
- `TransferController`: `0x049B1712B9E624a01Eb4C40d10aBF42E89a14314`
- `AuditAnchor`: `0x79279257A998d3a5E26B70cb538b09fEe2f90174`

## 6) Latest Proof Transactions

- `mint`: `0x20b1b3abaef72509494b6d8c21a3c944a1e962b67264c8a609d43e64a86efac2`
- `setOperator`: `0x7a217bfd657a94ba3dfc62213eaa05fd2e57c6ee42c100e3c28dff359cd44c3e`
- `disclosure`: `0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe`
- `directConfidentialTransfer`: `0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428`
- `confidentialTransferViaController`: `0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad`
- `auditAnchor`: `0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b`
