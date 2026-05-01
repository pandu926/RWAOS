use axum::{
    body::{self, Body},
    http::{Method, Request, StatusCode, header},
};
use confidential_rwa_os_backend::{AppState, build_app};
use ethers_signers::{LocalWallet, Signer};
use std::str::FromStr;
use std::time::Duration;
use tower::ServiceExt;

async fn login_token(app: &axum::Router, username: &str) -> String {
    let login_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "username": username
            })
            .to_string(),
        ))
        .expect("request build failed");

    let login_res = app
        .clone()
        .oneshot(login_req)
        .await
        .expect("login request failed");
    assert_eq!(login_res.status(), StatusCode::OK);

    let login_body = body::to_bytes(login_res.into_body(), usize::MAX)
        .await
        .expect("login body read failed");
    let login_json: serde_json::Value = serde_json::from_slice(&login_body).expect("login json");
    login_json["data"]["token"]
        .as_str()
        .expect("login token")
        .to_owned()
}

async fn wallet_login_token(app: &axum::Router, private_key: &str) -> String {
    let wallet = LocalWallet::from_str(private_key).expect("valid wallet private key");
    let address = format!("{:#x}", wallet.address());

    let challenge_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/challenge")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614
            })
            .to_string(),
        ))
        .expect("request build failed");
    let challenge_res = app
        .clone()
        .oneshot(challenge_req)
        .await
        .expect("challenge request failed");
    assert_eq!(challenge_res.status(), StatusCode::OK);

    let challenge_body = body::to_bytes(challenge_res.into_body(), usize::MAX)
        .await
        .expect("challenge body read failed");
    let challenge_json: serde_json::Value =
        serde_json::from_slice(&challenge_body).expect("challenge response json");
    let message = challenge_json["data"]["message"]
        .as_str()
        .expect("challenge message");
    let signature = wallet
        .sign_message(message)
        .await
        .expect("wallet should sign challenge")
        .to_string();

    let wallet_login_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614,
                "signature": signature
            })
            .to_string(),
        ))
        .expect("request build failed");
    let wallet_login_res = app
        .clone()
        .oneshot(wallet_login_req)
        .await
        .expect("wallet login failed");
    assert_eq!(wallet_login_res.status(), StatusCode::OK);
    let wallet_login_body = body::to_bytes(wallet_login_res.into_body(), usize::MAX)
        .await
        .expect("wallet login body read failed");
    let wallet_login_json: serde_json::Value =
        serde_json::from_slice(&wallet_login_body).expect("wallet login response json");
    wallet_login_json["data"]["token"]
        .as_str()
        .expect("signed wallet token")
        .to_owned()
}

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
    let token = login_token(&app, "operator_user").await;
    let req = Request::builder()
        .method(Method::GET)
        .uri("/auth/me")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::OK);
}

