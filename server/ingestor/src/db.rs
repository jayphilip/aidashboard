use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;
use std::time::Duration;
use uuid::Uuid;

use crate::models::{Item, Source, ItemTopic, ItemLike};

// Legacy Paper struct - kept for backward compatibility during migration
#[derive(Debug, Clone)]
pub struct Paper {
    pub id: Uuid,
    pub source: String,
    pub external_id: String,
    pub title: String,
    pub authors: Vec<String>,
    pub abstract_text: Option<String>,
    pub categories: Vec<String>,
    pub published_at: DateTime<Utc>,
    pub url: Option<String>,
    pub pdf_url: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

pub async fn create_pool(database_url: &str) -> Result<PgPool> {
    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect(database_url)
        .await?;

    // Run migrations on startup
    sqlx::migrate!("../migrations")
        .run(&pool)
        .await?;

    Ok(pool)
}

// Legacy paper insertion - still supported but should be migrated to items
pub async fn insert_or_update_paper(pool: &PgPool, paper: &Paper) -> Result<()> {
    sqlx::query(
        "INSERT INTO papers (id, source, external_id, title, authors, abstract, categories, published_at, url, pdf_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (source, external_id) DO UPDATE
         SET title = $4, authors = $5, abstract = $6, categories = $7, published_at = $8, url = $9, pdf_url = $10, updated_at = $12"
    )
    .bind(paper.id)
    .bind(&paper.source)
    .bind(&paper.external_id)
    .bind(&paper.title)
    .bind(&paper.authors)
    .bind(&paper.abstract_text)
    .bind(&paper.categories)
    .bind(paper.published_at)
    .bind(&paper.url)
    .bind(&paper.pdf_url)
    .bind(paper.created_at)
    .bind(paper.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

// Source operations
pub async fn get_or_create_source(
    pool: &PgPool,
    name: &str,
    source_type: &str,
    medium: &str,
    ingest_url: Option<&str>,
    meta: serde_json::Value,
) -> Result<Source> {
    let source = sqlx::query_as::<_, Source>(
        "INSERT INTO sources (name, type, medium, ingest_url, active, meta)
         VALUES ($1, $2, $3, $4, true, $5)
         ON CONFLICT (name, type) DO UPDATE
         SET medium = $3, ingest_url = $4, meta = $5
         RETURNING *"
    )
    .bind(name)
    .bind(source_type)
    .bind(medium)
    .bind(ingest_url)
    .bind(meta)
    .fetch_one(pool)
    .await?;

    Ok(source)
}

pub async fn get_active_sources(pool: &PgPool) -> Result<Vec<Source>> {
    let sources = sqlx::query_as::<_, Source>(
        "SELECT * FROM sources WHERE active = true ORDER BY name"
    )
    .fetch_all(pool)
    .await?;

    Ok(sources)
}

// Item operations
pub async fn insert_or_update_item(pool: &PgPool, item: &Item) -> Result<()> {
    sqlx::query(
        "INSERT INTO items (id, source_id, source_type, title, url, summary, body, published_at, raw_metadata, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (source_id, url) DO UPDATE
         SET title = $4, summary = $6, body = $7, published_at = $8, raw_metadata = $9, updated_at = $11"
    )
    .bind(item.id)
    .bind(item.source_id)
    .bind(&item.source_type)
    .bind(&item.title)
    .bind(&item.url)
    .bind(&item.summary)
    .bind(&item.body)
    .bind(item.published_at)
    .bind(&item.raw_metadata)
    .bind(item.created_at)
    .bind(item.updated_at)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_items_by_source(pool: &PgPool, source_id: i32, limit: i64) -> Result<Vec<Item>> {
    let items = sqlx::query_as::<_, Item>(
        "SELECT * FROM items WHERE source_id = $1 ORDER BY published_at DESC LIMIT $2"
    )
    .bind(source_id)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(items)
}

pub async fn get_latest_items(pool: &PgPool, limit: i64) -> Result<Vec<Item>> {
    let items = sqlx::query_as::<_, Item>(
        "SELECT * FROM items ORDER BY published_at DESC LIMIT $1"
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(items)
}

// Item topics
pub async fn add_item_topic(pool: &PgPool, item_id: Uuid, topic: &str) -> Result<()> {
    sqlx::query(
        "INSERT INTO item_topics (item_id, topic) VALUES ($1, $2) ON CONFLICT DO NOTHING"
    )
    .bind(item_id)
    .bind(topic)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_item_topics(pool: &PgPool, item_id: Uuid) -> Result<Vec<ItemTopic>> {
    let topics = sqlx::query_as::<_, ItemTopic>(
        "SELECT * FROM item_topics WHERE item_id = $1 ORDER BY topic"
    )
    .bind(item_id)
    .fetch_all(pool)
    .await?;

    Ok(topics)
}

// Item likes
pub async fn set_item_like(pool: &PgPool, user_id: &str, item_id: Uuid, score: i32) -> Result<()> {
    if score < -1 || score > 1 {
        return Err(anyhow::anyhow!("Score must be -1, 0, or 1"));
    }

    sqlx::query(
        "INSERT INTO item_likes (user_id, item_id, score) VALUES ($1, $2, $3)
         ON CONFLICT (user_id, item_id) DO UPDATE SET score = $3"
    )
    .bind(user_id)
    .bind(item_id)
    .bind(score)
    .execute(pool)
    .await?;

    Ok(())
}

pub async fn get_item_likes(pool: &PgPool, item_id: Uuid) -> Result<Vec<ItemLike>> {
    let likes = sqlx::query_as::<_, ItemLike>(
        "SELECT * FROM item_likes WHERE item_id = $1"
    )
    .bind(item_id)
    .fetch_all(pool)
    .await?;

    Ok(likes)
}



