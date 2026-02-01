use anyhow::Result;
use sqlx::postgres::PgPoolOptions;
use sqlx::Row;
use std::time::Duration;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable not set");

    let pool = PgPoolOptions::new()
        .max_connections(5)
        .acquire_timeout(Duration::from_secs(5))
        .connect(&database_url)
        .await?;

    // Get total count
    let count_row = sqlx::query("SELECT COUNT(*) as count FROM papers")
        .fetch_one(&pool)
        .await?;
    let total: i64 = count_row.get("count");

    println!("\n📊 Total papers in database: {}\n", total);

    // Get latest papers
    println!("📚 Latest 10 papers:");
    println!("{:-^100}", "");

    let rows = sqlx::query(
        "SELECT title, source, published_at, authors FROM papers ORDER BY published_at DESC LIMIT 50"
    )
    .fetch_all(&pool)
    .await?;

    for (i, row) in rows.iter().enumerate() {
        let title: String = row.get("title");
        let source: String = row.get("source");
        let published_at: chrono::DateTime<chrono::Utc> = row.get("published_at");
        let authors: Vec<String> = row.get("authors");

        println!("\n{}. {}", i + 1, title);
        println!("   Source: {} | Published: {}", source, published_at.format("%Y-%m-%d"));
        if !authors.is_empty() {
            println!("   Authors: {}", authors.join(", "));
        }
    }

    println!("\n{:-^100}\n", "");

    Ok(())
}
