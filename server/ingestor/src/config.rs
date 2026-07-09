use anyhow::{anyhow, Result};

#[derive(Debug, Clone)]
pub struct Config {
    pub database_url: String,
    pub arxiv_api_url: String,
    pub ingestion_interval_secs: u64,
    /// OpenRouter API key for Hermes trend analysis. When None, the
    /// trend-report step is skipped (ingestion still runs).
    pub openrouter_api_key: Option<String>,
    /// OpenRouter model id used for trend analysis.
    pub openrouter_model: String,
    /// Max number of recent items fed to Hermes per report.
    pub trend_max_items: usize,
    /// When true, regenerate today's report even if one already exists.
    /// Off by default so the costly LLM call runs at most once per day.
    pub trend_force: bool,
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

        // Optional: only set when trend analysis is desired. Empty string is
        // treated as unset so a blank .env line doesn't enable a broken call.
        let openrouter_api_key = std::env::var("OPENROUTER_API_KEY")
            .ok()
            .filter(|k| !k.trim().is_empty());

        let openrouter_model = std::env::var("OPENROUTER_MODEL")
            .unwrap_or_else(|_| "nvidia/nemotron-3-ultra-550b-a55b:free".to_string());

        let trend_max_items = std::env::var("TREND_MAX_ITEMS")
            .ok()
            .and_then(|v| v.parse::<usize>().ok())
            .unwrap_or(80);

        // Accept 1/true/yes (case-insensitive) as truthy.
        let trend_force = std::env::var("TREND_FORCE")
            .map(|v| matches!(v.trim().to_lowercase().as_str(), "1" | "true" | "yes"))
            .unwrap_or(false);

        Ok(Self {
            database_url,
            arxiv_api_url,
            ingestion_interval_secs,
            openrouter_api_key,
            openrouter_model,
            trend_max_items,
            trend_force,
        })
    }
}
