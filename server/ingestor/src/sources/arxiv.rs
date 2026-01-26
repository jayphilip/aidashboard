use crate::db::insert_or_update_item;
use crate::models::Item;

// Legacy Paper struct - kept for backwards compatibility during migration
#[derive(Debug, Clone)]
struct Paper {
    id: uuid::Uuid,
    source: String,
    external_id: String,
    title: String,
    authors: Vec<String>,
    abstract_text: Option<String>,
    categories: Vec<String>,
    published_at: chrono::DateTime<chrono::Utc>,
    url: Option<String>,
    pdf_url: Option<String>,
    created_at: chrono::DateTime<chrono::Utc>,
    updated_at: chrono::DateTime<chrono::Utc>,
}
use anyhow::Result;
use chrono::DateTime;
use quick_xml::de::from_str;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
struct Feed {
    #[serde(default)]
    title: Option<String>,
    #[serde(default)]
    id: Option<String>,
    #[serde(default)]
    updated: Option<String>,
    #[serde(default)]
    entry: Option<Vec<Entry>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Entry {
    id: String,
    title: String,
    summary: Option<String>,
    published: String,
    #[serde(default)]
    updated: Option<String>,
    #[serde(rename = "author", default)]
    authors: Vec<Author>,
    #[serde(rename = "arxiv:primary_category", default)]
    primary_category: Option<PrimaryCategory>,
    #[serde(rename = "category", default)]
    categories: Vec<Category>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Author {
    name: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct PrimaryCategory {
    #[serde(rename = "@term")]
    term: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Category {
    #[serde(rename = "@term")]
    term: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Link {
    #[serde(rename = "@href")]
    href: Option<String>,
    #[serde(rename = "@title")]
    title: Option<String>,
}

pub async fn run_arxiv_ingestion(pool: &PgPool, source: &crate::models::Source) -> Result<u64> {
    let arxiv_api_url = match &source.ingest_url {
        Some(url) => url,
        None => {
            log::warn!("ArXiv source {} has no ingest_url, skipping", source.name);
            return Ok(0);
        }
    };

    log::info!("Starting ArXiv ingestion for source: {}", source.name);

    // Fetch recent papers from arXiv
    let items = fetch_arxiv_items(source, arxiv_api_url).await?;

    log::info!("Fetched {} items from ArXiv", items.len());

    // Insert or update each item in the database
    let mut inserted = 0;
    for item in items {
        if let Err(e) = insert_or_update_item(pool, &item).await {
            log::warn!("Failed to insert item {}: {}", item.url, e);
        } else {
            inserted += 1;

            // Extract and add topics
            let topics = crate::topics::extract_topics(&item.title, item.summary.as_deref());
            for topic in topics {
                if let Err(e) = crate::db::add_item_topic(pool, item.id, &topic).await {
                    log::warn!("Failed to add topic '{}' for item {}: {}", topic, item.url, e);
                }
            }
        }
    }

    log::info!("Successfully inserted/updated {} items from source: {}", inserted, source.name);

    Ok(inserted)
}

async fn fetch_arxiv_items(source: &crate::models::Source, arxiv_api_url: &str) -> Result<Vec<Item>> {
    // Query for papers in Quantitative Finance category
    let query = "cat:q-fin.GN";
    let url = format!(
        "{}?search_query={}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending",
        arxiv_api_url,
        urlencoding::encode(query)
    );

    log::info!("Fetching from ArXiv API: {}", url);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "AI-Dashboard-Ingestor/0.1")
        .send()
        .await?;

    let xml_text = response.text().await?;

    // Parse the Atom feed
    let feed: Feed = from_str(&xml_text)?;

    let entries = feed.entry.unwrap_or_default();
    log::info!("Parsed {} entries from ArXiv response", entries.len());

    let items = entries
        .into_iter()
        .filter_map(|entry| entry_to_item(entry, &xml_text, source))
        .collect();

    Ok(items)
}

async fn fetch_arxiv_papers(arxiv_api_url: &str) -> Result<Vec<Paper>> {
    // Query for papers in cs.AI and cs.LG categories, most recent first
    let query = "cat:q-fin.GN";
    let url = format!(
        "{}?search_query={}&start=0&max_results=100&sortBy=submittedDate&sortOrder=descending",
        arxiv_api_url,
        urlencoding::encode(query)
    );

    log::info!("Fetching from ArXiv API: {}", url);

    let client = reqwest::Client::new();
    let response = client
        .get(&url)
        .header("User-Agent", "AI-Dashboard-Ingestor/0.1")
        .send()
        .await?;

    let xml_text = response.text().await?;

    // Parse the Atom feed
    let feed: Feed = from_str(&xml_text)?;

    let entries = feed.entry.unwrap_or_default();
    log::info!("Parsed {} entries from ArXiv response", entries.len());

    let papers = entries
        .into_iter()
        .filter_map(|entry| entry_to_paper(entry, &xml_text))
        .collect();

    Ok(papers)
}

fn entry_to_paper(entry: Entry, xml_text: &str) -> Option<Paper> {
    // Extract arXiv ID from the entry ID (format: http://arxiv.org/abs/XXXX.XXXXX)
    let external_id = entry.id.split('/').last()?.to_string();

    // Extract categories
    let mut categories = vec![];
    if let Some(pc) = entry.primary_category {
        categories.push(pc.term);
    }
    for cat in entry.categories {
        categories.push(cat.term);
    }

    // Extract authors
    let authors: Vec<String> = entry
        .authors
        .iter()
        .map(|a| a.name.clone())
        .collect();

    // Parse published date
    let published_at = DateTime::parse_from_rfc3339(&entry.published)
        .ok()?
        .with_timezone(&chrono::Utc);

    // Extract URLs by manually parsing the XML for link elements
    let mut url = None;
    let mut pdf_url = None;

    // Find the entry section in XML and extract links
    if let Some(entry_start) = xml_text.find(&format!("<id>{}</id>", entry.id)) {
        if let Some(entry_end) = xml_text[entry_start..].find("</entry>") {
            let entry_xml = &xml_text[entry_start..entry_start + entry_end + 8];
            
            // Extract all href attributes from link elements
            for line in entry_xml.lines() {
                if line.contains("<link") {
                    if let Some(href_start) = line.find("href=\"") {
                        let href_content = &line[href_start + 6..];
                        if let Some(href_end) = href_content.find('\"') {
                            let href = href_content[..href_end].to_string();
                            
                            // Check if this is a PDF link
                            if line.contains("title=\"pdf\"") {
                                pdf_url = Some(href);
                            } else if url.is_none() && !href.contains("abs") {
                                url = Some(href);
                            } else if url.is_none() {
                                url = Some(href);
                            }
                        }
                    }
                }
            }
        }
    }

    let paper = Paper {
        id: Uuid::new_v4(),
        source: "arxiv".to_string(),
        external_id,
        title: entry.title.trim().to_string(),
        authors,
        abstract_text: entry.summary.map(|s| s.trim().to_string()),
        categories,
        published_at,
        url,
        pdf_url,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Some(paper)
}

fn entry_to_item(entry: Entry, xml_text: &str, source: &crate::models::Source) -> Option<Item> {
    // Extract arXiv ID from the entry ID (format: http://arxiv.org/abs/XXXX.XXXXX)
    let external_id = entry.id.split('/').last()?.to_string();

    // Extract categories
    let mut categories = vec![];
    if let Some(pc) = entry.primary_category {
        categories.push(pc.term);
    }
    for cat in entry.categories {
        categories.push(cat.term);
    }

    // Extract authors
    let authors: Vec<String> = entry
        .authors
        .iter()
        .map(|a| a.name.clone())
        .collect();

    // Parse published date
    let published_at = DateTime::parse_from_rfc3339(&entry.published)
        .ok()?
        .with_timezone(&chrono::Utc);

    // Extract URLs by manually parsing the XML for link elements
    let mut url = None;
    let mut pdf_url = None;

    // Find the entry section in XML and extract links
    if let Some(entry_start) = xml_text.find(&format!("<id>{}</id>", entry.id)) {
        if let Some(entry_end) = xml_text[entry_start..].find("</entry>") {
            let entry_xml = &xml_text[entry_start..entry_start + entry_end + 8];
            
            // Extract all href attributes from link elements
            for line in entry_xml.lines() {
                if line.contains("<link") {
                    if let Some(href_start) = line.find("href=\"") {
                        let href_content = &line[href_start + 6..];
                        if let Some(href_end) = href_content.find('\"') {
                            let href = href_content[..href_end].to_string();
                            
                            // Check if this is a PDF link
                            if line.contains("title=\"pdf\"") {
                                pdf_url = Some(href);
                            } else if url.is_none() && !href.contains("abs") {
                                url = Some(href);
                            } else if url.is_none() {
                                url = Some(href);
                            }
                        }
                    }
                }
            }
        }
    }

    // Build raw_metadata with arXiv-specific fields
    let raw_metadata = serde_json::json!({
        "arxiv_id": external_id,
        "categories": categories,
        "authors": authors,
        "pdf_url": pdf_url,
    });

    let item = Item {
        id: Uuid::new_v4(),
        source_id: source.id,
        source_type: "paper".to_string(),
        title: entry.title.trim().to_string(),
        url: url?,
        summary: entry.summary.map(|s| s.trim().to_string()),
        body: None,
        published_at,
        raw_metadata,
        created_at: chrono::Utc::now(),
        updated_at: chrono::Utc::now(),
    };

    Some(item)
}
