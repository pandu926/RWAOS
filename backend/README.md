# Confidential RWA OS Backend (Rust + Axum + PostgreSQL)

Modular backend for Confidential RWA OS with PostgreSQL-backed repositories and role-based API guards.

## Modules

- `identity_access`
- `asset_registry`
- `investor_registry`
- `transfer_ops`
- `disclosure_mgmt`
- `audit_reporting`
- `health`

## API Endpoints

- `GET /health/live`
- `GET /health/ready`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/wallet/challenge`
- `POST /auth/wallet/login`
- `GET/POST /assets`
- `GET/POST /investors`
- `GET/POST /transfers`
- `GET/POST /disclosures`
- `GET /audit/events`

All responses use a JSON envelope:

```json
{
  "success": true,
  "data": {},
  "error": null
}
```

## Auth Stage 1 (Current)

Stage 1 uses in-memory role tokens (no JWT yet).

Built-in users for `POST /auth/login`:

- `admin_user` → `admin-token` (`admin`)
- `operator_user` → `operator-token` (`operator`)
- `auditor_user` → `auditor-token` (`auditor`)

`GET /auth/me` and protected endpoints read `Authorization: Bearer <token>`.

Role guards in backend:

- Admin/Operator: `/assets`, `/investors`, `/transfers`, `/disclosures`, `POST /compliance/passports`
- Admin/Auditor: `/audit/events`, `GET /compliance/passports`, `GET /compliance/passports/{transfer_id}`, `POST /compliance/passports/{transfer_id}/access`

## Environment

- `DATABASE_URL` (default: `postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend`)
- `BACKEND_PORT` (default: `8080`)
- `AUTH_ADMIN_WALLETS` (comma-separated EVM addresses)
- `AUTH_OPERATOR_WALLETS` (comma-separated EVM addresses)
- `AUTH_AUDITOR_WALLETS` (comma-separated EVM addresses)

Auth notes for stage 1:

- Wallet allowlist envs above are read at startup to map wallet → role.
- Wallet matching is normalized to lowercase.
- If one wallet appears in multiple allowlist env vars, the later assignment wins:
  - `AUTH_ADMIN_WALLETS` → then `AUTH_OPERATOR_WALLETS` → then `AUTH_AUDITOR_WALLETS`.
- There is currently no `AUTH_TOKEN_SECRET` or token TTL env in backend runtime. Tokens are fixed role tokens returned by login endpoints.

Wallet auth flow:
1. `POST /auth/wallet/challenge` with `{ address, chain_id }`
2. Backend checks allowlist and issues one-time nonce challenge message.
3. Sign returned message with `personal_sign`.
4. `POST /auth/wallet/login` with `{ address, chain_id, signature }`.
5. Backend verifies signature recovery equals requested wallet, consumes nonce, then returns role token (`admin-token` / `operator-token` / `auditor-token`).

`chain_id` currently enforced to Arbitrum Sepolia (`421614`).

On startup, the backend bootstraps schema (`CREATE TABLE IF NOT EXISTS`) and seeds dummy rows when tables are empty.

## Run (Local)

```bash
export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend
export BACKEND_PORT=8080
cargo run
```

Server binds to `0.0.0.0:${BACKEND_PORT}`.

Example:

```bash
curl -s http://127.0.0.1:8080/health/live
curl -s -X POST http://127.0.0.1:8080/auth/login \
  -H "content-type: application/json" \
  -d '{"username":"operator_user"}'
curl -s http://127.0.0.1:8080/assets -H "authorization: Bearer operator-token"
```

## Test and Build

```bash
cargo test
cargo build
```

## Docker (Backend Only)

Build image:

```bash
docker build -t rwaos-backend:latest .
```

Run container:

```bash
docker run --rm -p 8080:8080 \
  -e DATABASE_URL=postgres://postgres:postgres@host.docker.internal:5432/rwaos_backend \
  -e BACKEND_PORT=8080 \
  rwaos-backend:latest
```