#[tokio::test]
async fn invalid_bearer_token_is_rejected_on_auth_me() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/auth/me")
        .header(header::AUTHORIZATION, "Bearer definitely-invalid-token")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn valid_wallet_token_can_access_auth_me() {
    let app = build_app(AppState::for_tests_without_db());
    let wallet =
        LocalWallet::from_str("0x59c6995e998f97a5a0044966f0945382d8d9e8b5df0cb4ce8cfc20f8b6f1f9f6")
            .expect("valid wallet private key");
    let address = "0x7b66e5678496176fc6e32fd532f5ee2e33686f09";

    let challenge_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/challenge")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614
            })
            .to_string(),
        ))
        .expect("request build failed");
    let challenge_res = app
        .clone()
        .oneshot(challenge_req)
        .await
        .expect("challenge request failed");
    assert_eq!(challenge_res.status(), StatusCode::OK);

    let challenge_body = body::to_bytes(challenge_res.into_body(), usize::MAX)
        .await
        .expect("challenge body read failed");
    let challenge_json: serde_json::Value =
        serde_json::from_slice(&challenge_body).expect("challenge response json");
    let message = challenge_json["data"]["message"]
        .as_str()
        .expect("challenge message");
    let signature = wallet
        .sign_message(message)
        .await
        .expect("wallet should sign challenge")
        .to_string();

    let wallet_login_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614,
                "signature": signature
            })
            .to_string(),
        ))
        .expect("request build failed");
    let wallet_login_res = app
        .clone()
        .oneshot(wallet_login_req)
        .await
        .expect("wallet login failed");
    let wallet_login_status = wallet_login_res.status();
    let wallet_login_body = body::to_bytes(wallet_login_res.into_body(), usize::MAX)
        .await
        .expect("wallet login body read failed");
    let wallet_login_body_text = String::from_utf8_lossy(&wallet_login_body).to_string();
    assert_eq!(
        wallet_login_status,
        StatusCode::OK,
        "wallet login failed with body: {wallet_login_body_text}"
    );
    let wallet_login_json: serde_json::Value =
        serde_json::from_slice(&wallet_login_body).expect("wallet login response json");
    let token = wallet_login_json["data"]["token"]
        .as_str()
        .expect("signed wallet token");

    let me_req = Request::builder()
        .method(Method::GET)
        .uri("/auth/me")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .expect("request build failed");
    let me_res = app.oneshot(me_req).await.expect("auth me request failed");
    assert_eq!(me_res.status(), StatusCode::OK);
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
    let token = login_token(&app, "operator_user").await;
    let req = Request::builder()
        .method(Method::GET)
        .uri("/compliance/passports")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn protected_route_rejects_invalid_bearer_token() {
    let app = build_app(AppState::for_tests_without_db());
    let req = Request::builder()
        .method(Method::GET)
        .uri("/assets")
        .header(header::AUTHORIZATION, "Bearer operator-token")
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn tenant_contracts_requires_tenant_scoped_token() {
    let app = build_app(AppState::for_tests_without_db());
    let token = login_token(&app, "operator_user").await;
    let req = Request::builder()
        .method(Method::GET)
        .uri("/tenant/contracts")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .expect("request build failed");

    let res = app.oneshot(req).await.expect("request failed");
    assert_eq!(res.status(), StatusCode::FORBIDDEN);
}

#[tokio::test]
async fn wallet_login_rejects_expired_nonce_challenge() {
    let mut state = AppState::for_tests_without_db();
    state.wallet_nonce_ttl_seconds = 1;
    let app = build_app(state);
    let wallet =
        LocalWallet::from_str("0x59c6995e998f97a5a0044966f0945382d8d9e8b5df0cb4ce8cfc20f8b6f1f9f6")
            .expect("valid wallet private key");
    let address = "0x7b66e5678496176fc6e32fd532f5ee2e33686f09";

    let challenge_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/challenge")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614
            })
            .to_string(),
        ))
        .expect("request build failed");
    let challenge_res = app
        .clone()
        .oneshot(challenge_req)
        .await
        .expect("challenge request failed");
    assert_eq!(challenge_res.status(), StatusCode::OK);

    let challenge_body = body::to_bytes(challenge_res.into_body(), usize::MAX)
        .await
        .expect("challenge body read failed");
    let challenge_json: serde_json::Value =
        serde_json::from_slice(&challenge_body).expect("challenge response json");
    let message = challenge_json["data"]["message"]
        .as_str()
        .expect("challenge message");
    let signature = wallet
        .sign_message(message)
        .await
        .expect("wallet should sign challenge")
        .to_string();

    tokio::time::sleep(Duration::from_secs(2)).await;

    let wallet_login_req = Request::builder()
        .method(Method::POST)
        .uri("/auth/wallet/login")
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "address": address,
                "chain_id": 421614,
                "signature": signature
            })
            .to_string(),
        ))
        .expect("request build failed");
    let wallet_login_res = app
        .clone()
        .oneshot(wallet_login_req)
        .await
        .expect("wallet login failed");
    assert_eq!(wallet_login_res.status(), StatusCode::UNAUTHORIZED);

    let wallet_login_body = body::to_bytes(wallet_login_res.into_body(), usize::MAX)
        .await
        .expect("wallet login body read failed");
    let wallet_login_json: serde_json::Value =
        serde_json::from_slice(&wallet_login_body).expect("wallet login response json");
    assert_eq!(
        wallet_login_json["error"].as_str(),
        Some("challenge nonce expired")
    );
}

