pub mod asset_registry;
pub mod audit_reporting;
pub mod compliance_passports;
pub mod config;
pub mod db;
pub mod disclosure_mgmt;
pub mod health;
pub mod identity_access;
pub mod investor_registry;
pub mod tenant_contracts;
pub mod transfer_ops;

use std::collections::HashMap;
use std::sync::Arc;

use asset_registry::AssetRepository;
use audit_reporting::AuditRepository;
use axum::middleware::{self, Next};
use axum::{
    Router,
    body::Body,
    extract::State,
    http::{HeaderMap, Request, StatusCode, header},
    response::Response,
};
use compliance_passports::CompliancePassportRepository;
use disclosure_mgmt::DisclosureRepository;
use identity_access::{AuthUser, Role, WalletNonceChallenge, wallet_allowlist_from_env};
use investor_registry::InvestorRepository;
use sqlx::{PgPool, postgres::PgPoolOptions};
use tenant_contracts::TenantContractRepository;
use tokio::sync::RwLock;
use transfer_ops::TransferRepository;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ApiEnvelope<T> {
    pub success: bool,
    pub data: Option<T>,
    pub error: Option<String>,
}

impl<T> ApiEnvelope<T> {
    pub fn ok(data: T) -> Self {
        Self {
            success: true,
            data: Some(data),
            error: None,
        }
    }
}

impl<T> ApiEnvelope<T> {
    pub fn err(message: impl Into<String>) -> Self {
        Self {
            success: false,
            data: None,
            error: Some(message.into()),
        }
    }
}

#[derive(Clone)]
pub struct AppState {
    pub pool: Arc<PgPool>,
    pub auth_users: Arc<HashMap<String, AuthUser>>,
    pub auth_tokens: Arc<HashMap<String, AuthUser>>,
    pub auth_token_secret: Arc<String>,
    pub auth_token_ttl_seconds: u64,
    pub wallet_roles: Arc<HashMap<String, Role>>,
    pub wallet_nonces: Arc<RwLock<HashMap<String, WalletNonceChallenge>>>,
    pub wallet_nonce_ttl_seconds: u64,
    pub wallet_auto_onboard_enabled: bool,
    pub asset_repo: Arc<AssetRepository>,
    pub investor_repo: Arc<InvestorRepository>,
    pub transfer_repo: Arc<TransferRepository>,
    pub disclosure_repo: Arc<DisclosureRepository>,
    pub audit_repo: Arc<AuditRepository>,
    pub compliance_passport_repo: Arc<CompliancePassportRepository>,
    pub tenant_contract_repo: Arc<TenantContractRepository>,
}

impl AppState {
    pub async fn new(database_url: &str) -> Result<Self, sqlx::Error> {
        let admin = AuthUser::new("admin_user", Role::Admin, "admin-token", None);
        let operator = AuthUser::new("operator_user", Role::Operator, "operator-token", None);
        let auditor = AuthUser::new("auditor_user", Role::Auditor, "auditor-token", None);

        let auth_users = HashMap::from([
            (admin.username.clone(), admin.clone()),
            (operator.username.clone(), operator.clone()),
            (auditor.username.clone(), auditor.clone()),
        ]);
        let auth_tokens = HashMap::from([
            (admin.token.clone(), admin),
            (operator.token.clone(), operator),
            (auditor.token.clone(), auditor),
        ]);

        let pool = PgPoolOptions::new()
            .max_connections(10)
            .connect(database_url)
            .await?;
        db::bootstrap(&pool).await?;

        Ok(Self {
            pool: Arc::new(pool.clone()),
            auth_users: Arc::new(auth_users),
            auth_tokens: Arc::new(auth_tokens),
            auth_token_secret: Arc::new(identity_access::auth_token_secret_from_env()),
            auth_token_ttl_seconds: identity_access::auth_token_ttl_from_env(),
            wallet_roles: Arc::new(wallet_allowlist_from_env()),
            wallet_nonces: Arc::new(RwLock::new(HashMap::new())),
            wallet_nonce_ttl_seconds: identity_access::wallet_nonce_ttl_from_env(),
            wallet_auto_onboard_enabled: true,
            asset_repo: Arc::new(AssetRepository::new(pool.clone())),
            investor_repo: Arc::new(InvestorRepository::new(pool.clone())),
            transfer_repo: Arc::new(TransferRepository::new(pool.clone())),
            disclosure_repo: Arc::new(DisclosureRepository::new(pool.clone())),
            audit_repo: Arc::new(AuditRepository::new(pool.clone())),
            compliance_passport_repo: Arc::new(CompliancePassportRepository::new(pool.clone())),
            tenant_contract_repo: Arc::new(TenantContractRepository::new(pool)),
        })
    }

