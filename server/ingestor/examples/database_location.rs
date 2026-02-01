use sqlx::PgPool;

#[tokio::main]
async fn main() -> Result<(), sqlx::Error> {
    let pool = PgPool::connect("postgresql://postgres:postgres@localhost:54321/aidashboard").await?;

    let row: (String,) = sqlx::query_as("SHOW data_directory;")
        .fetch_one(&pool)
        .await?;

    println!("Data directory: {}", row.0);

    Ok(())
}
