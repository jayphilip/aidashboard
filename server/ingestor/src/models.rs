use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

/// Represents the type of source (where content comes from)
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum SourceType {
    #[serde(rename = "arxiv")]
    Arxiv,
    #[serde(rename = "rss")]
    Rss,
    #[serde(rename = "twitter_api")]
    TwitterApi,
    #[serde(rename = "manual")]
    Manual,
}

impl SourceType {
    pub fn as_str(&self) -> &'static str {
        match self {
            SourceType::Arxiv => "arxiv",
            SourceType::Rss => "rss",
            SourceType::TwitterApi => "twitter_api",
            SourceType::Manual => "manual",
        }
    }
}

/// Represents the medium/content type
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum Medium {
    #[serde(rename = "paper")]
    Paper,
    #[serde(rename = "newsletter")]
    Newsletter,
    #[serde(rename = "blog")]
    Blog,
    #[serde(rename = "tweet")]
    Tweet,
}

impl Medium {
    pub fn as_str(&self) -> &'static str {
        match self {
            Medium::Paper => "paper",
            Medium::Newsletter => "newsletter",
            Medium::Blog => "blog",
            Medium::Tweet => "tweet",
        }
    }
}

/// Represents a content source (feed, API, etc.)
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Source {
    pub id: i32,
    pub name: String,
    #[sqlx(rename = "type")]
    pub source_type: String, // Stored as 'arxiv', 'rss', etc.
    pub medium: String,      // Stored as 'paper', 'newsletter', etc.
    pub ingest_url: Option<String>,
    pub active: bool,
    pub frequency: Option<String>,
    pub meta: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Source {
    pub fn source_type(&self) -> Option<SourceType> {
        match self.source_type.as_str() {
            "arxiv" => Some(SourceType::Arxiv),
            "rss" => Some(SourceType::Rss),
            "twitter_api" => Some(SourceType::TwitterApi),
            "manual" => Some(SourceType::Manual),
            _ => None,
        }
    }

    pub fn medium(&self) -> Option<Medium> {
        match self.medium.as_str() {
            "paper" => Some(Medium::Paper),
            "newsletter" => Some(Medium::Newsletter),
            "blog" => Some(Medium::Blog),
            "tweet" => Some(Medium::Tweet),
            _ => None,
        }
    }
}

/// Represents a unified content item (paper, newsletter, blog post, tweet, etc.)
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct Item {
    pub id: Uuid,
    pub source_id: i32,
    pub source_type: String, // Mirrored from sources.medium for quick filtering
    pub title: String,
    pub url: String,
    pub summary: Option<String>,
    pub body: Option<String>,
    pub published_at: DateTime<Utc>,
    pub raw_metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

impl Item {
    pub fn source_type_enum(&self) -> Option<Medium> {
        match self.source_type.as_str() {
            "paper" => Some(Medium::Paper),
            "newsletter" => Some(Medium::Newsletter),
            "blog" => Some(Medium::Blog),
            "tweet" => Some(Medium::Tweet),
            _ => None,
        }
    }
}

/// Represents a topic tag for an item
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ItemTopic {
    pub id: i32,
    pub item_id: Uuid,
    pub topic: String,
    pub created_at: DateTime<Utc>,
}

/// Represents a user's feedback/rating on an item
#[derive(Debug, Clone, FromRow, Serialize, Deserialize)]
pub struct ItemLike {
    pub id: i32,
    pub user_id: String,
    pub item_id: Uuid,
    pub score: i32, // -1, 0, or 1
    pub created_at: DateTime<Utc>,
}
