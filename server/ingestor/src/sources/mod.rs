pub mod arxiv;
pub mod rss;

pub use arxiv::run_arxiv_ingestion;
pub use rss::run_rss_ingestion;
use anyhow::Result;
use sqlx::PgPool;

/// Generic ingestion dispatcher that routes to the appropriate ingestor based on source type
pub async fn run_ingestion_cycle(pool: &PgPool) -> Result<u64> {
    log::info!("Starting ingestion cycle...");

    // Load all active sources from the database
    let sources = crate::db::get_active_sources(pool).await?;

    if sources.is_empty() {
        log::warn!("No active sources found in database");
        return Ok(0);
    }

    log::info!("Found {} active sources", sources.len());

    let mut total_inserted = 0;

    // Route each source to the appropriate ingestor
    for source in sources {
        log::info!("Processing source: {} (type: {})", source.name, source.source_type);

        let result = match source.source_type.as_str() {
            "arxiv" => run_arxiv_ingestion(pool, &source).await,
            "rss" => run_rss_ingestion(pool, &source).await,
            "twitter_api" => {
                log::info!("Twitter API ingestion not yet implemented for source: {}", source.name);
                Ok(0)
            },
            "manual" => {
                log::info!("Manual source: {} - skipping automated ingestion", source.name);
                Ok(0)
            },
            unknown => {
                log::warn!("Unknown source type: {} for source: {}", unknown, source.name);
                Ok(0)
            }
        };

        match result {
            Ok(count) => {
                log::info!("Source {} ingestion complete: {} items", source.name, count);
                total_inserted += count;
            },
            Err(e) => {
                log::error!("Error ingesting from source {}: {}", source.name, e);
                // Continue with next source instead of failing entire cycle
            }
        }
    }

    log::info!("Ingestion cycle complete. Total items inserted: {}", total_inserted);
    Ok(total_inserted)
}