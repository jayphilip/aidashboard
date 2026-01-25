-- Migration to seed RSS-based sources for Phase 3
-- This migration adds all newsletter and blog sources from the curated rss.json list

-- One Useful Thing (Ethan Mollick)
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'One Useful Thing',
    'rss',
    'newsletter',
    'https://www.oneusefulthing.org/feed',
    true,
    'daily',
    '{"category": "analysis_application", "signal_score": 0.98, "notes": "Practical, evidence-based analysis of how AI reshapes work and education."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Simon Willison's Weblog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Simon Willison''s Weblog',
    'rss',
    'blog',
    'https://simonwillison.net/atom/entries/',
    true,
    'hourly',
    '{"category": "engineering_applied", "signal_score": 0.98, "notes": "Essential for AI engineers. Focuses on practical LLM usage, security, and hacking."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Ahead of AI (Sebastian Raschka)
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Ahead of AI',
    'rss',
    'newsletter',
    'https://magazine.sebastianraschka.com/feed',
    true,
    'daily',
    '{"category": "education_technical", "signal_score": 0.95, "notes": "Bridges research papers and code. Excellent for understanding new architectures."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Interconnects (Nathan Lambert)
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Interconnects',
    'rss',
    'newsletter',
    'https://www.interconnects.ai/feed',
    true,
    'daily',
    '{"category": "analysis_technical", "signal_score": 0.92, "notes": "Deep analysis of the open-source model ecosystem, RLHF, and technical policy."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Chip Huyen
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Chip Huyen',
    'rss',
    'blog',
    'https://huyenchip.com/feed.xml',
    true,
    'hourly',
    '{"category": "engineering_systems", "signal_score": 0.95, "notes": "Focuses on ''Real World AI''—data infra, MLOps, and production challenges."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Marcus on AI (Gary Marcus)
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Marcus on AI',
    'rss',
    'newsletter',
    'https://garymarcus.substack.com/feed',
    true,
    'daily',
    '{"category": "analysis_critical", "signal_score": 0.9, "notes": "Critical skepticism and realistic assessment of AI hype and limitations."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Benedict Evans
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Benedict Evans',
    'rss',
    'newsletter',
    'https://www.ben-evans.com/benedictevans?format=rss',
    true,
    'daily',
    '{"category": "analysis_strategy", "signal_score": 0.9, "notes": "Strategic big-picture view. Treats AI as a platform shift."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- TLDR AI
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'TLDR AI',
    'rss',
    'newsletter',
    'https://tldr.tech/ai/feed',
    true,
    'daily',
    '{"category": "news_technical", "signal_score": 0.9, "notes": "Summaries of AI/ML news, tools, and papers for practitioners."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- OpenAI Blog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'OpenAI Blog',
    'rss',
    'blog',
    'https://openai.com/news/rss.xml',
    true,
    'hourly',
    '{"category": "research_industry", "signal_score": 0.98, "notes": "Primary source for GPT/DALL-E releases and safety research."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Google DeepMind Blog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Google DeepMind Blog',
    'rss',
    'blog',
    'https://deepmind.google/blog/rss.xml',
    true,
    'hourly',
    '{"category": "research_industry", "signal_score": 0.95, "notes": "Research and product updates from Google DeepMind (Gemini, AlphaFold)."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Microsoft AI Blog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Microsoft AI Blog',
    'rss',
    'blog',
    'https://blogs.microsoft.com/ai/feed/',
    true,
    'hourly',
    '{"category": "research_industry", "signal_score": 0.9, "notes": "Updates on Azure AI, Copilot, and foundational research from MS."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Hugging Face Blog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Hugging Face Blog',
    'rss',
    'blog',
    'https://huggingface.co/blog/feed.xml',
    true,
    'hourly',
    '{"category": "technical_community", "signal_score": 0.95, "notes": "Deep dives into open-source models, datasets, and implementation guides."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- NVIDIA AI Blog
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'NVIDIA AI Blog',
    'rss',
    'blog',
    'https://nvidianews.nvidia.com/rss',
    true,
    'hourly',
    '{"category": "engineering_hardware", "signal_score": 0.9, "notes": "Focus on hardware acceleration, enterprise AI, and compute infrastructure."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Import AI
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Import AI',
    'rss',
    'newsletter',
    'https://importai.substack.com/feed',
    true,
    'daily',
    '{"category": "policy_safety", "signal_score": 0.9, "notes": "Jack Clark''s newsletter focusing on AI policy, safety, and capabilities."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Machine Learning Mastery
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Machine Learning Mastery',
    'rss',
    'blog',
    'https://machinelearningmastery.com/feed/',
    true,
    'hourly',
    '{"category": "applied_ml", "signal_score": 0.85, "notes": "Tutorials and how-to guides for applied machine learning."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Uber Engineering
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Uber Engineering',
    'rss',
    'blog',
    'https://eng.uber.com/feed/',
    false,
    'hourly',
    '{"category": "engineering_infra", "signal_score": 0.8, "notes": "Engineering and applied ML posts from Uber (Michelangelo, Horovod)."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- CFA Institute: Enterprising Investor (AI)
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'CFA Institute: Enterprising Investor',
    'rss',
    'blog',
    'https://blogs.cfainstitute.org/investor/category/artificial-intelligence/feed/',
    true,
    'daily',
    '{"category": "finance_professional", "signal_score": 0.92, "notes": "High-quality analysis on how AI impacts investment management and ethics."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Two Sigma Insights
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Two Sigma Insights',
    'rss',
    'blog',
    'https://www.twosigma.com/feed/',
    true,
    'hourly',
    '{"category": "finance_quant", "signal_score": 0.95, "notes": "Technical deep dives from a leading quant fund on data science in finance."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Bloomberg Technology
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'Bloomberg Technology',
    'rss',
    'blog',
    'https://feeds.bloomberg.com/technology/news.rss',
    false,
    'hourly',
    '{"category": "news_finance_tech", "signal_score": 0.9, "notes": "Intersection of markets and tech; tracking AI impact on stock prices."}'::jsonb
) ON CONFLICT (name, type) DO NOTHING;

-- Log the result
SELECT format('RSS sources migration: %s sources seeded', count(*))::text as message FROM sources WHERE type = 'rss';
