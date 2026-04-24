# Confidential RWA OS — Backend & Smart Contract Implementation Plan

## 1. Objective

Deliver a production-oriented backend and smart-contract stack that powers the existing 12-page frontend with real workflows for:
- confidential asset lifecycle,
- private transfer execution,
- selective disclosure controls,
- audit-grade event history.

This plan aligns with the existing blueprint constraints:
- frontend: React (already implemented),
- backend: Rust + Axum,
- database: PostgreSQL,
- architecture: modular monolith first, service split later only if required.

## 2. Scope and Delivery Strategy

### In scope (MVP execution scope)
- Full API surface for current frontend routes.
- RBAC-based authentication and authorization.
- Asset, investor, transfer, disclosure, audit, report, and settings modules.
- Smart-contract layer for confidential token workflows.
- Chain event ingestion and state reconciliation.
- Structured audit trail with immutable append-only behavior.

### Out of scope (deferred)
- Full multi-tenant isolation at infrastructure level.
- Complex ABAC/policy engine.
- Advanced cross-chain settlement orchestration.
- Institutional SSO integrations (unless buyer-mandated).

## 3. Target System Architecture

### Backend (Rust + Axum modular monolith)
- `identity_access`: auth, sessions/JWT, RBAC guards.
- `asset_registry`: asset definitions, status lifecycle.
- `investor_registry`: investor records, whitelist, eligibility checks.
- `transfer_ops`: transfer request state machine + preflight rules.
- `disclosure_mgmt`: grant/revoke/request access flows.
- `audit_reporting`: event ledger, report generation endpoints.
- `chain_integration`: contract calls, event indexer, retries.
- `jobs`: asynchronous workers (PostgreSQL-backed queue tables).

### Data layer (PostgreSQL)
- Core tables: `users`, `roles`, `permissions`, `assets`, `investors`, `transfer_requests`, `transfer_events`, `disclosure_grants`, `audit_logs`, `integration_jobs`, `system_events`.
- Principles:
  - immutable event tables where possible,
  - idempotency keys on sensitive operations,
  - JSONB only for non-critical extensibility.

### Chain layer
- Confidential token contracts (Nox-based option).
- Transfer executor/manager contract.
- Disclosure permission registry contract.
- Audit anchor contract (hash commitments for tamper evidence).

## 4. API-to-Frontend Route Mapping

- `/login` -> `POST /auth/login`, `GET /auth/me`
- `/dashboard` -> `GET /dashboard/overview`, `GET /dashboard/alerts`
- `/assets` -> `GET /assets`, `POST /assets`
- `/assets/:id` -> `GET /assets/:id`, `GET /assets/:id/transfers`, `GET /assets/:id/disclosures`
- `/investors` -> `GET /investors`, `POST /investors`, `PATCH /investors/:id/status`
- `/transfers` -> `GET /transfers`, `GET /transfers/:id`
- `/transfers/new` -> `POST /transfers/preflight`, `POST /transfers`
- `/disclosures` -> `GET /disclosures`, `POST /disclosures/grant`, `POST /disclosures/revoke`
- `/audit` -> `GET /audit/events`, `GET /audit/bundles/:id`
- `/reports` -> `GET /reports/summary`, `POST /reports/export`
- `/settings` -> `GET /settings/org`, `PATCH /settings/org`, `GET /settings/roles`

## 5. Smart Contract Plan (MVP)

### Contract set
- `ConfidentialRWAToken`:
  - confidential balances and confidential transfer amount semantics.
  - owner/admin mint-burn controls.
- `TransferController`:
  - transfer initiation/approval/status hooks.
  - emits canonical events for backend reconciliation.
- `DisclosureRegistry`:
  - grant/revoke viewer scopes by asset and role.
  - explicit access checks for audit/export actions.
- `AuditAnchor`:
  - periodic hash commitment of backend audit bundle.

### Integration pattern
- Backend performs policy checks first.
- Backend submits chain transaction only after preflight passes.
- Event indexer confirms on-chain state and transitions internal transfer state.
- Final UI status is derived from reconciled state, not optimistic assumptions.

