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

## RBAC

Bearer token auth with roles:

- `admin-token` → `admin`
- `operator-token` → `operator`
- `auditor-token` → `auditor`

Guards:

- Admin/Operator: `/assets`, `/investors`, `/transfers`, `/disclosures`
- Admin/Auditor: `/audit/events`

## Environment

- `DATABASE_URL` (default: `postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend`)
- `BACKEND_PORT` (default: `8080`)
- `AUTH_ADMIN_WALLETS` (comma-separated EVM addresses)
- `AUTH_OPERATOR_WALLETS` (comma-separated EVM addresses)
- `AUTH_AUDITOR_WALLETS` (comma-separated EVM addresses)

Wallet auth flow:
1. `POST /auth/wallet/challenge` with `{ address, chain_id }`
2. Sign returned message with `personal_sign`
3. `POST /auth/wallet/login` with `{ address, chain_id, signature }`

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
