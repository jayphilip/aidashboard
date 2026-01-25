-- Create the papers table
CREATE TABLE IF NOT EXISTS papers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source TEXT NOT NULL,
    external_id TEXT NOT NULL,
    title TEXT NOT NULL,
    authors TEXT[] DEFAULT '{}',
    abstract TEXT,
    categories TEXT[] DEFAULT '{}',
    published_at TIMESTAMPTZ NOT NULL,
    url TEXT,
    pdf_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(source, external_id)
);

-- Create indexes for common queries (if not exists)
CREATE INDEX IF NOT EXISTS idx_papers_source ON papers(source);
CREATE INDEX IF NOT EXISTS idx_papers_published_at ON papers(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_papers_external_id ON papers(external_id);
