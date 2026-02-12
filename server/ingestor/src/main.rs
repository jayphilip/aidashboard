mod config;
mod db;
mod models;
mod sources;
mod topics;

use anyhow::Result;
use config::Config;
use db::create_pool;
use sources::run_ingestion_cycle;

#[tokio::main]
async fn main() -> Result<()> {
    // Logging - write to stderr and enable timestamps
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .target(env_logger::Target::Stderr)
        .init();

    log::info!("AI Dashboard Ingestor starting...");

    // .env (optional locally; on Render you'll use env vars)
    dotenvy::dotenv().ok();

    // Load config (includes DATABASE_URL, ARXIV_API_URL, etc.)
    let config = match Config::from_env() {
        Ok(cfg) => cfg,
        Err(e) => {
            log::error!("Failed to load configuration: {}", e);
            return Err(e);
        }
    };

    log::info!("Connecting to database: {}", config.database_url);

    // DB pool
    let pool = create_pool(&config.database_url).await?;

    // Smoke test
    let result: (i32,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await?;
    log::info!("Database connection successful: {:?}", result);

    // Single ingestion cycle (no loop)
    log::info!("Starting single ingestion cycle (cron mode)...");
    match run_ingestion_cycle(&pool).await {
        Ok(count) => {
            log::info!("Ingestion cycle completed: {} items inserted/updated", count);
        }
        Err(e) => {
            log::error!("Ingestion cycle failed: {e}");
            // Optionally: return Err(e) to make the job fail visibly on Render
        }
    }

    log::info!("Ingestion cycle finished; exiting.");
    Ok(())
}
