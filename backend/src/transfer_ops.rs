use axum::{
    Json, Router,
    extract::State,
    extract::rejection::JsonRejection,
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
pub struct TransferOnchainMetadataRow {
    pub transfer_id: i64,
    pub chain_id: Option<i64>,
    pub sender_wallet_address: Option<String>,
    pub recipient_wallet_address: Option<String>,
    pub disclosure_data_id: Option<String>,
    pub disclosure_registry_address: Option<String>,
    pub transfer_controller_address: Option<String>,
    pub token_address: Option<String>,
    pub encrypted_amount: Option<String>,
    pub input_proof: Option<String>,
    pub reference_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferOnchainMetadata {
    pub chain_id: Option<i64>,
    pub sender_wallet_address: Option<String>,
    pub recipient_wallet_address: Option<String>,
    pub disclosure_data_id: Option<String>,
    pub disclosure_registry_address: Option<String>,
    pub transfer_controller_address: Option<String>,
    pub token_address: Option<String>,
    pub encrypted_amount: Option<String>,
    pub input_proof: Option<String>,
    pub reference_note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Transfer {
    pub id: i64,
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
    pub tx_hash: Option<String>,
    pub status: String,
    pub failure_reason: Option<String>,
    pub onchain_metadata: Option<TransferOnchainMetadata>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferOnchainMetadataRequest {
    pub chain_id: Option<i64>,
    pub sender_wallet_address: Option<String>,
    pub recipient_wallet_address: Option<String>,
    pub disclosure_data_id: Option<String>,
    pub disclosure_registry_address: Option<String>,
    pub transfer_controller_address: Option<String>,
    pub token_address: Option<String>,
    pub encrypted_amount: Option<String>,
    pub input_proof: Option<String>,
    pub reference_note: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferRequest {
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
    pub tx_hash: Option<String>,
    pub status: String,
    pub failure_reason: Option<String>,
    pub onchain_metadata: Option<CreateTransferOnchainMetadataRequest>,
}

#[derive(Debug, Clone, FromRow)]
struct TransferRow {
    pub id: i64,
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
    pub tx_hash: Option<String>,
    pub status: String,
    pub failure_reason: Option<String>,
}

pub struct TransferRepository {
    pool: PgPool,
}

impl TransferRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        institution_id: i64,
        payload: CreateTransferRequest,
    ) -> Result<Transfer, sqlx::Error> {
        let mut transaction = self.pool.begin().await?;

        let created = sqlx::query_as::<_, TransferRow>(
            r#"
            INSERT INTO transfers (
                institution_id, asset_id, from_investor_id, to_investor_id, amount, tx_hash, status, failure_reason
            )
            SELECT $1, $2, $3, $4, $5, $6, $7, $8
            WHERE EXISTS (
                SELECT 1 FROM assets WHERE id = $2 AND institution_id = $1
            )
            AND EXISTS (
                SELECT 1 FROM investors WHERE id = $3 AND institution_id = $1
            )
            AND EXISTS (
                SELECT 1 FROM investors WHERE id = $4 AND institution_id = $1
            )
            RETURNING id, asset_id, from_investor_id, to_investor_id, amount, tx_hash, status, failure_reason
            "#,
        )
        .bind(institution_id)
        .bind(payload.asset_id)
        .bind(payload.from_investor_id)
        .bind(payload.to_investor_id)
        .bind(payload.amount)
        .bind(payload.tx_hash)
        .bind(payload.status)
        .bind(payload.failure_reason)
        .fetch_one(&mut *transaction)
        .await?;

        if let Some(metadata) = payload.onchain_metadata {
            sqlx::query(
                r#"
                INSERT INTO transfer_onchain_metadata (
                    institution_id,
                    transfer_id,
                    chain_id,
                    sender_wallet_address,
                    recipient_wallet_address,
                    disclosure_data_id,
                    disclosure_registry_address,
                    transfer_controller_address,
                    token_address,
                    encrypted_amount,
                    input_proof,
                    reference_note
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
                )
                ON CONFLICT (transfer_id) DO UPDATE SET
                    chain_id = EXCLUDED.chain_id,
                    sender_wallet_address = EXCLUDED.sender_wallet_address,
                    recipient_wallet_address = EXCLUDED.recipient_wallet_address,
                    disclosure_data_id = EXCLUDED.disclosure_data_id,
                    disclosure_registry_address = EXCLUDED.disclosure_registry_address,
                    transfer_controller_address = EXCLUDED.transfer_controller_address,
                    token_address = EXCLUDED.token_address,
                    encrypted_amount = EXCLUDED.encrypted_amount,
                    input_proof = EXCLUDED.input_proof,
                    reference_note = EXCLUDED.reference_note
                "#,
            )
            .bind(institution_id)
            .bind(created.id)
            .bind(metadata.chain_id)
            .bind(metadata.sender_wallet_address)
            .bind(metadata.recipient_wallet_address)
            .bind(metadata.disclosure_data_id)
            .bind(metadata.disclosure_registry_address)
            .bind(metadata.transfer_controller_address)
            .bind(metadata.token_address)
            .bind(metadata.encrypted_amount)
            .bind(metadata.input_proof)
            .bind(metadata.reference_note)
            .execute(&mut *transaction)
            .await?;
        }

        transaction.commit().await?;

        Ok(Transfer {
            id: created.id,
            asset_id: created.asset_id,
            from_investor_id: created.from_investor_id,
            to_investor_id: created.to_investor_id,
            amount: created.amount,
            tx_hash: created.tx_hash,
            status: created.status,
            failure_reason: created.failure_reason,
            onchain_metadata: self
                .get_onchain_metadata(institution_id, created.id)
                .await?,
        })
    }

    pub async fn list(&self, institution_id: i64) -> Result<Vec<Transfer>, sqlx::Error> {
        let rows = sqlx::query_as::<_, TransferRow>(
            "SELECT id, asset_id, from_investor_id, to_investor_id, amount, tx_hash, status, failure_reason FROM transfers WHERE institution_id = $1 ORDER BY id ASC",
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await?;
        let metadata_rows = sqlx::query_as::<_, TransferOnchainMetadataRow>(
            r#"
            SELECT transfer_id, chain_id, sender_wallet_address, recipient_wallet_address,
                   disclosure_data_id, disclosure_registry_address, transfer_controller_address,
                   token_address, encrypted_amount, input_proof, reference_note
            FROM transfer_onchain_metadata
            WHERE institution_id = $1
            "#,
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await?;

        let metadata_by_transfer_id = metadata_rows
            .into_iter()
            .map(|row| (row.transfer_id, map_onchain_metadata_row(row)))
            .collect::<std::collections::HashMap<_, _>>();

        Ok(rows
            .into_iter()
            .map(|row| Transfer {
                id: row.id,
                asset_id: row.asset_id,
                from_investor_id: row.from_investor_id,
                to_investor_id: row.to_investor_id,
                amount: row.amount,
                tx_hash: row.tx_hash,
                status: row.status,
                failure_reason: row.failure_reason,
                onchain_metadata: metadata_by_transfer_id.get(&row.id).cloned(),
            })
            .collect())
    }

    async fn get_onchain_metadata(
        &self,
        institution_id: i64,
        transfer_id: i64,
    ) -> Result<Option<TransferOnchainMetadata>, sqlx::Error> {
        let row = sqlx::query_as::<_, TransferOnchainMetadataRow>(
            r#"
            SELECT transfer_id, chain_id, sender_wallet_address, recipient_wallet_address,
                   disclosure_data_id, disclosure_registry_address, transfer_controller_address,
                   token_address, encrypted_amount, input_proof, reference_note
            FROM transfer_onchain_metadata
            WHERE institution_id = $1 AND transfer_id = $2
            "#,
        )
        .bind(institution_id)
        .bind(transfer_id)
        .fetch_optional(&self.pool)
        .await?;

        Ok(row.map(map_onchain_metadata_row))
    }
}

fn map_onchain_metadata_row(row: TransferOnchainMetadataRow) -> TransferOnchainMetadata {
    TransferOnchainMetadata {
        chain_id: row.chain_id,
        sender_wallet_address: row.sender_wallet_address,
        recipient_wallet_address: row.recipient_wallet_address,
        disclosure_data_id: row.disclosure_data_id,
        disclosure_registry_address: row.disclosure_registry_address,
        transfer_controller_address: row.transfer_controller_address,
        token_address: row.token_address,
        encrypted_amount: row.encrypted_amount,
        input_proof: row.input_proof,
        reference_note: row.reference_note,
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/transfers", get(list).post(create))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<Transfer>>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    match state.transfer_repo.list(institution_id).await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!("failed to list transfers: {err}"))),
        ),
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<Transfer>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    let payload = match payload {
        Ok(Json(value)) => match parse_create_transfer_request(&value) {
            Ok(parsed) => parsed,
            Err(message) => {
                return (StatusCode::BAD_REQUEST, Json(ApiEnvelope::err(message)));
            }
        },
        Err(err) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(ApiEnvelope::err(format!("invalid JSON payload: {err}"))),
            );
        }
    };

    match state.transfer_repo.create(institution_id, payload).await {
        Ok(created) => {
            let action = format!(
                "confidential_transfer_recorded:id={}:asset_id={}:from={}:to={}:status={}:tx={}",
                created.id,
                created.asset_id,
                created.from_investor_id,
                created.to_investor_id,
                created.status,
                created.tx_hash.as_deref().unwrap_or("none"),
            );
            let event = crate::audit_reporting::AuditEvent::from_request(
                crate::audit_reporting::CreateAuditEventRequest::new(&user.username, &action),
            );
            let _ = state.audit_repo.push_event(institution_id, event).await;

            (StatusCode::OK, Json(ApiEnvelope::ok(created)))
        }
        Err(sqlx::Error::RowNotFound) => (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err(
                "asset/investor references are outside your institution scope",
            )),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to create transfer: {err}"
            ))),
        ),
    }
}

