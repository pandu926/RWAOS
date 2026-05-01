use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::{Path, State, rejection::JsonRejection},
    http::{HeaderMap, StatusCode, header},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};

use crate::{
    ApiEnvelope, AppState,
    identity_access::{AuthUser, Role},
    institution_id_from_user,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CompliancePassport {
    pub id: i64,
    pub transfer_record_id: i64,
    pub transfer_id_onchain: Option<String>,
    pub policy_hash: String,
    pub disclosure_data_id: String,
    pub anchor_hash: String,
    pub status: String,
    pub transfer_tx_hash: String,
    pub anchor_tx_hash: String,
    pub disclosure_scope: String,
    pub reason: String,
    pub created_by: String,
    pub created_by_role: String,
    pub created_at_unix: i64,
    pub last_accessed_unix: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCompliancePassportRequest {
    pub transfer_record_id: i64,
    pub transfer_id_onchain: Option<String>,
    pub disclosure_scope: Vec<String>,
    pub policy_hash: String,
    pub disclosure_data_id: String,
    pub anchor_hash: String,
    pub transfer_tx_hash: String,
    pub anchor_tx_hash: String,
    pub reason: String,
}

#[derive(Debug, Deserialize)]
pub struct AccessCompliancePassportRequest {
    pub reason_code: String,
}

pub struct CompliancePassportRepository {
    pool: PgPool,
}

impl CompliancePassportRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        institution_id: i64,
        payload: CreateCompliancePassportRequest,
        created_by: &str,
        created_by_role: &str,
    ) -> Result<CompliancePassport, sqlx::Error> {
        let scope_serialized = payload.disclosure_scope.join(", ");
        let now = now_unix();

        sqlx::query_as::<_, CompliancePassport>(
            r#"
            INSERT INTO compliance_passports (
                institution_id, transfer_id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix
            )
            SELECT $1, $2, $2, $3, $4, $5, $6, 'Anchored', $7, $8, $9, $10, $11, $12, $13
            WHERE EXISTS (
                SELECT 1 FROM transfers WHERE id = $2 AND institution_id = $1
            )
            ON CONFLICT (institution_id, transfer_record_id) DO UPDATE
            SET
                transfer_id = EXCLUDED.transfer_id,
                transfer_id_onchain = EXCLUDED.transfer_id_onchain,
                policy_hash = EXCLUDED.policy_hash,
                disclosure_data_id = EXCLUDED.disclosure_data_id,
                anchor_hash = EXCLUDED.anchor_hash,
                status = EXCLUDED.status,
                transfer_tx_hash = EXCLUDED.transfer_tx_hash,
                anchor_tx_hash = EXCLUDED.anchor_tx_hash,
                disclosure_scope = EXCLUDED.disclosure_scope,
                reason = EXCLUDED.reason,
                created_by = EXCLUDED.created_by,
                created_by_role = EXCLUDED.created_by_role,
                created_at_unix = EXCLUDED.created_at_unix
            RETURNING id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id,
                anchor_hash, status, transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            "#,
        )
        .bind(institution_id)
        .bind(payload.transfer_record_id)
        .bind(payload.transfer_id_onchain)
        .bind(payload.policy_hash)
        .bind(payload.disclosure_data_id)
        .bind(payload.anchor_hash)
        .bind(payload.transfer_tx_hash)
        .bind(payload.anchor_tx_hash)
        .bind(scope_serialized)
        .bind(payload.reason)
        .bind(created_by)
        .bind(created_by_role)
        .bind(now)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self, institution_id: i64) -> Result<Vec<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            SELECT id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id,
                anchor_hash, status, transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            FROM compliance_passports
            WHERE institution_id = $1
            ORDER BY transfer_record_id ASC
            "#,
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_by_transfer_record_id(
        &self,
        institution_id: i64,
        transfer_record_id: i64,
    ) -> Result<Option<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            SELECT id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id,
                anchor_hash, status, transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            FROM compliance_passports
            WHERE institution_id = $1 AND transfer_record_id = $2
            "#,
        )
        .bind(institution_id)
        .bind(transfer_record_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn mark_accessed(
        &self,
        institution_id: i64,
        transfer_record_id: i64,
    ) -> Result<Option<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            UPDATE compliance_passports
            SET last_accessed_unix = $2
            WHERE institution_id = $1 AND transfer_record_id = $3
            RETURNING id, transfer_record_id, transfer_id_onchain, policy_hash, disclosure_data_id,
                anchor_hash, status, transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix, last_accessed_unix
            "#,
        )
        .bind(institution_id)
        .bind(now_unix())
        .bind(transfer_record_id)
        .fetch_optional(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/compliance/passports", get(list).post(create))
        .route(
            "/compliance/passports/{transfer_id}",
            get(get_by_transfer_id),
        )
        .route("/compliance/passports/{transfer_id}/access", post(access))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<CompliancePassport>>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]) else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport listing")),
        );
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(_) => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiEnvelope::err("missing institution scope")),
            );
        }
    };

    match state.compliance_passport_repo.list(institution_id).await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to list compliance passports: {err}"
            ))),
        ),
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    payload: Result<Json<Value>, JsonRejection>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport issuance")),
        );
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(_) => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiEnvelope::err("missing institution scope")),
            );
        }
    };

    let payload = match payload {
        Ok(Json(value)) => match parse_create_compliance_passport_request(&value) {
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

    match state
        .compliance_passport_repo
        .create(
            institution_id,
            payload,
            &user.username,
            role_as_str(user.role),
        )
        .await
    {
        Ok(created) => {
            let action = format!(
                "passport_issued:id={}:transfer_record_id={}:transfer_id_onchain={}:data_id={}:policy_hash={}:anchor_hash={}:anchor_tx={}:transfer_tx={}",
                created.id,
                created.transfer_record_id,
                created.transfer_id_onchain.as_deref().unwrap_or("none"),
                created.disclosure_data_id,
                created.policy_hash,
                created.anchor_hash,
                created.anchor_tx_hash,
                created.transfer_tx_hash,
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
                "transfer record is outside your institution scope",
            )),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to create compliance passport: {err}"
            ))),
        ),
    }
}