#[tokio::test]
async fn wallet_onboarding_creates_isolated_tenant_assets() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend".to_owned());
    let state = match AppState::new(&database_url).await {
        Ok(value) => value,
        Err(err) => {
            eprintln!("skipping tenant isolation db test: {err}");
            return;
        }
    };
    let app = build_app(state);

    let token_a = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a260001",
    )
    .await;
    let token_b = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a260002",
    )
    .await;

    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time")
        .as_millis();

    let create_asset_req = Request::builder()
        .method(Method::POST)
        .uri("/assets")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "name": format!("Tenant-A Asset {unique}"),
                "asset_type": "debt"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_asset_res = app
        .clone()
        .oneshot(create_asset_req)
        .await
        .expect("create asset failed");
    assert_eq!(create_asset_res.status(), StatusCode::OK);
    let create_asset_body = body::to_bytes(create_asset_res.into_body(), usize::MAX)
        .await
        .expect("create asset body");
    let create_asset_json: serde_json::Value =
        serde_json::from_slice(&create_asset_body).expect("create asset json");
    let asset_id = create_asset_json["data"]["id"].as_i64().expect("asset id");

    let create_investor_a_req = |name: String| {
        Request::builder()
            .method(Method::POST)
            .uri("/investors")
            .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                serde_json::json!({
                    "legal_name": name,
                    "jurisdiction": "US"
                })
                .to_string(),
            ))
            .expect("request build failed")
    };
    let investor_from_res = app
        .clone()
        .oneshot(create_investor_a_req(format!("Tenant-A Sender {unique}")))
        .await
        .expect("create investor sender failed");
    assert_eq!(investor_from_res.status(), StatusCode::OK);
    let investor_from_body = body::to_bytes(investor_from_res.into_body(), usize::MAX)
        .await
        .expect("create investor sender body");
    let investor_from_json: serde_json::Value =
        serde_json::from_slice(&investor_from_body).expect("create investor sender json");
    let from_investor_id = investor_from_json["data"]["id"]
        .as_i64()
        .expect("from investor id");

    let investor_to_res = app
        .clone()
        .oneshot(create_investor_a_req(format!(
            "Tenant-A Recipient {unique}"
        )))
        .await
        .expect("create investor recipient failed");
    assert_eq!(investor_to_res.status(), StatusCode::OK);
    let investor_to_body = body::to_bytes(investor_to_res.into_body(), usize::MAX)
        .await
        .expect("create investor recipient body");
    let investor_to_json: serde_json::Value =
        serde_json::from_slice(&investor_to_body).expect("create investor recipient json");
    let to_investor_id = investor_to_json["data"]["id"]
        .as_i64()
        .expect("to investor id");

    let create_transfer_req = Request::builder()
        .method(Method::POST)
        .uri("/transfers")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "asset_id": asset_id,
                "from_investor_id": from_investor_id,
                "to_investor_id": to_investor_id,
                "amount": 1000
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_transfer_res = app
        .clone()
        .oneshot(create_transfer_req)
        .await
        .expect("create transfer failed");
    assert_eq!(create_transfer_res.status(), StatusCode::OK);
    let create_transfer_body = body::to_bytes(create_transfer_res.into_body(), usize::MAX)
        .await
        .expect("create transfer body");
    let create_transfer_json: serde_json::Value =
        serde_json::from_slice(&create_transfer_body).expect("create transfer json");
    let transfer_record_id = create_transfer_json["data"]["id"]
        .as_i64()
        .expect("transfer record id");

    let create_disclosure_req = Request::builder()
        .method(Method::POST)
        .uri("/disclosures")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "asset_id": asset_id,
                "title": format!("Disclosure {unique}"),
                "content": "Scope A"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_disclosure_res = app
        .clone()
        .oneshot(create_disclosure_req)
        .await
        .expect("create disclosure failed");
    assert_eq!(create_disclosure_res.status(), StatusCode::OK);
    let create_disclosure_body = body::to_bytes(create_disclosure_res.into_body(), usize::MAX)
        .await
        .expect("create disclosure body");
    let create_disclosure_json: serde_json::Value =
        serde_json::from_slice(&create_disclosure_body).expect("create disclosure json");
    let disclosure_id = create_disclosure_json["data"]["id"]
        .as_i64()
        .expect("disclosure id");

    let list_with_token = |path: &str, token: &str| {
        Request::builder()
            .method(Method::GET)
            .uri(path)
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
            .expect("request build failed")
    };
    let assert_not_contains_id = |items: &[serde_json::Value], id: i64| {
        assert!(
            items.iter().all(|item| item["id"].as_i64() != Some(id)),
            "tenant B unexpectedly sees id {id}"
        );
    };
    let assert_contains_id = |items: &[serde_json::Value], id: i64| {
        assert!(
            items.iter().any(|item| item["id"].as_i64() == Some(id)),
            "tenant A should see id {id}"
        );
    };

    let assets_a_res = app
        .clone()
        .oneshot(list_with_token("/assets", &token_a))
        .await
        .expect("list assets for tenant A failed");
    assert_eq!(assets_a_res.status(), StatusCode::OK);
    let assets_a_body = body::to_bytes(assets_a_res.into_body(), usize::MAX)
        .await
        .expect("assets list body");
    let assets_a_json: serde_json::Value =
        serde_json::from_slice(&assets_a_body).expect("assets list json");
    assert_contains_id(
        assets_a_json["data"].as_array().expect("assets array"),
        asset_id,
    );
    let token_a_relogin = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a260001",
    )
    .await;
    let assets_a_relogin_res = app
        .clone()
        .oneshot(list_with_token("/assets", &token_a_relogin))
        .await
        .expect("list assets for tenant A relogin failed");
    assert_eq!(assets_a_relogin_res.status(), StatusCode::OK);
    let assets_a_relogin_body = body::to_bytes(assets_a_relogin_res.into_body(), usize::MAX)
        .await
        .expect("assets relogin list body");
    let assets_a_relogin_json: serde_json::Value =
        serde_json::from_slice(&assets_a_relogin_body).expect("assets relogin list json");
    assert_contains_id(
        assets_a_relogin_json["data"]
            .as_array()
            .expect("assets relogin array"),
        asset_id,
    );

    let assets_b_res = app
        .clone()
        .oneshot(list_with_token("/assets", &token_b))
        .await
        .expect("list assets for tenant B failed");
    assert_eq!(assets_b_res.status(), StatusCode::OK);
    let assets_b_body = body::to_bytes(assets_b_res.into_body(), usize::MAX)
        .await
        .expect("assets list body");
    let assets_b_json: serde_json::Value =
        serde_json::from_slice(&assets_b_body).expect("assets list json");
    assert_not_contains_id(
        assets_b_json["data"].as_array().expect("assets array"),
        asset_id,
    );

    let investors_b_res = app
        .clone()
        .oneshot(list_with_token("/investors", &token_b))
        .await
        .expect("list investors for tenant B failed");
    assert_eq!(investors_b_res.status(), StatusCode::OK);
    let investors_b_body = body::to_bytes(investors_b_res.into_body(), usize::MAX)
        .await
        .expect("investors list body");
    let investors_b_json: serde_json::Value =
        serde_json::from_slice(&investors_b_body).expect("investors list json");
    assert_not_contains_id(
        investors_b_json["data"]
            .as_array()
            .expect("investors array"),
        from_investor_id,
    );
    assert_not_contains_id(
        investors_b_json["data"]
            .as_array()
            .expect("investors array"),
        to_investor_id,
    );

    let transfers_b_res = app
        .clone()
        .oneshot(list_with_token("/transfers", &token_b))
        .await
        .expect("list transfers for tenant B failed");
    assert_eq!(transfers_b_res.status(), StatusCode::OK);
    let transfers_b_body = body::to_bytes(transfers_b_res.into_body(), usize::MAX)
        .await
        .expect("transfers list body");
    let transfers_b_json: serde_json::Value =
        serde_json::from_slice(&transfers_b_body).expect("transfers list json");
    assert_not_contains_id(
        transfers_b_json["data"]
            .as_array()
            .expect("transfers array"),
        transfer_record_id,
    );

    let disclosures_b_res = app
        .clone()
        .oneshot(list_with_token("/disclosures", &token_b))
        .await
        .expect("list disclosures for tenant B failed");
    assert_eq!(disclosures_b_res.status(), StatusCode::OK);
    let disclosures_b_body = body::to_bytes(disclosures_b_res.into_body(), usize::MAX)
        .await
        .expect("disclosures list body");
    let disclosures_b_json: serde_json::Value =
        serde_json::from_slice(&disclosures_b_body).expect("disclosures list json");
    assert_not_contains_id(
        disclosures_b_json["data"]
            .as_array()
            .expect("disclosures array"),
        disclosure_id,
    );

    let create_passport_a_req = Request::builder()
        .method(Method::POST)
        .uri("/compliance/passports")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "transfer_record_id": transfer_record_id,
                "transfer_id_onchain": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "disclosure_scope": ["auditor"],
                "policy_hash": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "disclosure_data_id": "tenant-a-data",
                "anchor_hash": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                "transfer_tx_hash": "0x1111111111111111111111111111111111111111111111111111111111111111",
                "anchor_tx_hash": "0x2222222222222222222222222222222222222222222222222222222222222222",
                "reason": "Tenant A issue"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_passport_a_res = app
        .clone()
        .oneshot(create_passport_a_req)
        .await
        .expect("create passport A failed");
    assert_eq!(create_passport_a_res.status(), StatusCode::OK);

    let get_passport_b_req = Request::builder()
        .method(Method::GET)
        .uri(format!("/compliance/passports/{transfer_record_id}"))
        .header(header::AUTHORIZATION, format!("Bearer {token_b}"))
        .body(Body::empty())
        .expect("request build failed");
    let get_passport_b_res = app
        .clone()
        .oneshot(get_passport_b_req)
        .await
        .expect("passport detail for tenant B failed");
    assert_eq!(get_passport_b_res.status(), StatusCode::NOT_FOUND);
}

