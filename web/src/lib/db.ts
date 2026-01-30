// web/src/lib/db.ts
import { PGlite } from '@electric-sql/pglite';
import { electricSync } from '@electric-sql/pglite-sync';
import { drizzle } from 'drizzle-orm/pglite';
import { papers, sources, items, itemTopics, itemLikes } from './schema';

// Singleton-style promises so we only initialise once per tab
let pglitePromise: Promise<PGlite> | null = null;
let dbPromise: Promise<ReturnType<typeof drizzle>> | null = null;

export function getPGlite() {
  if (!pglitePromise) {
    pglitePromise = PGlite.create({
      dataDir: 'idb://aidashboard',
      extensions: {
        electric: electricSync(),
      },
    });
  }
  return pglitePromise;
}

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const pg = await getPGlite();

      // Drop foreign key constraints that interfere with parallel sync
      // Electric enforces referential integrity on the server, so we don't need FKs in the browser
      await pg.exec(`
        ALTER TABLE IF EXISTS items DROP CONSTRAINT IF EXISTS items_source_id_fkey;
        ALTER TABLE IF EXISTS item_topics DROP CONSTRAINT IF EXISTS item_topics_item_id_fkey;
        ALTER TABLE IF EXISTS item_likes DROP CONSTRAINT IF EXISTS item_likes_item_id_fkey;
      `).catch(err => {
        console.warn('[DB] Failed to drop FK constraints (may not exist):', err);
      });

      // Ensure local tables exist (schema matches server)
      await pg.exec(`
        CREATE TABLE IF NOT EXISTS papers (
          id uuid PRIMARY KEY,
          source text NOT NULL,
          external_id text NOT NULL,
          title text NOT NULL,
          authors text[] NOT NULL,
          abstract text,
          categories text[] NOT NULL,
          published_at timestamptz NOT NULL,
          url text,
          pdf_url text,
          created_at timestamptz NOT NULL,
          updated_at timestamptz NOT NULL
        );

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
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          source_id INTEGER NOT NULL,
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

        CREATE TABLE IF NOT EXISTS item_topics (
          id SERIAL PRIMARY KEY,
          item_id UUID NOT NULL,
          topic TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS item_likes (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_id UUID NOT NULL,
          score INTEGER CHECK (score IN (-1, 0, 1)),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, item_id)
        );

        CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(active);
        CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
        CREATE INDEX IF NOT EXISTS idx_sources_medium ON sources(medium);
        CREATE INDEX IF NOT EXISTS idx_items_source_id ON items(source_id);
        CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_source_type ON items(source_type);
        CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);
        CREATE INDEX IF NOT EXISTS idx_item_topics_item_id ON item_topics(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_topics_topic ON item_topics(topic);
        CREATE INDEX IF NOT EXISTS idx_item_likes_user_id ON item_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_item_likes_item_id ON item_likes(item_id);

        -- Compound indexes for common query patterns
        CREATE INDEX IF NOT EXISTS idx_items_source_type_published ON items(source_type, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_source_id_published ON items(source_id, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_item_topics_item_topic ON item_topics(item_id, topic);
        CREATE INDEX IF NOT EXISTS idx_item_likes_user_item ON item_likes(user_id, item_id);
      `);

      return drizzle(pg, { schema: { papers, sources, items, itemTopics, itemLikes } });
    })();
  }
  return dbPromise;
}
