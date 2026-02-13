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

    // Run continuous ingestion loop with configured interval
    log::info!(
        "Starting ingestion loop (interval: {} seconds)...",
        config.ingestion_interval_secs
    );

    loop {
        let cycle_start = std::time::Instant::now();

        log::info!("Starting ingestion cycle...");
        match run_ingestion_cycle(&pool).await {
            Ok(count) => {
                log::info!("Ingestion cycle completed: {} items inserted/updated", count);
            }
            Err(e) => {
                log::error!("Ingestion cycle failed: {}", e);
                // Continue running even if one cycle fails
            }
        }

        let cycle_duration = cycle_start.elapsed();
        log::info!("Cycle took {:.2}s", cycle_duration.as_secs_f64());

        // Sleep for the configured interval
        log::info!(
            "Sleeping for {} seconds until next cycle...",
            config.ingestion_interval_secs
        );
        tokio::time::sleep(tokio::time::Duration::from_secs(
            config.ingestion_interval_secs,
        ))
        .await;
    }
}