fn parse_create_transfer_request(value: &Value) -> Result<CreateTransferRequest, String> {
    let payload = value
        .as_object()
        .ok_or_else(|| "transfer payload must be a JSON object.".to_owned())?;

    let asset_id = parse_positive_i64(payload.get("asset_id"), "asset_id")?;
    let from_investor_id = parse_positive_i64(payload.get("from_investor_id"), "from_investor_id")?;
    let to_investor_id = parse_to_investor_id(payload.get("to_investor_id"))?;
    let amount = parse_positive_f64(payload.get("amount"), "amount")?;
    let tx_hash = parse_optional_string(payload.get("tx_hash"), "tx_hash")?;
    let status = parse_transfer_status(payload.get("status"))?;
    let failure_reason = parse_optional_string(payload.get("failure_reason"), "failure_reason")?;
    let onchain_metadata = parse_optional_onchain_metadata(payload.get("onchain_metadata"))?;

    if matches!(status.as_str(), "confirmed" | "reverted") && tx_hash.is_none() {
        return Err("`tx_hash` is required when `status` is `confirmed` or `reverted`.".to_owned());
    }

    if status == "confirmed" && failure_reason.is_some() {
        return Err("`failure_reason` is only allowed when `status` is `reverted`.".to_owned());
    }

    Ok(CreateTransferRequest {
        asset_id,
        from_investor_id,
        to_investor_id,
        amount,
        tx_hash,
        status,
        failure_reason,
        onchain_metadata,
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
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Err(format!("`{field}` must be a positive integer."));
        }

        return trimmed
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

fn parse_to_investor_id(value: Option<&Value>) -> Result<i64, String> {
    let value = value.ok_or_else(|| "`to_investor_id` is required.".to_owned())?;

    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if looks_like_uuid(trimmed) {
            return Err(
                "`to_investor_id` must be the backend numeric investor ID, not a UUID.".to_owned(),
            );
        }
    }

    parse_positive_i64(Some(value), "to_investor_id")
}

fn parse_positive_f64(value: Option<&Value>, field: &str) -> Result<f64, String> {
    let value = value.ok_or_else(|| format!("`{field}` is required."))?;

    if let Some(number) = value.as_f64() {
        if number.is_finite() && number > 0.0 {
            return Ok(number);
        }
    }

    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Err(format!("`{field}` must be a positive number."));
        }

        return trimmed
            .parse::<f64>()
            .map_err(|_| format!("`{field}` must be a positive number."))
            .and_then(|parsed| {
                if parsed.is_finite() && parsed > 0.0 {
                    Ok(parsed)
                } else {
                    Err(format!("`{field}` must be a positive number."))
                }
            });
    }

    Err(format!("`{field}` must be a positive number."))
}

