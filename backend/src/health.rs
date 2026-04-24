use axum::{Json, Router, routing::get};

use crate::ApiEnvelope;

pub fn routes() -> Router {
    Router::new()
        .route("/health/live", get(live))
        .route("/health/ready", get(ready))
}

async fn live() -> Json<ApiEnvelope<&'static str>> {
    Json(ApiEnvelope::ok("alive"))
}

async fn ready() -> Json<ApiEnvelope<&'static str>> {
    Json(ApiEnvelope::ok("ready"))
}
