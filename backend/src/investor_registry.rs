use axum::{
    Json, Router,
    extract::{State, rejection::JsonRejection},
    http::StatusCode,
    routing::get,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Investor {
    pub id: i64,
    pub legal_name: String,
    pub jurisdiction: String,
    pub wallet_address: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvestorRequest {
    pub legal_name: String,
    pub jurisdiction: String,
    pub wallet_address: Option<String>,
}

pub struct InvestorRepository {
    pool: PgPool,
}

impl InvestorRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, payload: CreateInvestorRequest) -> Result<Investor, sqlx::Error> {
        sqlx::query_as::<_, Investor>(
            "INSERT INTO investors (legal_name, jurisdiction, wallet_address) VALUES ($1, $2, $3) RETURNING id, legal_name, jurisdiction, wallet_address",
        )
        .bind(payload.legal_name)
        .bind(payload.jurisdiction)
        .bind(payload.wallet_address)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Investor>, sqlx::Error> {
        sqlx::query_as::<_, Investor>(
            "SELECT id, legal_name, jurisdiction, wallet_address FROM investors ORDER BY id ASC",
        )
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/investors", get(list).post(create))
        .with_state(state)
}

async fn list(State(state): State<AppState>) -> Json<ApiEnvelope<Vec<Investor>>> {
    match state.investor_repo.list().await {
        Ok(items) => Json(ApiEnvelope::ok(items)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to list investors: {err}"))),
    }
}

async fn create(
    State(state): State<AppState>,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<Investor>>) {
    let payload = match payload {
        Ok(Json(value)) => match parse_create_investor_request(&value) {
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

    match state.investor_repo.create(payload).await {
        Ok(created) => (StatusCode::OK, Json(ApiEnvelope::ok(created))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to create investor: {err}"
            ))),
        ),
    }
}

fn parse_create_investor_request(value: &Value) -> Result<CreateInvestorRequest, String> {
    let payload = value
        .as_object()
        .ok_or_else(|| "investor payload must be a JSON object.".to_owned())?;

    let legal_name = parse_required_string(payload.get("legal_name"), "legal_name")?;
    let jurisdiction = parse_required_string(payload.get("jurisdiction"), "jurisdiction")?;
    let wallet_address = parse_optional_wallet_address(payload.get("wallet_address"))?;

    Ok(CreateInvestorRequest {
        legal_name,
        jurisdiction,
        wallet_address,
    })
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

fn parse_optional_wallet_address(value: Option<&Value>) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };

    if value.is_null() {
        return Ok(None);
    }

    let text = value
        .as_str()
        .ok_or_else(|| "`wallet_address` must be a string when provided.".to_owned())?;
    let normalized = text.trim().to_ascii_lowercase();

    if normalized.is_empty() {
        return Ok(None);
    }

    if !looks_like_evm_address(&normalized) {
        return Err(
            "`wallet_address` must be a 0x-prefixed 20-byte hex address, for example `0x1234...abcd`."
                .to_owned(),
        );
    }

    Ok(Some(normalized))
}

fn looks_like_evm_address(value: &str) -> bool {
    value.len() == 42
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_create_investor_request;

    #[test]
    fn accepts_optional_wallet_address() {
        let parsed = parse_create_investor_request(&json!({
            "legal_name": "Aster Capital LLC",
            "jurisdiction": "US",
            "wallet_address": " 0xF21B5742477A5E065EF86DEDba40b34527Ac93fD "
        }))
        .expect("payload should parse");

        assert_eq!(
            parsed.wallet_address.as_deref(),
            Some("0xf21b5742477a5e065ef86dedba40b34527ac93fd")
        );
    }

    #[test]
    fn rejects_invalid_wallet_address_with_clear_message() {
        let error = parse_create_investor_request(&json!({
            "legal_name": "Aster Capital LLC",
            "jurisdiction": "US",
            "wallet_address": "wallet-1"
        }))
        .expect_err("payload should fail");

        assert_eq!(
            error,
            "`wallet_address` must be a 0x-prefixed 20-byte hex address, for example `0x1234...abcd`."
        );
    }
}