fn parse_optional_string(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };

    if value.is_null() {
        return Ok(None);
    }

    let text = value
        .as_str()
        .ok_or_else(|| format!("`{field}` must be a string when provided."))?;
    let trimmed = text.trim();

    if trimmed.is_empty() {
        Ok(None)
    } else if field.ends_with("tx_hash") && !looks_like_tx_hash(trimmed) {
        Err(format!(
            "`{field}` must be a 0x + 64 hex transaction hash when provided."
        ))
    } else {
        Ok(Some(trimmed.to_owned()))
    }
}

fn parse_optional_positive_i64(value: Option<&Value>, field: &str) -> Result<Option<i64>, String> {
    let Some(value) = value else {
        return Ok(None);
    };

    if value.is_null() {
        return Ok(None);
    }

    parse_positive_i64(Some(value), field).map(Some)
}

fn parse_optional_evm_address(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let parsed = parse_optional_string(value, field)?;
    let Some(text) = parsed else {
        return Ok(None);
    };

    if text.len() == 42
        && text.starts_with("0x")
        && text.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
    {
        return Ok(Some(text.to_ascii_lowercase()));
    }

    Err(format!(
        "`{field}` must be a valid 0x-prefixed 20-byte EVM address when provided."
    ))
}

fn parse_optional_bytes32_hex(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let parsed = parse_optional_string(value, field)?;
    let Some(text) = parsed else {
        return Ok(None);
    };

    if text.len() == 66
        && text.starts_with("0x")
        && text.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
    {
        return Ok(Some(text));
    }

    Err(format!(
        "`{field}` must be a valid 0x-prefixed 32-byte hex value when provided."
    ))
}

