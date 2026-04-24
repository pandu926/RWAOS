# Business Flow Proof

Timestamp (UTC): 2026-04-23T11:13:59Z

Source of truth:
- Deployment + proof artifact: `contracts/deployments/onchain-proof-latest.json`
- On-chain run: `docs/onchain-proof.md`
- Runtime checks: `docs/runtime-proof.md`

## Flow Matrix

| Flow | Verification Method | Status | Evidence |
|---|---|---|---|
| 1) Onboarding + disclosure setup | `DisclosureRegistry` on-chain tx + runtime `/disclosures` API | PASS | On-chain disclosure tx `0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe`; runtime endpoint returns 3 seeded records |
| 2) Confidential mint | `ConfidentialRWAToken.mint(...)` on-chain tx | PASS | Tx `0x20b1b3abaef72509494b6d8c21a3c944a1e962b67264c8a609d43e64a86efac2` |
| 3) Direct confidential transfer | `ERC7984` direct transfer path | PASS | Tx `0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428` |
| 4) Confidential transfer via controller | `TransferController` path | PASS | Tx `0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad` |
| 5) Audit anchoring | `AuditAnchor.commitAnchor(...)` on-chain tx + runtime `/audit/events` | PASS | Tx `0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b`; runtime endpoint returns seeded audit events |

## Latest Contract Addresses

- `ConfidentialRWAToken`: `0x00094fc240029a342fB1152bBc7a15F73C7142C2`
- `DisclosureRegistry`: `0x5118aEC317dC21361Cad981944532F1f90D7aBb8`
- `TransferController`: `0x049B1712B9E624a01Eb4C40d10aBF42E89a14314`
- `AuditAnchor`: `0x79279257A998d3a5E26B70cb538b09fEe2f90174`

## Runtime Business Data Validation

Verified from frontend container to backend with bearer token:
- `/assets` -> `success: true`, 5 records
- `/investors` -> `success: true`, 5 records
- `/transfers` -> `success: true`, 4 records
- `/disclosures` -> `success: true`, 3 records
- `/audit/events` -> `success: true`, 4 records

## Conclusion

- Business flow is proven end-to-end for disclosure, mint, direct confidential transfer, controller-mediated confidential transfer, and audit anchor.
- The proof pack now aligns with the latest on-chain artifact and runtime verification documents.
