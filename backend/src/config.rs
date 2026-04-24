use std::env;

#[derive(Debug, Clone)]
pub struct BackendConfig {
    pub database_url: String,
    pub backend_port: u16,
}

impl BackendConfig {
    pub fn from_env() -> Self {
        let database_url = env::var("DATABASE_URL").unwrap_or_else(|_| {
            "postgres://postgres:postgres@127.0.0.1:5432/rwaos_backend".to_owned()
        });
        let backend_port = env::var("BACKEND_PORT")
            .ok()
            .and_then(|value| value.parse::<u16>().ok())
            .unwrap_or(8080);

        Self {
            database_url,
            backend_port,
        }
    }
}
