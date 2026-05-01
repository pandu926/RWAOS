use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::{State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode},
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

use crate::{
    ApiEnvelope, AppState, authorized_user_from_headers, identity_access::Role,
    institution_id_from_user,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct TenantContract {
    pub institution_id: i64,
    pub chain_id: i64,
    pub token_address: String,
    pub disclosure_registry_address: String,
    pub transfer_controller_address: String,
    pub audit_anchor_address: String,
    pub settlement_asset_address: Option<String>,
    pub settlement_vault_address: Option<String>,
    pub factory_tx_hash: String,
    pub owner_wallet: String,
    pub deployment_status: String,
    pub created_at_unix: i64,
}

#[derive(Debug, Clone)]
pub struct SaveTenantContractRequest {
    pub chain_id: i64,
    pub token_address: String,
    pub disclosure_registry_address: String,
    pub transfer_controller_address: String,
    pub audit_anchor_address: String,
    pub settlement_asset_address: Option<String>,
    pub settlement_vault_address: Option<String>,
    pub factory_tx_hash: String,
    pub owner_wallet: String,
    pub deployment_status: String,
}

pub struct TenantContractRepository {
    pool: PgPool,
}

impl TenantContractRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn upsert(
        &self,
        institution_id: i64,
        payload: SaveTenantContractRequest,
    ) -> Result<TenantContract, sqlx::Error> {
        sqlx::query_as::<_, TenantContract>(
            r#"
            INSERT INTO tenant_contracts (
                institution_id, chain_id, token_address, disclosure_registry_address,
                transfer_controller_address, audit_anchor_address, settlement_asset_address,
                settlement_vault_address, factory_tx_hash, owner_wallet, deployment_status,
                created_at_unix
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
            ON CONFLICT (institution_id) DO UPDATE
            SET
                chain_id = EXCLUDED.chain_id,
                token_address = EXCLUDED.token_address,
                disclosure_registry_address = EXCLUDED.disclosure_registry_address,
                transfer_controller_address = EXCLUDED.transfer_controller_address,
                audit_anchor_address = EXCLUDED.audit_anchor_address,
                settlement_asset_address = EXCLUDED.settlement_asset_address,
                settlement_vault_address = EXCLUDED.settlement_vault_address,
                factory_tx_hash = EXCLUDED.factory_tx_hash,
                owner_wallet = EXCLUDED.owner_wallet,
                deployment_status = EXCLUDED.deployment_status
            RETURNING institution_id, chain_id, token_address, disclosure_registry_address,
                transfer_controller_address, audit_anchor_address, settlement_asset_address,
                settlement_vault_address, factory_tx_hash,
                owner_wallet, deployment_status, created_at_unix
            "#,
        )
        .bind(institution_id)
        .bind(payload.chain_id)
        .bind(payload.token_address)
        .bind(payload.disclosure_registry_address)
        .bind(payload.transfer_controller_address)
        .bind(payload.audit_anchor_address)
        .bind(payload.settlement_asset_address)
        .bind(payload.settlement_vault_address)
        .bind(payload.factory_tx_hash)
        .bind(payload.owner_wallet)
        .bind(payload.deployment_status)
        .bind(now_unix())
        .fetch_one(&self.pool)
        .await
    }

    pub async fn get_current(
        &self,
        institution_id: i64,
    ) -> Result<Option<TenantContract>, sqlx::Error> {
        sqlx::query_as::<_, TenantContract>(
            r#"
            SELECT institution_id, chain_id, token_address, disclosure_registry_address,
                transfer_controller_address, audit_anchor_address, settlement_asset_address,
                settlement_vault_address, factory_tx_hash,
                owner_wallet, deployment_status, created_at_unix
            FROM tenant_contracts
            WHERE institution_id = $1
            ORDER BY created_at_unix DESC
            LIMIT 1
            "#,
        )
        .bind(institution_id)
        .fetch_optional(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/tenant/contracts", get(list).post(upsert))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Option<TenantContract>>>) {
    let institution_id = match tenant_institution_id(&state, &headers) {
        Ok(value) => value,
        Err((code, message)) => return (code, Json(ApiEnvelope::err(message))),
    };

    match state.tenant_contract_repo.get_current(institution_id).await {
        Ok(item) => (StatusCode::OK, Json(ApiEnvelope::ok(item))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to read tenant contracts: {err}"
            ))),
        ),
    }
}

