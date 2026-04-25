use std::time::{SystemTime, UNIX_EPOCH};

use axum::{Json, Router, extract::State, routing::get};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

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

    pub async fn push_event(&self, event: AuditEvent) -> Result<(), sqlx::Error> {
        sqlx::query("INSERT INTO audit_events (actor, action, timestamp_unix) VALUES ($1, $2, $3)")
            .bind(event.actor)
            .bind(event.action)
            .bind(event.timestamp_unix)
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn list(&self) -> Result<Vec<AuditEvent>, sqlx::Error> {
        sqlx::query_as::<_, AuditEvent>(
            "SELECT id, actor, action, timestamp_unix FROM audit_events ORDER BY id ASC",
        )
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/audit/events", get(list_events))
        .with_state(state)
}

async fn list_events(State(state): State<AppState>) -> Json<ApiEnvelope<Vec<AuditEvent>>> {
    match state.audit_repo.list().await {
        Ok(items) => Json(ApiEnvelope::ok(items)),
        Err(err) => Json(ApiEnvelope::err(format!(
            "failed to list audit events: {err}"
        ))),
    }
}
