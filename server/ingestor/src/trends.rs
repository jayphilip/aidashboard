//! LLM-powered trend analysis.
//!
//! After an ingestion cycle, this module feeds the most recent items to an
//! OpenRouter model (default `openrouter/owl-alpha`, a free model; the call
//! uses the OpenAI-compatible chat completions API) and asks for a structured
//! "state of AI" summary: an overall narrative plus a handful of named themes.
//! The result is written to the `trend_reports` table, which syncs to the
//! browser via ElectricSQL and populates the Trends tab — keeping the app's
//! Zero-API contract intact. The model is configurable via OPENROUTER_MODEL.

use anyhow::{anyhow, Result};
use chrono::Utc;
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::PgPool;

use crate::config::Config;

const OPENROUTER_URL: &str = "https://openrouter.ai/api/v1/chat/completions";

const SYSTEM_PROMPT: &str = r#"You are an AI research trends analyst. You receive a list of recent items (papers, blog posts, newsletters) from an AI news dashboard. Each item has a title, source type, optional summary, and topics.

Your job:
1. Read all items and identify what is actually happening in AI right now based ONLY on these items. Do not invent items or links.
2. Write a concise "state of AI" narrative: 2-3 short paragraphs summarizing the dominant themes, notable shifts, and what's emerging. Be specific and reference real developments visible in the items.
3. Cluster the items into 4-8 named themes. For each theme give a one-line "what's happening" summary, an item_count, 1-4 short tags, and up to 3 representative items (use the EXACT title and url from the input).

Output STRICT JSON matching this schema exactly, no extra fields, no markdown:

{
  "narrative": "2-3 paragraph string",
  "themes": [
    {
      "name": "Theme name",
      "summary": "One-line what's-happening summary",
      "item_count": N,
      "tags": ["tag1", "tag2"],
      "items": [
        { "title": "exact item title", "url": "exact item url" }
      ]
    }
  ]
}

Use only the provided items. Keep titles and urls verbatim. Return valid JSON only."#;

/// A representative item link inside a theme.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThemeItem {
    pub title: String,
    #[serde(default)]
    pub url: String,
}

/// A clustered theme produced by Hermes.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Theme {
    pub name: String,
    #[serde(default)]
    pub summary: String,
    #[serde(default)]
    pub item_count: i64,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default)]
    pub items: Vec<ThemeItem>,
}

/// The full analysis returned by Hermes (before persistence metadata).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    #[serde(default)]
    pub narrative: String,
    #[serde(default)]
    pub themes: Vec<Theme>,
}

/// Compact item view sent to the model — keeps the payload small.
#[derive(Debug, Serialize)]
struct ItemForModel {
    title: String,
    source_type: String,
    summary: String,
    topics: Vec<String>,
    url: String,
}

/// Run the full trend-analysis step: fetch recent items, call Hermes, persist
/// the report. No-op (logged) when no API key is configured or no items exist.
pub async fn run_trend_analysis(pool: &PgPool, config: &Config) -> Result<()> {
    let api_key = match &config.openrouter_api_key {
        Some(key) => key,
        None => {
            log::info!("[trends] OPENROUTER_API_KEY not set — skipping trend analysis");
            return Ok(());
        }
    };

    // Cost control: the report is a single per-day row, so the expensive
    // Hermes call only needs to run once per day no matter how often the
    // ingestion loop polls. Skip if today's report already exists. A cheap
    // SELECT here avoids ~23 redundant LLM calls/day on an hourly ingestor.
    let report_date = Utc::now().format("%Y-%m-%d").to_string();
    if !config.trend_force && report_exists(pool, &report_date).await? {
        log::info!("[trends] Report for {} already exists — skipping (set TREND_FORCE=1 to override)", report_date);
        return Ok(());
    }

    let items = fetch_recent_items(pool, config.trend_max_items as i64).await?;
    if items.is_empty() {
        log::info!("[trends] No recent items to analyze — skipping");
        return Ok(());
    }
    log::info!("[trends] Analyzing {} recent items with {}", items.len(), config.openrouter_model);

    let analysis = analyze(api_key, &config.openrouter_model, &items).await?;
    upsert_trend_report(pool, &report_date, items.len() as i32, &analysis, &config.openrouter_model).await?;

    log::info!(
        "[trends] Saved trend report for {} ({} themes)",
        report_date,
        analysis.themes.len()
    );
    Ok(())
}

