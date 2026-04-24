use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Asset {
    pub id: i64,
    pub name: String,
    pub asset_type: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateAssetRequest {
    pub name: String,
    pub asset_type: String,
}

pub struct AssetRepository {
    pool: PgPool,
}

impl AssetRepository {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    pub async fn create(&self, payload: CreateAssetRequest) -> Result<Asset, sqlx::Error> {
        sqlx::query_as::<_, Asset>(
            "INSERT INTO assets (name, asset_type) VALUES ($1, $2) RETURNING id, name, asset_type",
        )
        .bind(payload.name)
        .bind(payload.asset_type)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Asset>, sqlx::Error> {
        sqlx::query_as::<_, Asset>("SELECT id, name, asset_type FROM assets ORDER BY id ASC")
            .fetch_all(&self.pool)
            .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/assets", get(list).post(create))
        .with_state(state)
}

async fn list(State(state): State<AppState>) -> Json<ApiEnvelope<Vec<Asset>>> {
    match state.asset_repo.list().await {
        Ok(items) => Json(ApiEnvelope::ok(items)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to list assets: {err}"))),
    }
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateAssetRequest>,
) -> Json<ApiEnvelope<Asset>> {
    match state.asset_repo.create(payload).await {
        Ok(created) => Json(ApiEnvelope::ok(created)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to create asset: {err}"))),
    }
}
