-- Create the sources table
CREATE TABLE IF NOT EXISTS sources (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('arxiv', 'rss', 'twitter_api', 'manual')),
    medium TEXT NOT NULL CHECK (medium IN ('paper', 'newsletter', 'blog', 'tweet')),
    ingest_url TEXT,
    active BOOLEAN DEFAULT true,
    frequency TEXT,
    meta JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(name, type)
);

-- Create indexes for sources (if not exists)
CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(active);
CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
CREATE INDEX IF NOT EXISTS idx_sources_medium ON sources(medium);

-- Create the items table (unified content model)
CREATE TABLE IF NOT EXISTS items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id INTEGER NOT NULL REFERENCES sources(id),
    source_type TEXT NOT NULL CHECK (source_type IN ('paper', 'newsletter', 'blog', 'tweet')),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    summary TEXT,
    body TEXT,
    published_at TIMESTAMPTZ NOT NULL,
    raw_metadata JSONB DEFAULT '{}'::JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for items (if not exists)
CREATE INDEX IF NOT EXISTS idx_items_source_id ON items(source_id);
CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_source_type ON items(source_type);
CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);
CREATE UNIQUE INDEX IF NOT EXISTS idx_items_dedup ON items(source_id, url);

-- Create item_topics table
CREATE TABLE IF NOT EXISTS item_topics (
    id SERIAL PRIMARY KEY,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    topic TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for item_topics (if not exists)
CREATE INDEX IF NOT EXISTS idx_item_topics_item_id ON item_topics(item_id);
CREATE INDEX IF NOT EXISTS idx_item_topics_topic ON item_topics(topic);
CREATE INDEX IF NOT EXISTS idx_item_topics_topic_item ON item_topics(topic, item_id);

-- Create item_likes table
CREATE TABLE IF NOT EXISTS item_likes (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    item_id UUID NOT NULL REFERENCES items(id) ON DELETE CASCADE,
    score INTEGER CHECK (score IN (-1, 0, 1)),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(user_id, item_id)
);

-- Create indexes for item_likes (if not exists)
CREATE INDEX IF NOT EXISTS idx_item_likes_user_id ON item_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_item_likes_item_id ON item_likes(item_id);
CREATE INDEX IF NOT EXISTS idx_item_likes_user_item ON item_likes(user_id, item_id);
