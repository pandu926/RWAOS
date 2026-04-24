use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Transfer {
    pub id: i64,
    pub asset_id: i64,
    pub from_investor_id: i64,
    pub to_investor_id: i64,
    pub amount: f64,
}

#[derive(Debug, Deserialize)]
pub struct CreateTransferRequest {
    pub asset_id: u64,
    pub from_investor_id: u64,
    pub to_investor_id: u64,
    pub amount: f64,
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
            "INSERT INTO transfers (asset_id, from_investor_id, to_investor_id, amount) VALUES ($1, $2, $3, $4) RETURNING id, asset_id, from_investor_id, to_investor_id, amount",
        )
        .bind(payload.asset_id as i64)
        .bind(payload.from_investor_id as i64)
        .bind(payload.to_investor_id as i64)
        .bind(payload.amount)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Transfer>, sqlx::Error> {
        sqlx::query_as::<_, Transfer>(
            "SELECT id, asset_id, from_investor_id, to_investor_id, amount FROM transfers ORDER BY id ASC",
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
    Json(payload): Json<CreateTransferRequest>,
) -> Json<ApiEnvelope<Transfer>> {
    match state.transfer_repo.create(payload).await {
        Ok(created) => Json(ApiEnvelope::ok(created)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to create transfer: {err}"))),
    }
}
