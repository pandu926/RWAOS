use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Disclosure {
    pub id: i64,
    pub asset_id: i64,
    pub title: String,
    pub content: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateDisclosureRequest {
    pub asset_id: u64,
    pub title: String,
    pub content: String,
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
        payload: CreateDisclosureRequest,
    ) -> Result<Disclosure, sqlx::Error> {
        sqlx::query_as::<_, Disclosure>(
            "INSERT INTO disclosures (asset_id, title, content) VALUES ($1, $2, $3) RETURNING id, asset_id, title, content",
        )
        .bind(payload.asset_id as i64)
        .bind(payload.title)
        .bind(payload.content)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Disclosure>, sqlx::Error> {
        sqlx::query_as::<_, Disclosure>(
            "SELECT id, asset_id, title, content FROM disclosures ORDER BY id ASC",
        )
        .fetch_all(&self.pool)
        .await
    }
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/disclosures", get(list).post(create))
        .with_state(state)
}

async fn list(State(state): State<AppState>) -> Json<ApiEnvelope<Vec<Disclosure>>> {
    match state.disclosure_repo.list().await {
        Ok(items) => Json(ApiEnvelope::ok(items)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to list disclosures: {err}"))),
    }
}

async fn create(
    State(state): State<AppState>,
    Json(payload): Json<CreateDisclosureRequest>,
) -> Json<ApiEnvelope<Disclosure>> {
    match state.disclosure_repo.create(payload).await {
        Ok(created) => Json(ApiEnvelope::ok(created)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to create disclosure: {err}"))),
    }
}
