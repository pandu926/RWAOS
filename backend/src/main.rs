use confidential_rwa_os_backend::{AppState, build_app, config::BackendConfig};
use tokio::net::TcpListener;

#[tokio::main]
async fn main() {
    let config = BackendConfig::from_env();
    let state = AppState::new(&config.database_url)
        .await
        .expect("failed to initialize database state");
    let app = build_app(state);
    let bind_addr = format!("0.0.0.0:{}", config.backend_port);
    let listener = TcpListener::bind(&bind_addr)
        .await
        .unwrap_or_else(|_| panic!("failed to bind server on {bind_addr}"));
    axum::serve(listener, app)
        .await
        .expect("server failed unexpectedly");
}