fn parse_optional_hex_blob(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let parsed = parse_optional_string(value, field)?;
    let Some(text) = parsed else {
        return Ok(None);
    };

    if text.starts_with("0x") && text.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit) {
        return Ok(Some(text));
    }

    Err(format!(
        "`{field}` must be a valid 0x-prefixed hex string when provided."
    ))
}

fn parse_optional_onchain_metadata(
    value: Option<&Value>,
) -> Result<Option<CreateTransferOnchainMetadataRequest>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let payload = value
        .as_object()
        .ok_or_else(|| "`onchain_metadata` must be a JSON object when provided.".to_owned())?;

    let metadata = CreateTransferOnchainMetadataRequest {
        chain_id: parse_optional_positive_i64(payload.get("chain_id"), "onchain_metadata.chain_id")?,
        sender_wallet_address: parse_optional_evm_address(
            payload.get("sender_wallet_address"),
            "onchain_metadata.sender_wallet_address",
        )?,
        recipient_wallet_address: parse_optional_evm_address(
            payload.get("recipient_wallet_address"),
            "onchain_metadata.recipient_wallet_address",
        )?,
        disclosure_data_id: parse_optional_bytes32_hex(
            payload.get("disclosure_data_id"),
            "onchain_metadata.disclosure_data_id",
        )?,
        disclosure_registry_address: parse_optional_evm_address(
            payload.get("disclosure_registry_address"),
            "onchain_metadata.disclosure_registry_address",
        )?,
        transfer_controller_address: parse_optional_evm_address(
            payload.get("transfer_controller_address"),
            "onchain_metadata.transfer_controller_address",
        )?,
        token_address: parse_optional_evm_address(
            payload.get("token_address"),
            "onchain_metadata.token_address",
        )?,
        encrypted_amount: parse_optional_bytes32_hex(
            payload.get("encrypted_amount"),
            "onchain_metadata.encrypted_amount",
        )?,
        input_proof: parse_optional_hex_blob(payload.get("input_proof"), "onchain_metadata.input_proof")?,
        reference_note: parse_optional_string(payload.get("reference_note"), "onchain_metadata.reference_note")?,
    };

    let has_any_field = metadata.chain_id.is_some()
        || metadata.sender_wallet_address.is_some()
        || metadata.recipient_wallet_address.is_some()
        || metadata.disclosure_data_id.is_some()
        || metadata.disclosure_registry_address.is_some()
        || metadata.transfer_controller_address.is_some()
        || metadata.token_address.is_some()
        || metadata.encrypted_amount.is_some()
        || metadata.input_proof.is_some()
        || metadata.reference_note.is_some();

    Ok(has_any_field.then_some(metadata))
}

fn parse_transfer_status(value: Option<&Value>) -> Result<String, String> {
    let Some(value) = value else {
        return Ok("pending".to_owned());
    };

    if value.is_null() {
        return Ok("pending".to_owned());
    }

    let text = value
        .as_str()
        .ok_or_else(|| "`status` must be a string when provided.".to_owned())?;
    let normalized = text.trim().to_ascii_lowercase();

    match normalized.as_str() {
        "pending" | "confirmed" | "reverted" => Ok(normalized),
        _ => Err("`status` must be one of: pending, confirmed, reverted.".to_owned()),
    }
}

