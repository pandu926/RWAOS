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
pub struct Disclosure {
    pub id: i64,
    pub asset_id: i64,
    pub title: String,
    pub content: String,
    pub data_id: Option<String>,
    pub grantee: Option<String>,
    pub expires_at: Option<i64>,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CreateDisclosureRequest {
    pub asset_id: u64,
    pub title: String,
    pub content: String,
    pub data_id: Option<String>,
    pub grantee: Option<String>,
    pub expires_at: Option<i64>,
    pub tx_hash: Option<String>,
}

pub struct DisclosureRepository {
    pool: PgPool,
}

impl DisclosureRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        institution_id: i64,
        payload: CreateDisclosureRequest,
    ) -> Result<Disclosure, sqlx::Error> {
        sqlx::query_as::<_, Disclosure>(
            r#"
            INSERT INTO disclosures (
                institution_id, asset_id, title, content, data_id, grantee, expires_at, tx_hash
            )
            SELECT $1, $2, $3, $4, $5, $6, $7, $8
            WHERE EXISTS (
                SELECT 1 FROM assets WHERE id = $2 AND institution_id = $1
            )
            RETURNING id, asset_id, title, content, data_id, grantee, expires_at, tx_hash
            "#,
        )
        .bind(institution_id)
        .bind(payload.asset_id as i64)
        .bind(payload.title)
        .bind(payload.content)
        .bind(payload.data_id)
        .bind(payload.grantee)
        .bind(payload.expires_at)
        .bind(payload.tx_hash)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self, institution_id: i64) -> Result<Vec<Disclosure>, sqlx::Error> {
        sqlx::query_as::<_, Disclosure>(
            "SELECT id, asset_id, title, content, data_id, grantee, expires_at, tx_hash FROM disclosures WHERE institution_id = $1 ORDER BY id ASC",
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/disclosures", get(list).post(create))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<Disclosure>>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    match state.disclosure_repo.list(institution_id).await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to list disclosures: {err}"
            ))),
        ),
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<Disclosure>>) {
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
        Ok(Json(value)) => match parse_create_disclosure_request(&value) {
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

    match state.disclosure_repo.create(institution_id, payload).await {
        Ok(created) => {
            let action = format!(
                "disclosure_granted:id={}:asset_id={}:data_id={}:grantee={}:tx={}",
                created.id,
                created.asset_id,
                created.data_id.as_deref().unwrap_or("none"),
                created.grantee.as_deref().unwrap_or("none"),
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
            Json(ApiEnvelope::err("asset is outside your institution scope")),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to create disclosure: {err}"
            ))),
        ),
    }
}

fn parse_create_disclosure_request(value: &Value) -> Result<CreateDisclosureRequest, String> {
    let payload = value
        .as_object()
        .ok_or_else(|| "disclosure payload must be a JSON object.".to_owned())?;

    Ok(CreateDisclosureRequest {
        asset_id: parse_positive_u64(payload.get("asset_id"), "asset_id")?,
        title: parse_required_string(payload.get("title"), "title")?,
        content: parse_required_string(payload.get("content"), "content")?,
        data_id: parse_optional_non_empty_string(payload.get("data_id"), "data_id")?,
        grantee: parse_optional_non_empty_string(payload.get("grantee"), "grantee")?,
        expires_at: parse_optional_positive_i64(payload.get("expires_at"), "expires_at")?,
        tx_hash: parse_optional_hex_string(payload.get("tx_hash"), "tx_hash")?,
    })
}

fn parse_positive_u64(value: Option<&Value>, field: &str) -> Result<u64, String> {
    let value = value.ok_or_else(|| format!("`{field}` is required."))?;

    if let Some(number) = value.as_u64() {
        if number > 0 {
            return Ok(number);
        }
    }

    if let Some(number) = value.as_i64() {
        if number > 0 {
            return Ok(number as u64);
        }
    }

    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if let Ok(parsed) = trimmed.parse::<u64>() {
            if parsed > 0 {
                return Ok(parsed);
            }
        }
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

fn parse_optional_non_empty_string(
    value: Option<&Value>,
    field: &str,
) -> Result<Option<String>, String> {
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

    if let Some(number) = value.as_i64() {
        if number > 0 {
            return Ok(Some(number));
        }
    }

    if let Some(number) = value.as_u64() {
        return i64::try_from(number)
            .map(Some)
            .map_err(|_| format!("`{field}` is too large."));
    }

    if let Some(text) = value.as_str() {
        let trimmed = text.trim();
        if trimmed.is_empty() {
            return Ok(None);
        }

        return trimmed
            .parse::<i64>()
            .map_err(|_| format!("`{field}` must be a Unix timestamp in seconds."))
            .and_then(|parsed| {
                if parsed > 0 {
                    Ok(Some(parsed))
                } else {
                    Err(format!("`{field}` must be a Unix timestamp in seconds."))
                }
            });
    }

    Err(format!("`{field}` must be a Unix timestamp in seconds."))
}

fn parse_optional_hex_string(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let parsed = parse_optional_non_empty_string(value, field)?;
    if let Some(ref text) = parsed {
        if !looks_like_prefixed_hex(text) {
            return Err(format!(
                "`{field}` must be a 0x-prefixed hex string when provided."
            ));
        }
    }
    Ok(parsed)
}

fn looks_like_prefixed_hex(value: &str) -> bool {
    value.len() >= 4
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::parse_create_disclosure_request;

    #[test]
    fn accepts_onchain_metadata_fields() {
        let parsed = parse_create_disclosure_request(&json!({
            "asset_id": "1",
            "title": "Monthly NAV Verification",
            "content": "Granted to compliance",
            "data_id": "data-123",
            "grantee": "auditor",
            "expires_at": 1735689600,
            "tx_hash": "0xabc123"
        }))
        .expect("payload should parse");

        assert_eq!(parsed.asset_id, 1);
        assert_eq!(parsed.data_id.as_deref(), Some("data-123"));
        assert_eq!(parsed.grantee.as_deref(), Some("auditor"));
        assert_eq!(parsed.expires_at, Some(1735689600));
        assert_eq!(parsed.tx_hash.as_deref(), Some("0xabc123"));
    }

    #[test]
    fn rejects_invalid_disclosure_tx_hash() {
        let error = parse_create_disclosure_request(&json!({
            "asset_id": 1,
            "title": "Monthly NAV Verification",
            "content": "Granted to compliance",
            "tx_hash": "abc123"
        }))
        .expect_err("payload should fail");

        assert_eq!(
            error,
            "`tx_hash` must be a 0x-prefixed hex string when provided."
        );
    }
}
