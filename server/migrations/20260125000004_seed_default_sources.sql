-- Migration to seed default sources for Phase 2 testing
-- This file can be run manually or added as a migration

-- Only insert if the arxiv-qfin source doesn't already exist
INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta)
VALUES (
    'arxiv-qfin',
    'arxiv',
    'paper',
    'http://export.arxiv.org/api/query',
    true,
    'hourly',
    '{"query": "cat:q-fin.GN", "description": "arXiv Finance papers - Quantitative Finance category"}'::jsonb
)
ON CONFLICT (name, type) DO UPDATE
SET active = true, meta = '{"query": "cat:q-fin.GN", "description": "arXiv Finance papers - Quantitative Finance category"}'::jsonb;

-- Log the result
SELECT 'Default arxiv-qfin source seeded' as message;