fn looks_like_tx_hash(value: &str) -> bool {
    value.len() == 66
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

fn looks_like_uuid(value: &str) -> bool {
    let bytes = value.as_bytes();
    if bytes.len() != 36 {
        return false;
    }

    for (index, byte) in bytes.iter().enumerate() {
        let is_dash = matches!(index, 8 | 13 | 18 | 23);
        if is_dash {
            if *byte != b'-' {
                return false;
            }
            continue;
        }

        if !byte.is_ascii_hexdigit() {
            return false;
        }
    }

    true
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_create_transfer_request;

    #[test]
    fn accepts_numeric_strings_and_tx_hash() {
        let parsed = parse_create_transfer_request(&json!({
            "asset_id": "1",
            "from_investor_id": 2,
            "to_investor_id": "3",
            "amount": "125000.50",
            "tx_hash": " 0x1111111111111111111111111111111111111111111111111111111111111111 "
        }))
        .expect("payload should parse");

        assert_eq!(parsed.asset_id, 1);
        assert_eq!(parsed.from_investor_id, 2);
        assert_eq!(parsed.to_investor_id, 3);
        assert_eq!(parsed.amount, 125000.50);
        assert_eq!(
            parsed.tx_hash.as_deref(),
            Some("0x1111111111111111111111111111111111111111111111111111111111111111")
        );
        assert_eq!(parsed.status, "pending");
        assert_eq!(parsed.failure_reason, None);
    }

    #[test]
    fn rejects_uuid_to_investor_id_with_clear_message() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": "550e8400-e29b-41d4-a716-446655440000",
            "amount": 42
        }))
        .expect_err("uuid payload should fail");

        assert_eq!(
            error,
            "`to_investor_id` must be the backend numeric investor ID, not a UUID."
        );
    }

    #[test]
    fn rejects_invalid_tx_hash_with_clear_message() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "tx_hash": "abc123"
        }))
        .expect_err("invalid tx hash should fail");

        assert_eq!(
            error,
            "`tx_hash` must be a 0x + 64 hex transaction hash when provided."
        );
    }

    #[test]
    fn rejects_short_tx_hash_even_if_prefixed() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "tx_hash": "0xabc123"
        }))
        .expect_err("short tx hash should fail");

        assert_eq!(
            error,
            "`tx_hash` must be a 0x + 64 hex transaction hash when provided."
        );
    }

    #[test]
    fn accepts_reverted_status_with_failure_reason() {
        let parsed = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "status": "reverted",
            "tx_hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "failure_reason": "execution reverted"
        }))
        .expect("reverted payload should parse");

        assert_eq!(parsed.status, "reverted");
        assert_eq!(parsed.failure_reason.as_deref(), Some("execution reverted"));
    }

    #[test]
    fn accepts_onchain_metadata_payload() {
        let parsed = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "status": "confirmed",
            "tx_hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "onchain_metadata": {
                "chain_id": 421614,
                "sender_wallet_address": "0xec08da877d409293c006523db95ba291f43e3249",
                "recipient_wallet_address": "0x1111111111111111111111111111111111111111",
                "disclosure_data_id": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "disclosure_registry_address": "0x2222222222222222222222222222222222222222",
                "transfer_controller_address": "0x3333333333333333333333333333333333333333",
                "token_address": "0x4444444444444444444444444444444444444444",
                "encrypted_amount": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "input_proof": "0x1234abcd",
                "reference_note": "demo transfer"
            }
        }))
        .expect("payload with metadata should parse");

        let metadata = parsed.onchain_metadata.expect("metadata should be present");
        assert_eq!(metadata.chain_id, Some(421614));
        assert_eq!(
            metadata.sender_wallet_address.as_deref(),
            Some("0xec08da877d409293c006523db95ba291f43e3249")
        );
        assert_eq!(
            metadata.token_address.as_deref(),
            Some("0x4444444444444444444444444444444444444444")
        );
        assert_eq!(metadata.reference_note.as_deref(), Some("demo transfer"));
    }

    #[test]
    fn rejects_confirmed_without_tx_hash() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "status": "confirmed"
        }))
        .expect_err("confirmed without tx hash should fail");

        assert_eq!(
            error,
            "`tx_hash` is required when `status` is `confirmed` or `reverted`."
        );
    }

    #[test]
    fn rejects_failure_reason_for_non_reverted_status() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "status": "confirmed",
            "tx_hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
            "failure_reason": "should not be here"
        }))
        .expect_err("failure_reason should fail for confirmed");

        assert_eq!(
            error,
            "`failure_reason` is only allowed when `status` is `reverted`."
        );
    }

    #[test]
    fn rejects_unknown_status() {
        let error = parse_create_transfer_request(&json!({
            "asset_id": 1,
            "from_investor_id": 2,
            "to_investor_id": 3,
            "amount": 42,
            "status": "done"
        }))
        .expect_err("unknown status should fail");

        assert_eq!(
            error,
            "`status` must be one of: pending, confirmed, reverted."
        );
    }
}
