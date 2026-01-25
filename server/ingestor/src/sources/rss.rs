use crate::db::insert_or_update_item;
use crate::models::Item;
use anyhow::Result;
use chrono::Utc;
use feed_rs::parser;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

pub async fn run_rss_ingestion(pool: &PgPool, source: &crate::models::Source) -> Result<u64> {
    let ingest_url = match &source.ingest_url {
        Some(url) => url,
        None => {
            log::warn!("RSS source {} has no ingest_url, skipping", source.name);
            return Ok(0);
        }
    };

    log::info!("Starting RSS ingestion for source: {} ({})", source.name, ingest_url);

    // Fetch and parse the RSS/Atom feed
    let items = fetch_rss_items(source, ingest_url).await?;
    log::info!("Fetched {} items from RSS feed: {}", items.len(), source.name);

    // Insert or update each item in the database
    let mut inserted = 0;
    for item in items {
        if let Err(e) = insert_or_update_item(pool, &item).await {
            log::warn!("Failed to insert RSS item {}: {}", item.url, e);
        } else {
            inserted += 1;
        }
    }

    log::info!(
        "Successfully inserted/updated {} items from source: {}",
        inserted,
        source.name
    );

    Ok(inserted)
}

async fn fetch_rss_items(
    source: &crate::models::Source,
    ingest_url: &str,
) -> Result<Vec<Item>> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let response = client
        .get(ingest_url)
        .header("User-Agent", "AI-Dashboard-Ingestor/0.1")
        .send()
        .await?;

    let content = response.bytes().await?;

    // Parse the feed using feed-rs (handles both RSS and Atom)
    let feed = parser::parse(&content[..])?;

    let items = feed
        .entries
        .into_iter()
        .filter_map(|entry| entry_to_item(entry, source))
        .collect();

    Ok(items)
}

fn entry_to_item(entry: feed_rs::model::Entry, source: &crate::models::Source) -> Option<Item> {
    // Extract title
    let title = entry.title.map(|t| t.content).unwrap_or_else(|| {
        format!(
            "Untitled ({})",
            chrono::Local::now().format("%Y-%m-%d %H:%M:%S")
        )
    });

    // Extract URL (prefer link with rel="alternate", fall back to id)
    let url = entry
        .links
        .iter()
        .find(|link| link.rel.as_deref().unwrap_or("alternate") == "alternate")
        .and_then(|link| Some(link.href.clone()))
        .or_else(|| Some(entry.id.clone()));

    // If no URL found, skip this entry
    let url = url?;

    // Extract summary
    let summary = entry
        .summary
        .map(|s| s.content)
        .or_else(|| {
            // Try to get first content entry
            entry
                .content
                .as_ref()
                .and_then(|content| content.body.clone())
                .map(|body| {
                    // Limit summary to first 500 chars
                    let truncated = body
                        .chars()
                        .take(500)
                        .collect::<String>();
                    if truncated.len() < body.len() {
                        format!("{}...", truncated)
                    } else {
                        body
                    }
                })
        });

    // Extract body (full content if available)
    let body = entry.content.as_ref().and_then(|content| {
        content
            .body
            .as_ref()
            .map(|b| {
                let truncated = b
                    .chars()
                    .take(10000)
                    .collect::<String>();
                if truncated.len() < b.len() {
                    format!("{}...", truncated)
                } else {
                    b.clone()
                }
            })
    });

    // Extract published date
    let published_at = entry
        .published
        .or_else(|| entry.updated)
        .unwrap_or_else(Utc::now);

    // Build metadata
    let mut metadata = serde_json::json!({
        "feed_id": entry.id,
        "authors": entry.authors
            .iter()
            .map(|a| &a.name)
            .collect::<Vec<_>>(),
        "categories": entry.categories
            .iter()
            .map(|c| &c.term)
            .collect::<Vec<_>>(),
    });

    // Add feed links to metadata
    if !entry.links.is_empty() {
        if let Some(obj) = metadata.as_object_mut() {
            let links: Vec<serde_json::Value> = entry
                .links
                .iter()
                .take(3) // Limit to 3 links to keep metadata reasonable
                .map(|link| {
                    serde_json::json!({
                        "href": link.href,
                        "rel": link.rel,
                        "media_type": link.media_type,
                    })
                })
                .collect();
            obj.insert("links".to_string(), serde_json::json!(links));
        }
    }

    Some(Item {
        id: Uuid::new_v4(),
        source_id: source.id,
        source_type: source.medium.clone(),
        title,
        url,
        summary,
        body,
        published_at,
        raw_metadata: metadata,
        created_at: Utc::now(),
        updated_at: Utc::now(),
    })
}