async fn get_by_transfer_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(transfer_record_id): Path<i64>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]) else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport detail")),
        );
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(_) => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiEnvelope::err("missing institution scope")),
            );
        }
    };

    match state
        .compliance_passport_repo
        .find_by_transfer_record_id(institution_id, transfer_record_id)
        .await
    {
        Ok(Some(item)) => (StatusCode::OK, Json(ApiEnvelope::ok(item))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiEnvelope::err("compliance passport not found")),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to fetch compliance passport detail: {err}"
            ))),
        ),
    }
}

async fn access(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(transfer_record_id): Path<i64>,
    Json(payload): Json<AccessCompliancePassportRequest>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]) else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport access")),
        );
    };

    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(_) => {
            return (
                StatusCode::FORBIDDEN,
                Json(ApiEnvelope::err("missing institution scope")),
            );
        }
    };

    let action = format!(
        "compliance_passport_accessed:transfer_record_id={transfer_record_id}:reason={}",
        payload.reason_code
    );
    let event = crate::audit_reporting::AuditEvent::from_request(
        crate::audit_reporting::CreateAuditEventRequest::new(&user.username, &action),
    );
    let _ = state.audit_repo.push_event(institution_id, event).await;

    match state
        .compliance_passport_repo
        .mark_accessed(institution_id, transfer_record_id)
        .await
    {
        Ok(Some(item)) => (StatusCode::OK, Json(ApiEnvelope::ok(item))),
        Ok(None) => (
            StatusCode::NOT_FOUND,
            Json(ApiEnvelope::err("compliance passport not found")),
        ),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to update compliance passport access state: {err}"
            ))),
        ),
    }
}

fn authorize_from_headers(
    state: &AppState,
    headers: &HeaderMap,
    allowed: &[Role],
) -> Option<AuthUser> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))?;
    let user = crate::identity_access::resolve_session_user_from_token(state, token)?;
    if allowed.iter().any(|role| role == &user.role) {
        Some(user.clone())
    } else {
        None
    }
}

fn role_as_str(role: Role) -> &'static str {
    match role {
        Role::Admin => "admin",
        Role::Operator => "operator",
        Role::Auditor => "auditor",
    }
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs() as i64
}

