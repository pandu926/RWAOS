use axum::{
    Json, Router,
    extract::State,
    routing::get,
};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Serialize, Deserialize, FromRow)]
pub struct Investor {
    pub id: i64,
    pub legal_name: String,
    pub jurisdiction: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateInvestorRequest {
    pub legal_name: String,
    pub jurisdiction: String,
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
            "INSERT INTO investors (legal_name, jurisdiction) VALUES ($1, $2) RETURNING id, legal_name, jurisdiction",
        )
        .bind(payload.legal_name)
        .bind(payload.jurisdiction)
        .fetch_one(&self.pool)
        .await
    }

    pub async fn list(&self) -> Result<Vec<Investor>, sqlx::Error> {
        sqlx::query_as::<_, Investor>(
            "SELECT id, legal_name, jurisdiction FROM investors ORDER BY id ASC",
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
    Json(payload): Json<CreateInvestorRequest>,
) -> Json<ApiEnvelope<Investor>> {
    match state.investor_repo.create(payload).await {
        Ok(created) => Json(ApiEnvelope::ok(created)),
        Err(err) => Json(ApiEnvelope::err(format!("failed to create investor: {err}"))),
    }
}
