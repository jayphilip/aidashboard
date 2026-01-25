/// Simple keyword-based topic extraction for AI-related content
/// Topics are detected based on title and summary text

pub fn extract_topics(title: &str, summary: Option<&str>) -> Vec<String> {
    let combined = format!(
        "{} {}",
        title,
        summary.unwrap_or(""),

    );
    let text_lower = combined.to_lowercase();

    let mut topics = Vec::new();

    // LLM / Language Models
    if contains_any_keyword(
        &text_lower,
        &[
            "llm",
            "large language model",
            "gpt",
            "transformer",
            "bert",
            "t5",
            "llama",
            "claude",
            "chatgpt",
            "prompt engineering",
        ],
    ) {
        topics.push("LLM".to_string());
    }

    // Reinforcement Learning
    if contains_any_keyword(
        &text_lower,
        &[
            "reinforcement learning",
            "rl",
            "rlhf",
            "reward model",
            "policy gradient",
            "q-learning",
            "dpo",
        ],
    ) {
        topics.push("RL".to_string());
    }

    // Multimodal / Vision
    if contains_any_keyword(
        &text_lower,
        &[
            "multimodal",
            "vision",
            "image",
            "video",
            "dall-e",
            "clip",
            "visual",
            "ocr",
            "object detection",
        ],
    ) {
        topics.push("Multimodal".to_string());
    }

    // Systems / Infrastructure / MLOps
    if contains_any_keyword(
        &text_lower,
        &[
            "infrastructure",
            "mlops",
            "systems",
            "deployment",
            "production",
            "scalability",
            "distributed",
            "gpu",
            "vram",
            "quantization",
            "inference",
            "serving",
        ],
    ) {
        topics.push("Systems".to_string());
    }

    // Alignment / Safety / Ethics
    if contains_any_keyword(
        &text_lower,
        &[
            "alignment",
            "safety",
            "ethics",
            "fairness",
            "bias",
            "hallucination",
            "interpretability",
            "explainability",
            "responsible ai",
            "agi",
        ],
    ) {
        topics.push("Alignment".to_string());
    }

    // Agents / Autonomous Systems
    if contains_any_keyword(
        &text_lower,
        &[
            "agent",
            "autonomous",
            "robotics",
            "automation",
            "action planning",
            "tool use",
            "function calling",
        ],
    ) {
        topics.push("Agents".to_string());
    }

    // Finance / Markets
    if contains_any_keyword(
        &text_lower,
        &[
            "finance",
            "trading",
            "market",
            "stock",
            "portfolio",
            "investment",
            "risk",
            "quant",
            "algorithmic",
        ],
    ) {
        topics.push("Finance".to_string());
    }

    // Open Source / Community
    if contains_any_keyword(
        &text_lower,
        &[
            "open source",
            "hugging face",
            "pytorch",
            "tensorflow",
            "community",
            "huggingface",
        ],
    ) {
        topics.push("Open Source".to_string());
    }

    // Search / Retrieval / Knowledge
    if contains_any_keyword(
        &text_lower,
        &[
            "retrieval",
            "rag",
            "search",
            "knowledge base",
            "vector database",
            "embedding",
            "semantic search",
        ],
    ) {
        topics.push("Search".to_string());
    }

    // Data / Datasets
    if contains_any_keyword(
        &text_lower,
        &[
            "dataset",
            "data",
            "annotation",
            "labeling",
            "synthetic data",
            "pretraining",
        ],
    ) {
        topics.push("Data".to_string());
    }

    // Optimization / Training
    if contains_any_keyword(
        &text_lower,
        &[
            "optimization",
            "training",
            "fine-tuning",
            "finetuning",
            "learning rate",
            "gradient",
            "loss",
        ],
    ) {
        topics.push("Optimization".to_string());
    }

    // Applications / Use Cases
    if contains_any_keyword(
        &text_lower,
        &[
            "application",
            "use case",
            "product",
            "tool",
            "plugin",
            "extension",
            "integration",
        ],
    ) {
        topics.push("Applications".to_string());
    }

    topics
}

/// Check if any of the keywords are contained in the text
fn contains_any_keyword(text: &str, keywords: &[&str]) -> bool {
    keywords.iter().any(|keyword| {
        // Match whole words or word boundaries
        text.contains(keyword)
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_llm_topics() {
        let topics = extract_topics("GPT-4 Large Language Models", Some("A new LLM model"));
        assert!(topics.contains(&"LLM".to_string()));
    }

    #[test]
    fn test_extract_multimodal() {
        let topics = extract_topics("DALL-E: Multimodal Image Generation", Some("Vision and text"));
        assert!(topics.contains(&"Multimodal".to_string()));
    }

    #[test]
    fn test_extract_multiple_topics() {
        let topics = extract_topics(
            "Fine-tuning a RLHF model with GPT",
            Some("Reinforcement learning and LLM training"),
        );
        assert!(topics.contains(&"LLM".to_string()));
        assert!(topics.contains(&"RL".to_string()));
    }

    #[test]
    fn test_extract_no_topics() {
        let topics = extract_topics("Random article about cooking", None);
        assert!(topics.is_empty());
    }
}
