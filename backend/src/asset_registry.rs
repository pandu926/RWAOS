use axum::{
    Json, Router,
    extract::State,
    http::{HeaderMap, StatusCode},
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{
    ApiEnvelope, AppState, authorized_user_from_headers, identity_access::Role,
    institution_id_from_user,
};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Asset {
    pub id: i64,
    pub name: String,
    pub asset_type: String,
    pub metadata_uri: Option<String>,
    pub issuance_wallet: Option<String>,
    pub initial_supply: Option<i64>,
    pub anchor_hash: Option<String>,
    pub anchor_tx_hash: Option<String>,
    pub issuance_tx_hash: Option<String>,
    pub created_at_unix: i64,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetRequest {
    pub name: String,
    pub asset_type: String,
    pub metadata_uri: Option<String>,
    pub issuance_wallet: Option<String>,
    pub initial_supply: Option<i64>,
    pub anchor_hash: Option<String>,
    pub anchor_tx_hash: Option<String>,
    pub issuance_tx_hash: Option<String>,
}

pub struct AssetRepository {
    pool: PgPool,
}

impl AssetRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(
        &self,
        institution_id: i64,
        payload: CreateAssetRequest,
    ) -> Result<Asset, sqlx::Error> {
        let now = now_unix();
        sqlx::query_as::<_, Asset>(
            r#"
            INSERT INTO assets (
                institution_id,
                name,
                asset_type,
                metadata_uri,
                issuance_wallet,
                initial_supply,
                anchor_hash,
                anchor_tx_hash,
                issuance_tx_hash,
                created_at_unix
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            RETURNING
                id,
                name,
                asset_type,
                metadata_uri,
                issuance_wallet,
                initial_supply,
                anchor_hash,
                anchor_tx_hash,
                issuance_tx_hash,
                created_at_unix
            "#,
        )
        .bind(institution_id)
        .bind(payload.name)
        .bind(payload.asset_type)
        .bind(payload.metadata_uri)
        .bind(payload.issuance_wallet)
        .bind(payload.initial_supply)
        .bind(payload.anchor_hash)
        .bind(payload.anchor_tx_hash)
        .bind(payload.issuance_tx_hash)
        .bind(now)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self, institution_id: i64) -> Result<Vec<Asset>, sqlx::Error> {
        sqlx::query_as::<_, Asset>(
            r#"
            SELECT
                id,
                name,
                asset_type,
                metadata_uri,
                issuance_wallet,
                initial_supply,
                anchor_hash,
                anchor_tx_hash,
                issuance_tx_hash,
                created_at_unix
            FROM assets
            WHERE institution_id = $1
            ORDER BY id ASC
            "#,
        )
        .bind(institution_id)
        .fetch_all(&self.pool)
        .await
    }
}

fn now_unix() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs() as i64)
        .unwrap_or(0)
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/assets", get(list).post(create))
        .with_state(state)
}

async fn list(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<Vec<Asset>>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    match state.asset_repo.list(institution_id).await {
        Ok(items) => (StatusCode::OK, Json(ApiEnvelope::ok(items))),
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!("failed to list assets: {err}"))),
        ),
    }
}

async fn create(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CreateAssetRequest>,
) -> (StatusCode, Json<ApiEnvelope<Asset>>) {
    let user = match authorized_user_from_headers(&state, &headers, &[Role::Admin, Role::Operator])
    {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("unauthorized"))),
    };
    let institution_id = match institution_id_from_user(&user) {
        Ok(value) => value,
        Err(code) => return (code, Json(ApiEnvelope::err("missing institution scope"))),
    };

    match state.asset_repo.create(institution_id, payload).await {
        Ok(created) => {
            let action = format!(
                "asset_issued:id={}:name={}:issuance_wallet={}:anchor_tx={}:issuance_tx={}",
                created.id,
                created.name,
                created.issuance_wallet.as_deref().unwrap_or("none"),
                created.anchor_tx_hash.as_deref().unwrap_or("none"),
                created.issuance_tx_hash.as_deref().unwrap_or("none"),
            );
            let event = crate::audit_reporting::AuditEvent::from_request(
                crate::audit_reporting::CreateAuditEventRequest::new(&user.username, &action),
            );
            let _ = state.audit_repo.push_event(institution_id, event).await;

            (StatusCode::OK, Json(ApiEnvelope::ok(created)))
        }
        Err(err) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(ApiEnvelope::err(format!("failed to create asset: {err}"))),
        ),
    }
}
