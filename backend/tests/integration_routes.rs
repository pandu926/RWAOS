use axum::{
    body::{self, Body},
    http::{Method, Request, StatusCode, header},
};
use confidential_rwa_os_backend::{AppState, build_app};
use tower::ServiceExt;

#[tokio::test]
async fn health_endpoint_returns_success_envelope() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/health/live")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::OK);

    let body = body::to_bytes(res.into_body(), usize::MAX)
        .await
        .expect("body read failed");
    let json: serde_json::Value = serde_json::from_slice(&body).expect("invalid json");
    assert_eq!(json["success"], true);
    assert_eq!(json["data"], "alive");
}

#[tokio::test]
async fn protected_endpoint_requires_bearer_token() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/assets")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn operator_can_access_auth_me() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/auth/me")
        .header(header::AUTHORIZATION, "Bearer operator-token")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn compliance_passports_requires_role() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/compliance/passports")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn operator_cannot_list_compliance_passports() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/compliance/passports")
        .header(header::AUTHORIZATION, "Bearer operator-token")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}