async fn upsert(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<TenantContract>>) {
    let institution_id = match tenant_institution_id(&state, &headers) {
        Ok(value) => value,
        Err((code, message)) => return (code, Json(ApiEnvelope::err(message))),
    };

    let payload = match payload {
        Ok(Json(value)) => match parse_save_tenant_contract_request(&value) {
            Ok(parsed) => parsed,
            Err(message) => return (StatusCode::BAD_REQUEST, Json(ApiEnvelope::err(message))),
        },
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiEnvelope::err(format!("invalid JSON payload: {err}"))),
            );
        }
    };

    match state
        .tenant_contract_repo
        .upsert(institution_id, payload)
        .await
    {
        Ok(saved) => (StatusCode::OK, Json(ApiEnvelope::ok(saved))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to save tenant contracts: {err}"
            ))),
        ),
    }
}

fn tenant_institution_id(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<i64, (StatusCode, &'static str)> {
    let user = authorized_user_from_headers(state, headers, &[Role::Admin, Role::Operator])
        .map_err(|_| (StatusCode::UNAUTHORIZED, "unauthorized"))?;
    institution_id_from_user(&user).map_err(|_| {
        (
            StatusCode::FORBIDDEN,
            "tenant contract metadata requires a tenant-scoped token",
        )
    })
}

fn parse_save_tenant_contract_request(value: &Value) -> Result<SaveTenantContractRequest, String> {
    let payload = value
        .as_object()
        .ok_or_else(|| "tenant contract payload must be a JSON object.".to_owned())?;

    Ok(SaveTenantContractRequest {
        chain_id: parse_positive_i64(payload.get("chain_id"), "chain_id")?,
        token_address: parse_required_evm_address(payload.get("token_address"), "token_address")?,
        disclosure_registry_address: parse_required_evm_address(
            payload.get("disclosure_registry_address"),
            "disclosure_registry_address",
        )?,
        transfer_controller_address: parse_required_evm_address(
            payload.get("transfer_controller_address"),
            "transfer_controller_address",
        )?,
        audit_anchor_address: parse_required_evm_address(
            payload.get("audit_anchor_address"),
            "audit_anchor_address",
        )?,
        settlement_asset_address: parse_optional_evm_address(
            payload.get("settlement_asset_address"),
            "settlement_asset_address",
        )?,
        settlement_vault_address: parse_optional_evm_address(
            payload.get("settlement_vault_address"),
            "settlement_vault_address",
        )?,
        factory_tx_hash: parse_required_tx_hash(payload.get("factory_tx_hash"), "factory_tx_hash")?,
        owner_wallet: parse_required_evm_address(payload.get("owner_wallet"), "owner_wallet")?,
        deployment_status: parse_required_string(
            payload.get("deployment_status"),
            "deployment_status",
        )?,
    })
}

fn parse_positive_i64(value: Option<&Value>, field: &str) -> Result<i64, String> {
    let value = value.ok_or_else(|| format!("`{field}` is required."))?;

    if let Some(number) = value.as_i64() {
        if number > 0 {
            return Ok(number);
        }
    }

    if let Some(number) = value.as_u64() {
        return i64::try_from(number)
            .map_err(|_| format!("`{field}` is too large."))
            .and_then(|parsed| {
                if parsed > 0 {
                    Ok(parsed)
                } else {
                    Err(format!("`{field}` must be a positive integer."))
                }
            });
    }

    if let Some(text) = value.as_str() {
        return text
            .trim()
            .parse::<i64>()
            .map_err(|_| format!("`{field}` must be a positive integer."))
            .and_then(|parsed| {
                if parsed > 0 {
                    Ok(parsed)
                } else {
                    Err(format!("`{field}` must be a positive integer."))
                }
            });
    }

    Err(format!("`{field}` must be a positive integer."))
}

fn parse_required_string(value: Option<&Value>, field: &str) -> Result<String, String> {
    let value = value.ok_or_else(|| format!("`{field}` is required."))?;
    let text = value
        .as_str()
        .ok_or_else(|| format!("`{field}` must be a string."))?;
    let trimmed = text.trim();

    if trimmed.is_empty() {
        Err(format!("`{field}` must not be empty."))
    } else {
        Ok(trimmed.to_owned())
    }
}

fn parse_required_evm_address(value: Option<&Value>, field: &str) -> Result<String, String> {
    let text = parse_required_string(value, field)?.to_ascii_lowercase();
    if !looks_like_evm_address(&text) {
        return Err(format!(
            "`{field}` must be a 0x-prefixed 20-byte hex address."
        ));
    }
    Ok(text)
}

fn parse_optional_evm_address(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let text = value
        .as_str()
        .ok_or_else(|| format!("`{field}` must be a string."))?
        .trim();
    if text.is_empty() {
        return Ok(None);
    }
    let normalized = text.to_ascii_lowercase();
    if !looks_like_evm_address(&normalized) {
        return Err(format!(
            "`{field}` must be a 0x-prefixed 20-byte hex address."
        ));
    }
    Ok(Some(normalized))
}

fn parse_required_tx_hash(value: Option<&Value>, field: &str) -> Result<String, String> {
    let text = parse_required_string(value, field)?.to_ascii_lowercase();
    if !looks_like_tx_hash(&text) {
        return Err(format!(
            "`{field}` must be a 0x-prefixed 32-byte transaction hash."
        ));
    }
    Ok(text)
}

fn looks_like_evm_address(value: &str) -> bool {
    value.len() == 42
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

fn looks_like_tx_hash(value: &str) -> bool {
    value.len() == 66
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_and_normalizes_tenant_contract_payload() {
        let parsed = parse_save_tenant_contract_request(&serde_json::json!({
            "chain_id": "421614",
            "token_address": "0xAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
            "disclosure_registry_address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "transfer_controller_address": "0xcccccccccccccccccccccccccccccccccccccccc",
            "audit_anchor_address": "0xdddddddddddddddddddddddddddddddddddddddd",
            "settlement_asset_address": "0x1111111111111111111111111111111111111111",
            "settlement_vault_address": "0x2222222222222222222222222222222222222222",
            "factory_tx_hash": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
            "owner_wallet": "0xffffffffffffffffffffffffffffffffffffffff",
            "deployment_status": "deployed"
        }))
        .expect("valid payload");

        assert_eq!(parsed.chain_id, 421614);
        assert_eq!(
            parsed.token_address,
            "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
        );
        assert_eq!(
            parsed.settlement_vault_address.as_deref(),
            Some("0x2222222222222222222222222222222222222222")
        );
    }

    #[test]
    fn rejects_invalid_tenant_contract_tx_hash() {
        let err = parse_save_tenant_contract_request(&serde_json::json!({
            "chain_id": 421614,
            "token_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "disclosure_registry_address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
            "transfer_controller_address": "0xcccccccccccccccccccccccccccccccccccccccc",
            "audit_anchor_address": "0xdddddddddddddddddddddddddddddddddddddddd",
            "factory_tx_hash": "0xabc123",
            "owner_wallet": "0xffffffffffffffffffffffffffffffffffffffff",
            "deployment_status": "deployed"
        }))
        .expect_err("short tx hash must be rejected");

        assert_eq!(
            err,
            "`factory_tx_hash` must be a 0x-prefixed 32-byte transaction hash."
        );
    }
}
