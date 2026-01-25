use anyhow::Result;
use chrono::{DateTime, Utc};
use sqlx::postgres::PgPoolOptions;
use sqlx::{PgPool, Row};
use std::time::Duration;
use uuid::Uuid;

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

    Ok(pool)
}

pub async fn insert_or_update_paper(pool: &PgPool, paper: &Paper) -> Result<()> {
    sqlx::query(
        "INSERT INTO papers (id, source, external_id, title, authors, abstract, categories, published_at, url, pdf_url, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT (source, external_id) DO UPDATE
         SET title = $4, authors = $5, abstract = $6, categories = $7, published_at = $8, url = $9, pdf_url = $10, updated_at = $12
         WHERE EXCLUDED.source = $2 AND EXCLUDED.external_id = $3"
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

pub async fn get_latest_papers(pool: &PgPool, source: &str, limit: i64) -> Result<Vec<Paper>> {
    let rows = sqlx::query(
        "SELECT id, source, external_id, title, authors, abstract, categories, published_at, url, pdf_url, created_at, updated_at
         FROM papers
         WHERE source = $1
         ORDER BY published_at DESC
         LIMIT $2"
    )
    .bind(source)
    .bind(limit)
    .fetch_all(pool)
    .await?;

    let papers = rows
        .into_iter()
        .map(|row| Paper {
            id: row.get("id"),
            source: row.get("source"),
            external_id: row.get("external_id"),
            title: row.get("title"),
            authors: row.get("authors"),
            abstract_text: row.get("abstract"),
            categories: row.get("categories"),
            published_at: row.get("published_at"),
            url: row.get("url"),
            pdf_url: row.get("pdf_url"),
            created_at: row.get("created_at"),
            updated_at: row.get("updated_at"),
        })
        .collect();

    Ok(papers)
}

pub async fn count_papers(pool: &PgPool, source: &str) -> Result<i64> {
    let row = sqlx::query("SELECT COUNT(*) as count FROM papers WHERE source = $1")
        .bind(source)
        .fetch_one(pool)
        .await?;

    Ok(row.get("count"))
}