    pub fn for_tests_without_db() -> Self {
        let admin = AuthUser::new("admin_user", Role::Admin, "admin-token", None);
        let operator = AuthUser::new("operator_user", Role::Operator, "operator-token", None);
        let auditor = AuthUser::new("auditor_user", Role::Auditor, "auditor-token", None);

        let auth_users = HashMap::from([
            (admin.username.clone(), admin.clone()),
            (operator.username.clone(), operator.clone()),
            (auditor.username.clone(), auditor.clone()),
        ]);
        let auth_tokens = HashMap::from([
            (admin.token.clone(), admin),
            (operator.token.clone(), operator),
            (auditor.token.clone(), auditor),
        ]);

        let pool =
            PgPool::connect_lazy("postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend")
                .expect("valid lazy postgres URL");

        Self {
            pool: Arc::new(pool.clone()),
            auth_users: Arc::new(auth_users),
            auth_tokens: Arc::new(auth_tokens),
            auth_token_secret: Arc::new("test-auth-secret".to_owned()),
            auth_token_ttl_seconds: 3_600,
            wallet_roles: Arc::new(HashMap::from([(
                "0x7b66e5678496176fc6e32fd532f5ee2e33686f09".to_owned(),
                Role::Operator,
            )])),
            wallet_nonces: Arc::new(RwLock::new(HashMap::new())),
            wallet_nonce_ttl_seconds: 300,
            wallet_auto_onboard_enabled: false,
            asset_repo: Arc::new(AssetRepository::new(pool.clone())),
            investor_repo: Arc::new(InvestorRepository::new(pool.clone())),
            transfer_repo: Arc::new(TransferRepository::new(pool.clone())),
            disclosure_repo: Arc::new(DisclosureRepository::new(pool.clone())),
            audit_repo: Arc::new(AuditRepository::new(pool.clone())),
            compliance_passport_repo: Arc::new(CompliancePassportRepository::new(pool.clone())),
            tenant_contract_repo: Arc::new(TenantContractRepository::new(pool)),
        }
    }
}

pub fn build_app(state: AppState) -> Router {
    let health_router = health::routes();
    let auth_router = identity_access::routes(state.clone());

    let admin_operator_guard =
        middleware::from_fn_with_state(state.clone(), require_admin_or_operator);
    let admin_auditor_guard =
        middleware::from_fn_with_state(state.clone(), require_admin_or_auditor);

    Router::new()
        .merge(health_router)
        .merge(auth_router)
        .merge(asset_registry::routes(state.clone()).route_layer(admin_operator_guard.clone()))
        .merge(investor_registry::routes(state.clone()).route_layer(admin_operator_guard.clone()))
        .merge(transfer_ops::routes(state.clone()).route_layer(admin_operator_guard.clone()))
        .merge(disclosure_mgmt::routes(state.clone()).route_layer(admin_operator_guard.clone()))
        .merge(tenant_contracts::routes(state.clone()).route_layer(admin_operator_guard))
        .merge(audit_reporting::routes(state.clone()).route_layer(admin_auditor_guard))
        .merge(compliance_passports::routes(state))
}

fn extract_bearer_token(req: &Request<Body>) -> Option<&str> {
    let value = req.headers().get(header::AUTHORIZATION)?.to_str().ok()?;
    value.strip_prefix("Bearer ")
}

async fn require_admin_or_operator(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    authorize(&state, &req, &[Role::Admin, Role::Operator])?;
    Ok(next.run(req).await)
}

async fn require_admin_or_auditor(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Result<Response, StatusCode> {
    authorize(&state, &req, &[Role::Admin, Role::Auditor])?;
    Ok(next.run(req).await)
}

fn authorize(state: &AppState, req: &Request<Body>, allowed: &[Role]) -> Result<(), StatusCode> {
    let token = extract_bearer_token(req).ok_or(StatusCode::UNAUTHORIZED)?;
    let user = identity_access::resolve_session_user_from_token(state, token)
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if allowed.iter().any(|role| role == &user.role) {
        Ok(())
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

pub fn authorized_user_from_headers(
    state: &AppState,
    headers: &HeaderMap,
    allowed: &[Role],
) -> Result<AuthUser, StatusCode> {
    let token = headers
        .get(header::AUTHORIZATION)
        .and_then(|value| value.to_str().ok())
        .and_then(|value| value.strip_prefix("Bearer "))
        .ok_or(StatusCode::UNAUTHORIZED)?;
    let user = identity_access::resolve_session_user_from_token(state, token)
        .ok_or(StatusCode::UNAUTHORIZED)?;
    if allowed.iter().any(|role| role == &user.role) {
        Ok(user)
    } else {
        Err(StatusCode::FORBIDDEN)
    }
}

pub fn institution_id_from_user(user: &AuthUser) -> Result<i64, StatusCode> {
    user.institution_id.ok_or(StatusCode::FORBIDDEN)
}
