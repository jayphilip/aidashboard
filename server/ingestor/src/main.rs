mod config;
mod db;
mod models;
mod sources;

use anyhow::Result;
use config::Config;
use db::create_pool;
use sources::run_ingestion_cycle;

#[tokio::main]
async fn main() -> Result<()> {
    // Logging
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    // .env (optional locally; on Render you'll use env vars)
    dotenvy::dotenv().ok();

    // Load config (includes DATABASE_URL, ARXIV_API_URL, etc.)
    let config = Config::from_env()?;

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
    match run_ingestion_cycle(&pool, &config.arxiv_api_url).await {
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
