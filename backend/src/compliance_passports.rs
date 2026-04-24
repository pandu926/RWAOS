use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::{Path, State},
    http::{HeaderMap, StatusCode, header},
    routing::{get, post},
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{
    ApiEnvelope, AppState,
    identity_access::{AuthUser, Role},
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct CompliancePassport {
    pub id: i64,
    pub transfer_id: i64,
    pub policy_hash: String,
    pub disclosure_data_id: String,
    pub anchor_hash: String,
    pub status: String,
    pub transfer_tx_hash: String,
    pub anchor_tx_hash: String,
    pub created_by: String,
    pub created_by_role: String,
    pub created_at_unix: i64,
    pub last_accessed_unix: Option<i64>,
}

#[derive(Debug, Deserialize)]
pub struct CreateCompliancePassportRequest {
    pub transfer_id: i64,
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
        payload: CreateCompliancePassportRequest,
        created_by: &str,
        created_by_role: &str,
    ) -> Result<CompliancePassport, sqlx::Error> {
        let scope_serialized = payload.disclosure_scope.join(", ");
        let now = now_unix();

        sqlx::query_as::<_, CompliancePassport>(
            r#"
            INSERT INTO compliance_passports (
                transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, disclosure_scope, reason,
                created_by, created_by_role, created_at_unix
            )
            VALUES ($1, $2, $3, $4, 'Anchored', $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (transfer_id) DO UPDATE
            SET
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
            RETURNING id, transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, created_by, created_by_role,
                created_at_unix, last_accessed_unix
            "#,
        )
        .bind(payload.transfer_id)
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

    pub async fn list(&self) -> Result<Vec<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            SELECT id, transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, created_by, created_by_role,
                created_at_unix, last_accessed_unix
            FROM compliance_passports
            ORDER BY transfer_id ASC
            "#,
        )
        .fetch_all(&self.pool)
        .await
    }

    pub async fn find_by_transfer_id(
        &self,
        transfer_id: i64,
    ) -> Result<Option<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            SELECT id, transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, created_by, created_by_role,
                created_at_unix, last_accessed_unix
            FROM compliance_passports
            WHERE transfer_id = $1
            "#,
        )
        .bind(transfer_id)
        .fetch_optional(&self.pool)
        .await
    }

    pub async fn mark_accessed(&self, transfer_id: i64) -> Result<Option<CompliancePassport>, sqlx::Error> {
        sqlx::query_as::<_, CompliancePassport>(
            r#"
            UPDATE compliance_passports
            SET last_accessed_unix = $2
            WHERE transfer_id = $1
            RETURNING id, transfer_id, policy_hash, disclosure_data_id, anchor_hash, status,
                transfer_tx_hash, anchor_tx_hash, created_by, created_by_role,
                created_at_unix, last_accessed_unix
            "#,
        )
        .bind(transfer_id)
        .bind(now_unix())
        .fetch_optional(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/compliance/passports", get(list).post(create))
        .route("/compliance/passports/{transfer_id}", get(get_by_transfer_id))
        .route("/compliance/passports/{transfer_id}/access", post(access))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<CompliancePassport>>>) {
    if authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]).is_none() {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport listing")),
        );
    }

    match state.compliance_passport_repo.list().await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!("failed to list compliance passports: {err}"))),
        ),
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateCompliancePassportRequest>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Operator]) else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport issuance")),
        );
    };

    match state
        .compliance_passport_repo
        .create(payload, &user.username, role_as_str(user.role))
        .await
    {
        Ok(created) => (StatusCode::OK, Json(ApiEnvelope::ok(created))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!("failed to create compliance passport: {err}"))),
        ),
    }
}

async fn get_by_transfer_id(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(transfer_id): Path<i64>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    if authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]).is_none() {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport detail")),
        );
    }

    match state.compliance_passport_repo.find_by_transfer_id(transfer_id).await {
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
    Path(transfer_id): Path<i64>,
    Json(payload): Json<AccessCompliancePassportRequest>,
) -> (StatusCode, Json<ApiEnvelope<CompliancePassport>>) {
    let Some(user) = authorize_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]) else {
        return (
            StatusCode::FORBIDDEN,
            Json(ApiEnvelope::err("insufficient role for passport access")),
        );
    };

    let action = format!(
        "compliance_passport_accessed:transfer_id={transfer_id}:reason={}",
        payload.reason_code
    );
    let event = crate::audit_reporting::AuditEvent::from_request(
        crate::audit_reporting::CreateAuditEventRequest::new(&user.username, &action),
    );
    let _ = state.audit_repo.push_event(event).await;

    match state.compliance_passport_repo.mark_accessed(transfer_id).await {
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

fn authorize_from_headers(state: &AppState, headers: &HeaderMap, allowed: &[Role]) -> Option<AuthUser> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))?;
    let user = state.auth_tokens.get(token)?;
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
