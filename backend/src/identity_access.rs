use axum::{
    Json, Router,
    extract::State,
    http::StatusCode,
    routing::{get, post},
};
use base64::{Engine as _, engine::general_purpose::URL_SAFE_NO_PAD};
use ethers_core::{
    types::{Address, Signature},
    utils::hash_message,
};
use hmac::{Hmac, Mac};
use rand::{Rng, distributions::Alphanumeric};
use serde::{Deserialize, Serialize};
use sha2::Sha256;
use sqlx::Row;
use std::{collections::HashMap, str::FromStr};
use std::{
    env,
    time::{SystemTime, UNIX_EPOCH},
};

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
    pub institution_id: Option<i64>,
}

impl AuthUser {
    pub fn new(username: &str, role: Role, token: &str, institution_id: Option<i64>) -> Self {
        Self {
            username: username.to_owned(),
            role,
            token: token.to_owned(),
            institution_id,
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
    pub institution_id: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct MeResponse {
    pub username: String,
    pub role: Role,
    pub institution_id: Option<i64>,
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

#[derive(Debug, Serialize, Deserialize)]
struct SignedTokenClaims {
    pub sub: String,
    pub role: Role,
    pub institution_id: Option<i64>,
    pub iat: u64,
    pub exp: u64,
}

#[derive(Debug, Clone, Copy)]
struct WalletIdentity {
    role: Role,
    institution_id: i64,
}

#[derive(Debug, Clone)]
pub struct WalletNonceChallenge {
    pub nonce: String,
    pub issued_at: u64,
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
        Some(user) => match issue_signed_token(
            &user.username,
            user.role,
            user.institution_id,
            state.auth_token_ttl_seconds,
            &state.auth_token_secret,
        ) {
            Ok(token) => (
                StatusCode::OK,
                Json(ApiEnvelope::ok(LoginResponse {
                    token,
                    role: user.role,
                    institution_id: user.institution_id,
                })),
            ),
            Err(err) => (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(err)),
            ),
        },
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

    match token.and_then(|value| resolve_session_user_from_token(&state, value)) {
        Some(user) => (
            StatusCode::OK,
            Json(ApiEnvelope::ok(MeResponse {
                username: user.username.clone(),
                role: user.role,
                institution_id: user.institution_id,
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

    let nonce = generate_nonce(24);
    let message = build_sign_message(&normalized, payload.chain_id, &nonce);
    let issued_at = match unix_timestamp() {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(err)),
            );
        }
    };
    {
        let mut store = state.wallet_nonces.write().await;
        store.insert(
            normalized,
            WalletNonceChallenge {
                nonce: nonce.clone(),
                issued_at,
            },
        );
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

    let challenge = {
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
    let now = match unix_timestamp() {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(err)),
            );
        }
    };
    if challenge
        .issued_at
        .saturating_add(state.wallet_nonce_ttl_seconds)
        <= now
    {
        let mut store = state.wallet_nonces.write().await;
        store.remove(&normalized);
        return (
            StatusCode::UNAUTHORIZED,
            Json(ApiEnvelope::err("challenge nonce expired")),
        );
    }

    let message = build_sign_message(&normalized, payload.chain_id, &challenge.nonce);
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

    let identity = match resolve_or_create_wallet_identity(&state, &normalized).await {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(err)),
            );
        }
    };

    let token = match issue_signed_token(
        &format!("wallet:{normalized}"),
        identity.role,
        Some(identity.institution_id),
        state.auth_token_ttl_seconds,
        &state.auth_token_secret,
    ) {
        Ok(value) => value,
        Err(err) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(ApiEnvelope::err(err)),
            );
        }
    };

    (
        StatusCode::OK,
        Json(ApiEnvelope::ok(LoginResponse {
            token,
            role: identity.role,
            institution_id: Some(identity.institution_id),
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

type HmacSha256 = Hmac<Sha256>;

pub fn auth_token_secret_from_env() -> String {
    env::var("AUTH_TOKEN_SECRET").unwrap_or_else(|_| "dev-only-change-me-secret".to_owned())
}

pub fn auth_token_ttl_from_env() -> u64 {
    env::var("AUTH_TOKEN_TTL_SECONDS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|ttl| *ttl > 0)
        .unwrap_or(3_600)
}

pub fn wallet_nonce_ttl_from_env() -> u64 {
    env::var("AUTH_WALLET_NONCE_TTL_SECONDS")
        .ok()
        .and_then(|raw| raw.parse::<u64>().ok())
        .filter(|ttl| *ttl > 0)
        .unwrap_or(300)
}

pub fn resolve_user_from_token(state: &AppState, token: &str) -> Option<AuthUser> {
    if let Some(user) = state.auth_tokens.get(token) {
        return Some(user.clone());
    }

    let claims = verify_signed_token(token, &state.auth_token_secret).ok()?;
    Some(AuthUser {
        username: claims.sub,
        role: claims.role,
        token: token.to_owned(),
        institution_id: claims.institution_id,
    })
}

pub fn resolve_session_user_from_token(state: &AppState, token: &str) -> Option<AuthUser> {
    let claims = verify_signed_token(token, &state.auth_token_secret).ok()?;
    Some(AuthUser {
        username: claims.sub,
        role: claims.role,
        token: token.to_owned(),
        institution_id: claims.institution_id,
    })
}

async fn resolve_or_create_wallet_identity(
    state: &AppState,
    wallet_address: &str,
) -> Result<WalletIdentity, String> {
    if !state.wallet_auto_onboard_enabled {
        return Ok(WalletIdentity {
            role: state
                .wallet_roles
                .get(wallet_address)
                .copied()
                .unwrap_or(Role::Admin),
            institution_id: 1,
        });
    }

    let existing = sqlx::query(
        "SELECT institution_id, role FROM institution_users WHERE wallet_address = $1 ORDER BY id ASC LIMIT 1",
    )
    .bind(wallet_address)
    .fetch_optional(state.pool.as_ref())
    .await
    .map_err(|err| format!("failed to read wallet identity: {err}"))?;

    if let Some(row) = existing {
        let institution_id: i64 = row
            .try_get("institution_id")
            .map_err(|err| format!("failed to parse institution_id: {err}"))?;
        let role_text: String = row
            .try_get("role")
            .map_err(|err| format!("failed to parse role: {err}"))?;
        return Ok(WalletIdentity {
            role: role_from_db(&role_text)?,
            institution_id,
        });
    }

    let mut tx = state
        .pool
        .begin()
        .await
        .map_err(|err| format!("failed to start onboarding transaction: {err}"))?;

    let now = unix_timestamp().map(|value| value as i64)?;
    let display = if wallet_address.len() >= 10 {
        format!("Tenant {}", &wallet_address[2..10])
    } else {
        "Tenant".to_owned()
    };
    let institution_row = sqlx::query(
        "INSERT INTO institutions (name, created_at_unix) VALUES ($1, $2) RETURNING id",
    )
    .bind(display)
    .bind(now)
    .fetch_one(&mut *tx)
    .await
    .map_err(|err| format!("failed to create institution: {err}"))?;
    let institution_id: i64 = institution_row
        .try_get("id")
        .map_err(|err| format!("failed to parse new institution id: {err}"))?;

    let role = state
        .wallet_roles
        .get(wallet_address)
        .copied()
        .unwrap_or(Role::Admin);
    sqlx::query(
        "INSERT INTO institution_users (institution_id, wallet_address, role, created_at_unix) VALUES ($1, $2, $3, $4)",
    )
    .bind(institution_id)
    .bind(wallet_address)
    .bind(role_to_db(role))
    .bind(now)
    .execute(&mut *tx)
    .await
    .map_err(|err| format!("failed to attach wallet to institution: {err}"))?;

    tx.commit()
        .await
        .map_err(|err| format!("failed to commit onboarding transaction: {err}"))?;

    Ok(WalletIdentity {
        role,
        institution_id,
    })
}

fn issue_signed_token(
    username: &str,
    role: Role,
    institution_id: Option<i64>,
    ttl_seconds: u64,
    secret: &str,
) -> Result<String, String> {
    let now = unix_timestamp()?;
    let claims = SignedTokenClaims {
        sub: username.to_owned(),
        role,
        institution_id,
        iat: now,
        exp: now.saturating_add(ttl_seconds),
    };
    let payload = serde_json::to_vec(&claims).map_err(|err| err.to_string())?;
    let payload_b64 = URL_SAFE_NO_PAD.encode(payload);
    let signature_b64 = sign_payload(&payload_b64, secret)?;
    Ok(format!("v1.{payload_b64}.{signature_b64}"))
}

fn verify_signed_token(token: &str, secret: &str) -> Result<SignedTokenClaims, String> {
    let mut parts = token.split('.');
    let version = parts.next().ok_or("missing token version")?;
    let payload_b64 = parts.next().ok_or("missing token payload")?;
    let signature_b64 = parts.next().ok_or("missing token signature")?;
    if parts.next().is_some() {
        return Err("malformed token".to_owned());
    }
    if version != "v1" {
        return Err("unsupported token version".to_owned());
    }

    verify_signature(payload_b64, signature_b64, secret)?;

    let payload = URL_SAFE_NO_PAD
        .decode(payload_b64)
        .map_err(|_| "invalid token payload encoding".to_owned())?;
    let claims: SignedTokenClaims =
        serde_json::from_slice(&payload).map_err(|_| "invalid token payload".to_owned())?;
    if claims.exp <= unix_timestamp()? {
        return Err("token expired".to_owned());
    }
    Ok(claims)
}

fn sign_payload(payload_b64: &str, secret: &str) -> Result<String, String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "failed to initialize token signer".to_owned())?;
    mac.update(payload_b64.as_bytes());
    Ok(URL_SAFE_NO_PAD.encode(mac.finalize().into_bytes()))
}

fn verify_signature(payload_b64: &str, signature_b64: &str, secret: &str) -> Result<(), String> {
    let mut mac = HmacSha256::new_from_slice(secret.as_bytes())
        .map_err(|_| "failed to initialize token verifier".to_owned())?;
    mac.update(payload_b64.as_bytes());
    let signature = URL_SAFE_NO_PAD
        .decode(signature_b64)
        .map_err(|_| "invalid token signature encoding".to_owned())?;
    mac.verify_slice(&signature)
        .map_err(|_| "invalid token signature".to_owned())
}

fn unix_timestamp() -> Result<u64, String> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_secs())
        .map_err(|_| "system clock is before UNIX_EPOCH".to_owned())
}

fn role_from_db(value: &str) -> Result<Role, String> {
    match value.trim().to_ascii_lowercase().as_str() {
        "admin" => Ok(Role::Admin),
        "operator" => Ok(Role::Operator),
        "auditor" => Ok(Role::Auditor),
        _ => Err("unknown role in institution_users".to_owned()),
    }
}

fn role_to_db(role: Role) -> &'static str {
    match role {
        Role::Admin => "admin",
        Role::Operator => "operator",
        Role::Auditor => "auditor",
    }
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
        let user = AuthUser::new("alice", Role::Operator, "token-1", None);
        assert_eq!(user.username, "alice");
        assert_eq!(user.role, Role::Operator);
        assert_eq!(user.token, "token-1");
        assert_eq!(user.institution_id, None);
    }

    #[test]
    fn sign_message_contains_expected_fields() {
        let message = build_sign_message("0xabc", 421614, "nonce123");
        assert!(message.contains("Address: 0xabc"));
        assert!(message.contains("Chain ID: 421614"));
        assert!(message.contains("Nonce: nonce123"));
    }
}
