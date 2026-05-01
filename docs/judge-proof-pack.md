# Judge Proof Pack (Independent Validation)

Timestamp (UTC): 2026-04-23T13:51:25Z  
Owner request: re-run E2E/runtime checks, validate `/settings`, refresh judge docs, provide explicit PASS/FAIL matrix.

## Evidence Collected

1) Runtime stack

```bash
cd /root/RWAOS
docker compose ps
```

Outcome:
- `rwaos-backend` Up
- `rwaos-frontend` Up (`0.0.0.0:3389->3389/tcp`)
- `rwaos-postgres` Up (healthy)

2) Frontend E2E rerun

```bash
cd /root/RWAOS/frontend
E2E_BASE_URL=http://127.0.0.1:3389 npx playwright test
```

Outcome:
- Sandbox execution can fail due browser permission limits (`Operation not permitted`).
- Final verification rerun executed with required privileges: `7 passed`.

3) Runtime API checks from frontend container

```bash
docker compose exec frontend sh -lc "wget -qO- --header='Authorization: Bearer admin-token' http://backend:8080/assets"
docker compose exec frontend sh -lc "wget -qO- --header='Authorization: Bearer admin-token' http://backend:8080/investors"
docker compose exec frontend sh -lc "wget -qO- --header='Authorization: Bearer admin-token' http://backend:8080/transfers"
docker compose exec frontend sh -lc "wget -qO- --header='Authorization: Bearer admin-token' http://backend:8080/disclosures"
docker compose exec frontend sh -lc "wget -qO- --header='Authorization: Bearer admin-token' http://backend:8080/audit/events"
```

Outcome:
- All endpoints returned `success: true` with seeded business records.

4) Settings validation against latest deployment

```bash
cat /root/RWAOS/contracts/deployments/onchain-proof-latest.json
docker compose exec frontend sh -lc "wget -qO- http://127.0.0.1:3389/settings | grep -Eo 'Config status|421614|sepolia-rollup.arbitrum.io/rpc|0x00094fc240029a342fB1152bBc7a15F73C7142C2|0x5118aEC317dC21361Cad981944532F1f90D7aBb8|0x049B1712B9E624a01Eb4C40d10aBF42E89a14314|0x79279257A998d3a5E26B70cb538b09fEe2f90174'"
```

Outcome:
- Chain id `421614` found.
- Arbitrum Sepolia RPC string found.
- All 4 deployed addresses found and match the latest proof artifact JSON.

## Pass/Fail Matrix

| Area | Status | Notes |
|---|---|---|
| Docker runtime (frontend/backend/postgres) | PASS | Services are up and mapped correctly |
| Runtime API flow (assets/investors/transfers/disclosures/audit) | PASS | All return `success: true` |
| Settings page chain + address alignment | PASS | Matches latest Sepolia deployment |
| On-chain business flow pack | PASS | `docs/onchain-proof.md` and `contracts/deployments/onchain-proof-latest.json` agree on all contract addresses and proof tx hashes, including controller transfer `0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad` |
| Frontend E2E rerun (latest) | PASS | `E2E_BASE_URL=http://127.0.0.1:3389 npx playwright test` => `7 passed` |

## Current Blockers

- None for required proof flow. Sandbox-only browser limits are mitigated by privileged rerun evidence.

## Latest On-Chain Proof Artifact

- `ConfidentialRWAToken`: `0x00094fc240029a342fB1152bBc7a15F73C7142C2`
- `DisclosureRegistry`: `0x5118aEC317dC21361Cad981944532F1f90D7aBb8`
- `TransferController`: `0x049B1712B9E624a01Eb4C40d10aBF42E89a14314`
- `AuditAnchor`: `0x79279257A998d3a5E26B70cb538b09fEe2f90174`
- `mint`: `0x20b1b3abaef72509494b6d8c21a3c944a1e962b67264c8a609d43e64a86efac2`
- `setOperator`: `0x7a217bfd657a94ba3dfc62213eaa05fd2e57c6ee42c100e3c28dff359cd44c3e`
- `disclosure`: `0x96173766188c5ae79b7e9e58dba1013a7dd605a82f040f05649a842c5d4ccabe`
- `directConfidentialTransfer`: `0xbc8c669f48c8250d3bbdbe0425995677d007b6529c422e0802859dd81d788428`
- `confidentialTransferViaController`: `0xbe4aadadc73e772823cb758d79b0e7472ab89568face868aff0701e41852c5ad`
- `auditAnchor`: `0x0c094972a1f36b0725597cc98cfe9fbd3c7ea9f1b77312371ba6a98b7d638e5b`

## Updated Docs

- `/root/RWAOS/docs/onchain-proof.md`
- `/root/RWAOS/docs/business-flow-proof.md`
- `/root/RWAOS/docs/judge-proof-pack.md`
- `/root/RWAOS/docs/submission-pack.md`

## Artifact Paths

- Deployment metadata: `/root/RWAOS/contracts/deployments/onchain-proof-latest.json`
- E2E report: `/root/RWAOS/frontend/playwright-report/index.html`
- E2E last run metadata: `/root/RWAOS/frontend/test-results/.last-run.json`
- Runtime proof: `/root/RWAOS/docs/runtime-proof.md`
- Business flow proof: `/root/RWAOS/docs/business-flow-proof.md`
- On-chain proof: `/root/RWAOS/docs/onchain-proof.md`