fn parse_create_compliance_passport_request(
    value: &Value,
) -> Result<CreateCompliancePassportRequest, String> {
    let payload = value
        .as_object()
        .ok_or_else(|| "compliance passport payload must be a JSON object.".to_owned())?;

    let disclosure_scope = parse_disclosure_scope(payload.get("disclosure_scope"))?;

    Ok(CreateCompliancePassportRequest {
        transfer_record_id: parse_positive_i64(
            payload
                .get("transfer_record_id")
                .or_else(|| payload.get("transfer_id")),
            "transfer_record_id",
        )?,
        transfer_id_onchain: parse_optional_bytes32(
            payload.get("transfer_id_onchain"),
            "transfer_id_onchain",
        )?,
        disclosure_scope,
        policy_hash: parse_required_bytes32(payload.get("policy_hash"), "policy_hash")?,
        disclosure_data_id: parse_required_prefixed_hex_or_text(
            payload.get("disclosure_data_id"),
            "disclosure_data_id",
        )?,
        anchor_hash: parse_required_bytes32(payload.get("anchor_hash"), "anchor_hash")?,
        transfer_tx_hash: parse_required_tx_hash(
            payload.get("transfer_tx_hash"),
            "transfer_tx_hash",
        )?,
        anchor_tx_hash: parse_required_tx_hash(payload.get("anchor_tx_hash"), "anchor_tx_hash")?,
        reason: parse_required_string(payload.get("reason"), "reason")?,
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
        if looks_like_uuid(trimmed) {
            return Err(format!(
                "`{field}` must be the backend numeric transfer record ID, not a UUID."
            ));
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

fn parse_disclosure_scope(value: Option<&Value>) -> Result<Vec<String>, String> {
    let value = value.ok_or_else(|| "`disclosure_scope` is required.".to_owned())?;
    let items = value
        .as_array()
        .ok_or_else(|| "`disclosure_scope` must be an array of non-empty strings.".to_owned())?;

    let parsed: Vec<String> = items
        .iter()
        .map(|item| {
            item.as_str()
                .map(str::trim)
                .filter(|item| !item.is_empty())
                .map(ToOwned::to_owned)
                .ok_or_else(|| "`disclosure_scope` must contain only non-empty strings.".to_owned())
        })
        .collect::<Result<_, _>>()?;

    if parsed.is_empty() {
        Err("`disclosure_scope` must contain at least one grantee or audience.".to_owned())
    } else {
        Ok(parsed)
    }
}

fn parse_required_bytes32(value: Option<&Value>, field: &str) -> Result<String, String> {
    let text = parse_required_string(value, field)?;
    if !looks_like_bytes32(&text) {
        return Err(format!(
            "`{field}` must be a 0x-prefixed 32-byte hex value."
        ));
    }
    Ok(text)
}

fn parse_optional_bytes32(value: Option<&Value>, field: &str) -> Result<Option<String>, String> {
    let Some(value) = value else {
        return Ok(None);
    };
    if value.is_null() {
        return Ok(None);
    }
    let text = parse_required_string(Some(value), field)?;
    if !looks_like_bytes32(&text) {
        return Err(format!(
            "`{field}` must be a 0x-prefixed 32-byte hex value when provided."
        ));
    }
    Ok(Some(text))
}

fn parse_required_tx_hash(value: Option<&Value>, field: &str) -> Result<String, String> {
    let text = parse_required_string(value, field)?;
    if !looks_like_prefixed_hex(&text) {
        return Err(format!("`{field}` must be a 0x-prefixed transaction hash."));
    }
    Ok(text)
}

fn parse_required_prefixed_hex_or_text(
    value: Option<&Value>,
    field: &str,
) -> Result<String, String> {
    let text = parse_required_string(value, field)?;
    if text.starts_with("0x") && !looks_like_prefixed_hex(&text) {
        return Err(format!("`{field}` starts with `0x` but is not valid hex."));
    }
    Ok(text)
}

fn looks_like_prefixed_hex(value: &str) -> bool {
    value.len() >= 4
        && value.starts_with("0x")
        && value.as_bytes()[2..].iter().all(u8::is_ascii_hexdigit)
}

fn looks_like_bytes32(value: &str) -> bool {
    value.len() == 66 && looks_like_prefixed_hex(value)
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

    use super::parse_create_compliance_passport_request;

    #[test]
    fn accepts_legacy_transfer_id_but_maps_to_transfer_record_id() {
        let parsed = parse_create_compliance_passport_request(&json!({
            "transfer_id": 7,
            "transfer_id_onchain": "0x0000000000000000000000000000000000000000000000000000000000000007",
            "disclosure_scope": ["auditor", "regulator"],
            "policy_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
            "disclosure_data_id": "data-7",
            "anchor_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
            "transfer_tx_hash": "0xabc123",
            "anchor_tx_hash": "0xdef456",
            "reason": "Checkpoint"
        }))
        .expect("payload should parse");

        assert_eq!(parsed.transfer_record_id, 7);
        assert_eq!(
            parsed.transfer_id_onchain.as_deref(),
            Some("0x0000000000000000000000000000000000000000000000000000000000000007")
        );
    }

    #[test]
    fn rejects_invalid_transfer_id_onchain() {
        let error = parse_create_compliance_passport_request(&json!({
            "transfer_record_id": 7,
            "transfer_id_onchain": "0x1234",
            "disclosure_scope": ["auditor"],
            "policy_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
            "disclosure_data_id": "data-7",
            "anchor_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
            "transfer_tx_hash": "0xabc123",
            "anchor_tx_hash": "0xdef456",
            "reason": "Checkpoint"
        }))
        .expect_err("payload should fail");

        assert_eq!(
            error,
            "`transfer_id_onchain` must be a 0x-prefixed 32-byte hex value when provided."
        );
    }
}
