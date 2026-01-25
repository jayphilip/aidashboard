use crate::db::{insert_or_update_paper, Paper};
use anyhow::Result;
use chrono::DateTime;
use quick_xml::de::from_str;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
struct Feed {
    entry: Option<Vec<Entry>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
struct Entry {
    id: String,
    title: String,
    summary: Option<String>,
    published: String,
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

pub async fn run_arxiv_ingestion(pool: &PgPool, arxiv_api_url: &str) -> Result<u64> {
    log::info!("Starting ArXiv ingestion...");

    // Fetch recent papers from cs.AI and cs.LG categories
    let papers = fetch_arxiv_papers(arxiv_api_url).await?;

    log::info!("Fetched {} papers from ArXiv", papers.len());

    // Insert or update each paper in the database
    let mut inserted = 0;
    for paper in papers {
        if let Err(e) = insert_or_update_paper(pool, &paper).await {
            log::warn!("Failed to insert paper {}: {}", paper.external_id, e);
        } else {
            inserted += 1;
        }
    }

    log::info!("Successfully inserted/updated {} papers", inserted);

    Ok(inserted)
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
