use std::time::{SystemTime, UNIX_EPOCH};

use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{
    ApiEnvelope, AppState, authorized_user_from_headers, identity_access::Role,
    institution_id_from_user,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct AuditEvent {
    pub id: i64,
    pub actor: String,
    pub action: String,
    pub timestamp_unix: i64,
}

impl AuditEvent {
    pub fn from_request(payload: CreateAuditEventRequest) -> Self {
        Self {
            id: 0,
            actor: payload.actor,
            action: payload.action,
            timestamp_unix: payload.timestamp_unix,
        }
    }
}

#[derive(Debug, Clone)]
pub struct CreateAuditEventRequest {
    pub actor: String,
    pub action: String,
    pub timestamp_unix: i64,
}

impl CreateAuditEventRequest {
    pub fn new(actor: &str, action: &str) -> Self {
        Self {
            actor: actor.to_owned(),
            action: action.to_owned(),
            timestamp_unix: SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs() as i64,
        }
    }
}

pub struct AuditRepository {
    pool: PgPool,
}

impl AuditRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn push_event(
        &self,
        institution_id: i64,
        event: AuditEvent,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            "INSERT INTO audit_events (institution_id, actor, action, timestamp_unix) VALUES ($1, $2, $3, $4)",
        )
            .bind(institution_id)
            .bind(event.actor)
            .bind(event.action)
            .bind(event.timestamp_unix)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list(&self, institution_id: i64) -> Result<Vec<AuditEvent>, sqlx::Error> {
        sqlx::query_as::<_, AuditEvent>(
            "SELECT id, actor, action, timestamp_unix FROM audit_events WHERE institution_id = $1 ORDER BY id ASC",
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/audit/events", get(list_events))
        .with_state(state)
}

async fn list_events(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<AuditEvent>>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Auditor]) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    match state.audit_repo.list(institution_id).await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!(
                "failed to list audit events: {err}"
            ))),
        ),
    }
}