#[tokio::test]
async fn tenant_contracts_are_scoped_per_wallet_tenant() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend".to_owned());
    let state = match AppState::new(&database_url).await {
        Ok(value) => value,
        Err(err) => {
            eprintln!("skipping tenant contracts db test: {err}");
            return;
        }
    };
    let app = build_app(state);

    let token_a = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a2600a1",
    )
    .await;
    let token_b = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a2600b2",
    )
    .await;

    let post_req = Request::builder()
        .method(Method::POST)
        .uri("/tenant/contracts")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "chain_id": 421614,
                "token_address": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "disclosure_registry_address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "transfer_controller_address": "0xcccccccccccccccccccccccccccccccccccccccc",
                "audit_anchor_address": "0xdddddddddddddddddddddddddddddddddddddddd",
                "factory_tx_hash": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "owner_wallet": "0xffffffffffffffffffffffffffffffffffffffff",
                "deployment_status": "deployed"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let post_res = app
        .clone()
        .oneshot(post_req)
        .await
        .expect("tenant contract save failed");
    assert_eq!(post_res.status(), StatusCode::OK);

    let list_req = |token: &str| {
        Request::builder()
            .method(Method::GET)
            .uri("/tenant/contracts")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .body(Body::empty())
            .expect("request build failed")
    };

    let contracts_a_res = app
        .clone()
        .oneshot(list_req(&token_a))
        .await
        .expect("tenant A contract list failed");
    assert_eq!(contracts_a_res.status(), StatusCode::OK);
    let contracts_a_body = body::to_bytes(contracts_a_res.into_body(), usize::MAX)
        .await
        .expect("tenant A contract list body");
    let contracts_a_json: serde_json::Value =
        serde_json::from_slice(&contracts_a_body).expect("tenant A contract list json");
    assert_eq!(
        contracts_a_json["data"]["token_address"].as_str(),
        Some("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"),
        "tenant A should see saved contract metadata"
    );

    let update_req = Request::builder()
        .method(Method::POST)
        .uri("/tenant/contracts")
        .header(header::AUTHORIZATION, format!("Bearer {token_a}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "chain_id": 421614,
                "token_address": "0x1111111111111111111111111111111111111111",
                "disclosure_registry_address": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                "transfer_controller_address": "0xcccccccccccccccccccccccccccccccccccccccc",
                "audit_anchor_address": "0xdddddddddddddddddddddddddddddddddddddddd",
                "factory_tx_hash": "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
                "owner_wallet": "0xffffffffffffffffffffffffffffffffffffffff",
                "deployment_status": "deployed"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let update_res = app
        .clone()
        .oneshot(update_req)
        .await
        .expect("tenant contract update failed");
    assert_eq!(update_res.status(), StatusCode::OK);

    let contracts_a_updated_res = app
        .clone()
        .oneshot(list_req(&token_a))
        .await
        .expect("tenant A updated contract list failed");
    assert_eq!(contracts_a_updated_res.status(), StatusCode::OK);
    let contracts_a_updated_body = body::to_bytes(contracts_a_updated_res.into_body(), usize::MAX)
        .await
        .expect("tenant A updated contract list body");
    let contracts_a_updated_json: serde_json::Value =
        serde_json::from_slice(&contracts_a_updated_body).expect("tenant A updated contract list json");
    assert_eq!(
        contracts_a_updated_json["data"]["token_address"].as_str(),
        Some("0x1111111111111111111111111111111111111111"),
        "tenant A should see updated contract metadata"
    );

    let contracts_b_res = app
        .clone()
        .oneshot(list_req(&token_b))
        .await
        .expect("tenant B contract list failed");
    assert_eq!(contracts_b_res.status(), StatusCode::OK);
    let contracts_b_body = body::to_bytes(contracts_b_res.into_body(), usize::MAX)
        .await
        .expect("tenant B contract list body");
    let contracts_b_json: serde_json::Value =
        serde_json::from_slice(&contracts_b_body).expect("tenant B contract list json");
    assert!(
        contracts_b_json["data"].is_null(),
        "tenant B should not see tenant A contract metadata"
    );
}

#[tokio::test]
async fn transfers_persist_and_return_onchain_metadata() {
    let database_url = std::env::var("DATABASE_URL")
        .unwrap_or_else(|_| "postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend".to_owned());
    let state = match AppState::new(&database_url).await {
        Ok(value) => value,
        Err(err) => {
            eprintln!("skipping transfer metadata db test: {err}");
            return;
        }
    };
    let app = build_app(state);

    let token = wallet_login_token(
        &app,
        "0x5de4111a2f49e57055f5f120cc8f06b3bcfecf4ebd578a7f0d95f16d7a2600c3",
    )
    .await;
    let unique = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .expect("time")
        .as_millis();

    let create_asset_req = Request::builder()
        .method(Method::POST)
        .uri("/assets")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "name": format!("Transfer Metadata Asset {unique}"),
                "asset_type": "fund"
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_asset_res = app
        .clone()
        .oneshot(create_asset_req)
        .await
        .expect("create asset failed");
    assert_eq!(create_asset_res.status(), StatusCode::OK);
    let create_asset_body = body::to_bytes(create_asset_res.into_body(), usize::MAX)
        .await
        .expect("create asset body");
    let create_asset_json: serde_json::Value =
        serde_json::from_slice(&create_asset_body).expect("create asset json");
    let asset_id = create_asset_json["data"]["id"].as_i64().expect("asset id");

    let create_investor = |name: String, wallet: &str| {
        Request::builder()
            .method(Method::POST)
            .uri("/investors")
            .header(header::AUTHORIZATION, format!("Bearer {token}"))
            .header(header::CONTENT_TYPE, "application/json")
            .body(Body::from(
                serde_json::json!({
                    "legal_name": name,
                    "jurisdiction": "US",
                    "wallet_address": wallet
                })
                .to_string(),
            ))
            .expect("request build failed")
    };

    let from_res = app
        .clone()
        .oneshot(create_investor(
            format!("Metadata Sender {unique}"),
            "0xec08da877d409293c006523db95ba291f43e3249",
        ))
        .await
        .expect("create sender failed");
    assert_eq!(from_res.status(), StatusCode::OK);
    let from_body = body::to_bytes(from_res.into_body(), usize::MAX)
        .await
        .expect("sender body");
    let from_json: serde_json::Value = serde_json::from_slice(&from_body).expect("sender json");
    let from_investor_id = from_json["data"]["id"].as_i64().expect("from id");

    let to_res = app
        .clone()
        .oneshot(create_investor(
            format!("Metadata Recipient {unique}"),
            "0x1111111111111111111111111111111111111111",
        ))
        .await
        .expect("create recipient failed");
    assert_eq!(to_res.status(), StatusCode::OK);
    let to_body = body::to_bytes(to_res.into_body(), usize::MAX)
        .await
        .expect("recipient body");
    let to_json: serde_json::Value = serde_json::from_slice(&to_body).expect("recipient json");
    let to_investor_id = to_json["data"]["id"].as_i64().expect("to id");

    let create_transfer_req = Request::builder()
        .method(Method::POST)
        .uri("/transfers")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .header(header::CONTENT_TYPE, "application/json")
        .body(Body::from(
            serde_json::json!({
                "asset_id": asset_id,
                "from_investor_id": from_investor_id,
                "to_investor_id": to_investor_id,
                "amount": 25000,
                "status": "confirmed",
                "tx_hash": "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                "onchain_metadata": {
                    "chain_id": 421614,
                    "sender_wallet_address": "0xec08da877d409293c006523db95ba291f43e3249",
                    "recipient_wallet_address": "0x1111111111111111111111111111111111111111",
                    "disclosure_data_id": "0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                    "disclosure_registry_address": "0x2222222222222222222222222222222222222222",
                    "transfer_controller_address": "0x3333333333333333333333333333333333333333",
                    "token_address": "0x4444444444444444444444444444444444444444",
                    "encrypted_amount": "0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                    "input_proof": "0x1234abcd",
                    "reference_note": "metadata integration test"
                }
            })
            .to_string(),
        ))
        .expect("request build failed");
    let create_transfer_res = app
        .clone()
        .oneshot(create_transfer_req)
        .await
        .expect("create transfer failed");
    assert_eq!(create_transfer_res.status(), StatusCode::OK);
    let create_transfer_body = body::to_bytes(create_transfer_res.into_body(), usize::MAX)
        .await
        .expect("transfer body");
    let create_transfer_json: serde_json::Value =
        serde_json::from_slice(&create_transfer_body).expect("transfer json");
    assert_eq!(
        create_transfer_json["data"]["onchain_metadata"]["token_address"].as_str(),
        Some("0x4444444444444444444444444444444444444444")
    );
    assert_eq!(
        create_transfer_json["data"]["onchain_metadata"]["reference_note"].as_str(),
        Some("metadata integration test")
    );

    let list_req = Request::builder()
        .method(Method::GET)
        .uri("/transfers")
        .header(header::AUTHORIZATION, format!("Bearer {token}"))
        .body(Body::empty())
        .expect("request build failed");
    let list_res = app
        .clone()
        .oneshot(list_req)
        .await
        .expect("list transfers failed");
    assert_eq!(list_res.status(), StatusCode::OK);
    let list_body = body::to_bytes(list_res.into_body(), usize::MAX)
        .await
        .expect("list body");
    let list_json: serde_json::Value = serde_json::from_slice(&list_body).expect("list json");
    let transfer_items = list_json["data"].as_array().expect("transfer list");
    let persisted = transfer_items
        .iter()
        .find(|item| item["tx_hash"].as_str() == Some("0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"))
        .expect("persisted transfer");
    assert_eq!(
        persisted["onchain_metadata"]["disclosure_registry_address"].as_str(),
        Some("0x2222222222222222222222222222222222222222")
    );
    assert_eq!(
        persisted["onchain_metadata"]["reference_note"].as_str(),
        Some("metadata integration test")
    );
}
