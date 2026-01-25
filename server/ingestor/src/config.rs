use anyhow::{anyhow, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub arxiv_api_url: String,
    pub ingestion_interval_secs: u64,
}

impl Config {
    pub fn from_env() -> Result<Self> {
        let database_url = std::env::var("DATABASE_URL")
            .map_err(|_| anyhow!("DATABASE_URL environment variable not set"))?;

        let arxiv_api_url = std::env::var("ARXIV_API_URL")
            .unwrap_or_else(|_| "http://export.arxiv.org/api/query".to_string());

        let ingestion_interval_secs = std::env::var("INGESTION_INTERVAL_SECS")
            .unwrap_or_else(|_| "3600".to_string())
            .parse::<u64>()
            .map_err(|_| anyhow!("INGESTION_INTERVAL_SECS must be a valid u64"))?;

        Ok(Self {
            database_url,
            arxiv_api_url,
            ingestion_interval_secs,
        })
    }
}
