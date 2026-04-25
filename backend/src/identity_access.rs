use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use ethers_core::{
    types::{Address, Signature},
    utils::hash_message,
};
use rand::{Rng, distributions::Alphanumeric};
use serde::{Deserialize, Serialize};
use std::{collections::HashMap, str::FromStr};

use crate::{ApiEnvelope, AppState};

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Role {
    Admin,
    Operator,
    Auditor,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuthUser {
    pub username: String,
    pub role: Role,
    pub token: String,
}

impl AuthUser {
    pub fn new(username: &str, role: Role, token: &str) -> Self {
        Self {
            username: username.to_owned(),
            role,
            token: token.to_owned(),
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct LoginRequest {
    pub username: String,
}

#[derive(Debug, Serialize)]
pub struct LoginResponse {
    pub token: String,
    pub role: Role,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub username: String,
    pub role: Role,
}

#[derive(Debug, Deserialize)]
pub struct WalletChallengeRequest {
    pub address: String,
    pub chain_id: u64,
}

#[derive(Debug, Serialize)]
pub struct WalletChallengeResponse {
    pub message: String,
    pub nonce: String,
}

#[derive(Debug, Deserialize)]
pub struct WalletLoginRequest {
    pub address: String,
    pub chain_id: u64,
    pub signature: String,
}

pub fn routes(state: AppState) -> Router {
    Router::new()
        .route("/auth/login", post(login))
        .route("/auth/me", get(me))
        .route("/auth/wallet/challenge", post(wallet_challenge))
        .route("/auth/wallet/login", post(wallet_login))
        .with_state(state)
}

async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> (StatusCode, Json<ApiEnvelope<LoginResponse>>) {
    match state.auth_users.get(&payload.username) {
        Some(user) => (
            StatusCode::OK,
            Json(ApiEnvelope::ok(LoginResponse {
                token: user.token.clone(),
                role: user.role,
            })),
        ),
        None => (
            StatusCode::UNAUTHORIZED,
            Json(ApiEnvelope::err("invalid username")),
        ),
    }
}

async fn me(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
) -> (StatusCode, Json<ApiEnvelope<MeResponse>>) {
    let token = headers
        .get(axum::http::header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "));

    match token.and_then(|value| state.auth_tokens.get(value)) {
        Some(user) => (
            StatusCode::OK,
            Json(ApiEnvelope::ok(MeResponse {
                username: user.username.clone(),
                role: user.role,
            })),
        ),
        None => (
            StatusCode::UNAUTHORIZED,
            Json(ApiEnvelope::err("invalid or missing bearer token")),
        ),
    }
}

async fn wallet_challenge(
    State(state): State<AppState>,
    Json(payload): Json<WalletChallengeRequest>,
) -> (StatusCode, Json<ApiEnvelope<WalletChallengeResponse>>) {
    if payload.chain_id != 421614 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope::err("unsupported chain id")),
        );
    }

    let normalized = normalize_address(&payload.address);
    if !state.wallet_roles.contains_key(&normalized) {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiEnvelope::err("wallet address is not allowlisted")),
        );
    }

    let nonce = generate_nonce(24);
    let message = build_sign_message(&normalized, payload.chain_id, &nonce);
    {
        let mut store = state.wallet_nonces.write().await;
        store.insert(normalized, nonce.clone());
    }

    (
        StatusCode::OK,
        Json(ApiEnvelope::ok(WalletChallengeResponse { message, nonce })),
    )
}

async fn wallet_login(
    State(state): State<AppState>,
    Json(payload): Json<WalletLoginRequest>,
) -> (StatusCode, Json<ApiEnvelope<LoginResponse>>) {
    if payload.chain_id != 421614 {
        return (
            StatusCode::BAD_REQUEST,
            Json(ApiEnvelope::err("unsupported chain id")),
        );
    }

    let normalized = normalize_address(&payload.address);
    let role = match state.wallet_roles.get(&normalized) {
        Some(role) => *role,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiEnvelope::err("wallet address is not allowlisted")),
            );
        }
    };

    let nonce = {
        let store = state.wallet_nonces.read().await;
        match store.get(&normalized) {
            Some(value) => value.clone(),
            None => {
                return (
                    StatusCode::UNAUTHORIZED,
                    Json(ApiEnvelope::err("missing challenge nonce for wallet")),
                );
            }
        }
    };

    let message = build_sign_message(&normalized, payload.chain_id, &nonce);
    let recovered = match recover_signer(&message, &payload.signature) {
        Ok(address) => normalize_address(&format!("{address:#x}")),
        Err(err) => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(ApiEnvelope::err(format!("invalid signature: {err}"))),
            );
        }
    };

    if recovered != normalized {
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiEnvelope::err("signature does not match wallet address")),
        );
    }

    {
        let mut store = state.wallet_nonces.write().await;
        store.remove(&normalized);
    }

    let token = match role {
        Role::Admin => "admin-token",
        Role::Operator => "operator-token",
        Role::Auditor => "auditor-token",
    };

    (
        StatusCode::OK,
        Json(ApiEnvelope::ok(LoginResponse {
            token: token.to_owned(),
            role,
        })),
    )
}

fn normalize_address(address: &str) -> String {
    address.trim().to_lowercase()
}

fn generate_nonce(length: usize) -> String {
    rand::thread_rng()
        .sample_iter(&Alphanumeric)
        .take(length)
        .map(char::from)
        .collect()
}

fn build_sign_message(address: &str, chain_id: u64, nonce: &str) -> String {
    format!(
        "Confidential RWA OS wallet login\nAddress: {address}\nChain ID: {chain_id}\nNonce: {nonce}"
    )
}

fn recover_signer(message: &str, signature_hex: &str) -> Result<Address, String> {
    let signature = Signature::from_str(signature_hex).map_err(|err| err.to_string())?;
    signature
        .recover(hash_message(message))
        .map_err(|err| err.to_string())
}

pub fn wallet_allowlist_from_env() -> HashMap<String, Role> {
    let mut map = HashMap::new();

    assign_role_allowlist(&mut map, Role::Admin, "AUTH_ADMIN_WALLETS");
    assign_role_allowlist(&mut map, Role::Operator, "AUTH_OPERATOR_WALLETS");
    assign_role_allowlist(&mut map, Role::Auditor, "AUTH_AUDITOR_WALLETS");

    map
}

fn assign_role_allowlist(map: &mut HashMap<String, Role>, role: Role, env_key: &str) {
    let value = std::env::var(env_key).unwrap_or_default();
    for wallet in value
        .split(',')
        .map(normalize_address)
        .filter(|item| !item.is_empty())
    {
        map.insert(wallet, role);
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn auth_user_constructor_sets_fields() {
        let user = AuthUser::new("alice", Role::Operator, "token-1");
        assert_eq!(user.username, "alice");
        assert_eq!(user.role, Role::Operator);
        assert_eq!(user.token, "token-1");
    }

    #[test]
    fn sign_message_contains_expected_fields() {
        let message = build_sign_message("0xabc", 421614, "nonce123");
        assert!(message.contains("Address: 0xabc"));
        assert!(message.contains("Chain ID: 421614"));
        assert!(message.contains("Nonce: nonce123"));
    }
}
