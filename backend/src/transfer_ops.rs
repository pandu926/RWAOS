use axum::{
    Json, Router, extract::State, extract::rejection::JsonRejection, http::StatusCode, routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transfer {
    pub id: i64,
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferRequest {
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
    pub tx_hash: Option<String>,
}

pub struct TransferRepository {
    pool: PgPool,
}

impl TransferRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, payload: CreateTransferRequest) -> Result<Transfer, sqlx::Error> {
        sqlx::query_as::<_, Transfer>(
            "INSERT INTO transfers (asset_id, from_investor_id, to_investor_id, amount, tx_hash) VALUES ($1, $2, $3, $4, $5) RETURNING id, asset_id, from_investor_id, to_investor_id, amount, tx_hash",
        )
        .bind(payload.asset_id)
        .bind(payload.from_investor_id)
        .bind(payload.to_investor_id)
        .bind(payload.amount)
        .bind(payload.tx_hash)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Transfer>, sqlx::Error> {
        sqlx::query_as::<_, Transfer>(
            "SELECT id, asset_id, from_investor_id, to_investor_id, amount, tx_hash FROM transfers ORDER BY id ASC",
        )
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/transfers", get(list).post(create))
        .with_state(state)
}

async fn list(State(state): State<AppState>) -> Json<ApiEnvelope<Vec<Transfer>>> {
    match state.transfer_repo.list().await {
        Ok(items) => Json(ApiEnvelope::ok(items)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to list transfers: {err}"))),
    }
}

async fn create(
    State(state): State<AppState>,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<Transfer>>) {
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

    match state.transfer_repo.create(payload).await {
        Ok(created) => (StatusCode::OK, Json(ApiEnvelope::ok(created))),
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

    Ok(CreateTransferRequest {
        asset_id,
        from_investor_id,
        to_investor_id,
        amount,
        tx_hash,
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
    } else if field.ends_with("tx_hash") && !looks_like_prefixed_hex(trimmed) {
        Err(format!(
            "`{field}` must be a 0x-prefixed transaction hash when provided."
        ))
    } else {
        Ok(Some(trimmed.to_owned()))
    }
}

fn looks_like_prefixed_hex(value: &str) -> bool {
    value.len() >= 4
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
            "tx_hash": " 0xabc123 "
        }))
        .expect("payload should parse");

        assert_eq!(parsed.asset_id, 1);
        assert_eq!(parsed.from_investor_id, 2);
        assert_eq!(parsed.to_investor_id, 3);
        assert_eq!(parsed.amount, 125000.50);
        assert_eq!(parsed.tx_hash.as_deref(), Some("0xabc123"));
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
            "`tx_hash` must be a 0x-prefixed transaction hash when provided."
        );
    }
}
