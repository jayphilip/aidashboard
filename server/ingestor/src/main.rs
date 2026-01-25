mod config;
mod db;
mod models;
mod sources;

use anyhow::Result;
use config::Config;
use db::create_pool;
use sources::run_ingestion_cycle;
use std::time::Duration;
use tokio::time::sleep;

#[tokio::main]
async fn main() -> Result<()> {
    env_logger::Builder::from_default_env()
        .filter_level(log::LevelFilter::Info)
        .init();

    dotenvy::dotenv().ok();

    let config = Config::from_env()?;

    log::info!("Connecting to database: {}", config.database_url);

    // Create connection pool
    let pool = create_pool(&config.database_url).await?;

    // Test the connection with a simple query
    let result: (i32,) = sqlx::query_as("SELECT 1")
        .fetch_one(&pool)
        .await?;

    log::info!("Database connection successful: {:?}", result);
    log::info!("Ingestor initialized. Starting ingestion loop...");

    // Run the ingestion loop
    ingestion_loop(&pool, &config).await?;

    Ok(())
}

async fn ingestion_loop(pool: &sqlx::PgPool, config: &Config) -> Result<()> {
    loop {
        log::info!(
            "Starting ingestion cycle (interval: {} seconds)",
            config.ingestion_interval_secs
        );

        // Run the generic ingestion dispatcher
        match run_ingestion_cycle(pool, &config.arxiv_api_url).await {
            Ok(count) => {
                log::info!("Ingestion cycle completed: {} items inserted/updated", count);
            }
            Err(e) => {
                log::error!("Ingestion cycle failed: {}", e);
            }
        }

        log::info!(
            "Ingestion cycle complete. Sleeping for {} seconds...",
            config.ingestion_interval_secs
        );

        sleep(Duration::from_secs(config.ingestion_interval_secs)).await;
    }
}