## 6. Nox Protocol Integration Plan (Technical Spike + Build)

### Why evaluate Nox
- iExec positions Nox as a programmable privacy layer for confidential smart contracts and confidential tokens.
- Nox contract stack includes ACL, proof validation, and confidential compute primitives.

### Spike tasks (Week 1–2)
- Validate deployment on Arbitrum Sepolia end-to-end.
- Implement minimal confidential token flow:
  - encrypted mint,
  - confidential transfer,
  - decrypted balance visibility for authorized viewers.
- Measure:
  - latency,
  - dev ergonomics,
  - failure modes,
  - operational complexity (gateway/KMS/proof handling).

### Go / No-Go criteria
- Go if:
  - stable CI deploy on testnet,
  - deterministic proof validation flow,
  - manageable ops complexity for MVP team.
- No-Go fallback:
  - keep backend architecture identical,
  - switch to transparent token + encrypted off-chain amount storage + audit anchor,
  - preserve API contracts to avoid frontend rework.

## 7. Security and Compliance Baseline

- Strict RBAC guards on all sensitive endpoints.
- Input validation at every boundary.
- Signed and immutable audit events for sensitive actions.
- Rate limits on auth, transfer, and disclosure endpoints.
- Secret management via environment/runtime secret store (no hardcoded keys).
- Dependency and contract vulnerability checks in CI.

## 8. Milestone Plan (8 Weeks)

### Phase 0 (Week 1): Foundations
- Repo structure, coding standards, migration framework.
- Auth + RBAC skeleton.
- Initial PostgreSQL schema and seed data.
- Nox feasibility spike starts.

### Phase 1 (Week 2–3): Core Backend APIs
- Assets, investors, transfers, disclosures CRUD + state machine.
- Dashboard, audit, reports read models.
- Audit logging middleware and correlation IDs.

### Phase 2 (Week 3–4): Smart Contract MVP
- Deploy contract set to Arbitrum Sepolia.
- Implement transfer + disclosure contract events.
- Build signing/relayer service in backend.

### Phase 3 (Week 5): Chain Reconciliation
- Event ingestion worker.
- Idempotent reconciliation logic.
- Retry and dead-letter handling for failed jobs.

### Phase 4 (Week 6): End-to-End Hardening
- Security checks, access tests, and negative-path tests.
- Contract verification and deployment runbooks.
- Report export + audit bundle anchoring.

### Phase 5 (Week 7–8): UAT and Release Prep
- Full frontend-backend-contract integration QA.
- Performance and reliability tuning.
- Pilot demo script, incident runbook, and release checklist.

## 9. Testing and Quality Gates

- Backend:
  - unit tests per domain,
  - integration tests against PostgreSQL,
  - contract adapter tests with mocked RPC failures.
- Contracts:
  - unit tests and invariant checks,
  - deployment/upgrade test on testnet.
- E2E:
  - route-based flows covering transfers, disclosures, and audit visibility.

Release gate:
- no critical vulnerabilities,
- all E2E critical paths pass,
- reconciliation mismatch rate = 0 in staging replay.

## 10. Research Notes: Nox Protocol and iExec Confidential Tokens

Validated findings from official/public primary sources:
- `nox-protocol-contracts` repository describes NoxCompute as upgradeable core contract handling ACL, proof validation, and confidential compute primitives.
- Changelog records `0.1.0` on **2026-04-09** as first core release and lists ACL, compute primitives, and on-chain proof validation features.
- Changelog also shows newer versions (`0.2.0`, `0.2.1`, `0.2.2`) in April 2026, indicating rapid iteration.
- iExec documentation positions Nox for confidential smart contracts and confidential token workflows (ERC-7984 references).
- iExec’s 2026 privacy roadmap references confidential RWA deployments and highlights production direction across ecosystems, including experimentation on Ethereum/Arbitrum/Base.

## 11. Immediate Next Actions

1. Approve Nox-first vs fallback implementation strategy.
2. Freeze API contract for all existing frontend pages.
3. Start Phase 0 with migrations, auth module, and Nox spike branch.
4. Define production acceptance checklist before Phase 2 contract deployment.