/// Pull the most recent items (joined with source name via source_type already
/// on the row) to feed the model.
async fn fetch_recent_items(pool: &PgPool, limit: i64) -> Result<Vec<ItemForModel>> {
    let rows = sqlx::query_as::<_, (String, String, Option<String>, Vec<String>, String)>(
        "SELECT title, source_type, summary, COALESCE(topics, '{}'), url
         FROM items
         ORDER BY published_at DESC
         LIMIT $1",
    )
    .bind(limit)
    .fetch_all(pool)
    .await?;

    Ok(rows
        .into_iter()
        .map(|(title, source_type, summary, topics, url)| ItemForModel {
            title,
            source_type,
            // Trim long summaries so the prompt stays well within context.
            summary: summary.unwrap_or_default().chars().take(400).collect(),
            topics,
            url,
        })
        .collect())
}

/// Call OpenRouter (Hermes) and parse the JSON response.
async fn analyze(api_key: &str, model: &str, items: &[ItemForModel]) -> Result<TrendAnalysis> {
    let payload = serde_json::to_string(items)?;
    let user_content = format!(
        "Analyze these {} recent AI items and return JSON:\n\n{}",
        items.len(),
        payload
    );

    let body = json!({
        "model": model,
        "messages": [
            { "role": "system", "content": SYSTEM_PROMPT },
            { "role": "user", "content": user_content }
        ],
        "temperature": 0.3,
        "max_tokens": 4096,
        "response_format": { "type": "json_object" }
    });

    let client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let resp = client
        .post(OPENROUTER_URL)
        .header("Authorization", format!("Bearer {}", api_key))
        .header("Content-Type", "application/json")
        // OpenRouter ranking headers (optional but recommended).
        .header("HTTP-Referer", "https://github.com/aidashboard")
        .header("X-Title", "AI Research Dashboard")
        .json(&body)
        .send()
        .await?;

    let status = resp.status();
    let text = resp.text().await?;
    if !status.is_success() {
        return Err(anyhow!("OpenRouter returned {}: {}", status, text));
    }

    // OpenAI-compatible envelope: choices[0].message.content holds the JSON.
    let envelope: serde_json::Value = serde_json::from_str(&text)
        .map_err(|e| anyhow!("Failed to parse OpenRouter envelope: {} — body: {}", e, text))?;

    let content = envelope
        .get("choices")
        .and_then(|c| c.get(0))
        .and_then(|c| c.get("message"))
        .and_then(|m| m.get("content"))
        .and_then(|c| c.as_str())
        .ok_or_else(|| anyhow!("Unexpected OpenRouter response shape: {}", text))?;

    let analysis: TrendAnalysis = serde_json::from_str(content)
        .map_err(|e| anyhow!("Hermes returned non-conforming JSON: {} — content: {}", e, content))?;

    Ok(analysis)
}

/// Cheap existence check so we don't pay for an LLM call when today's report
/// is already generated.
async fn report_exists(pool: &PgPool, report_date: &str) -> Result<bool> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM trend_reports WHERE report_date = $1)",
    )
    .bind(report_date)
    .fetch_one(pool)
    .await?;
    Ok(exists)
}

/// Insert or update the canonical report for a given date.
async fn upsert_trend_report(
    pool: &PgPool,
    report_date: &str,
    items_analyzed: i32,
    analysis: &TrendAnalysis,
    model: &str,
) -> Result<()> {
    let themes_json = serde_json::to_value(&analysis.themes)?;

    sqlx::query(
        "INSERT INTO trend_reports (report_date, items_analyzed, narrative, themes, model, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (report_date) DO UPDATE
         SET items_analyzed = $2, narrative = $3, themes = $4, model = $5, updated_at = NOW()",
    )
    .bind(report_date)
    .bind(items_analyzed)
    .bind(&analysis.narrative)
    .bind(themes_json)
    .bind(model)
    .execute(pool)
    .await?;

    Ok(())
}
