// web/src/lib/db.ts
import { PGlite } from '@electric-sql/pglite';
import { drizzle } from 'drizzle-orm/pglite';
import { papers, sources, items, itemTopics, itemLikes, itemReads, userPreferences, collections, collectionItems } from './schema';

// Schema version - increment when schema changes to force client DB reset
const SCHEMA_VERSION = 4;

// Singleton-style promises so we only initialise once per tab
let pglitePromise: Promise<PGlite> | null = null;
let dbPromise: Promise<ReturnType<typeof drizzle>> | null = null;
let isInitializing = false;

async function checkSchemaVersion(): Promise<boolean> {
  const storedVersion = localStorage.getItem('aidashboard_schema_version');
  const currentVersion = SCHEMA_VERSION.toString();
  
  if (storedVersion !== currentVersion) {
    console.log(`[DB] Schema version mismatch (stored: ${storedVersion}, current: ${currentVersion}). Clearing database...`);
    
    // Clear IndexedDB
    try {
      const dbs = await indexedDB.databases();
      for (const db of dbs) {
        if (db.name && db.name.includes('aidashboard')) {
          indexedDB.deleteDatabase(db.name);
          console.log(`[DB] Deleted database: ${db.name}`);
        }
      }
    } catch (err) {
      console.warn('[DB] Failed to clear IndexedDB:', err);
    }
    
    // Update version
    localStorage.setItem('aidashboard_schema_version', currentVersion);
    return true; // Database was cleared
  }
  
  return false; // No changes needed
}

export async function getPGlite() {
  if (pglitePromise) {
    return pglitePromise;
  }

  // Wait if another call is already initializing
  if (isInitializing) {
    await new Promise(resolve => setTimeout(resolve, 100));
    return getPGlite(); // Retry after waiting
  }

  isInitializing = true;

  try {
    // Check and clear if needed before creating new instance
    await checkSchemaVersion();

    pglitePromise = PGlite.create({
      dataDir: 'idb://aidashboard',
      // No extensions needed - we'll use ShapeStream directly in ItemsContext
    }).catch(err => {
      console.error('[DB] Failed to create PGlite:', err);
      // Reset on error so it can be retried
      pglitePromise = null;
      throw err;
    });

    return pglitePromise;
  } finally {
    isInitializing = false;
  }
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
        ALTER TABLE IF EXISTS item_reads DROP CONSTRAINT IF EXISTS item_reads_item_id_fkey;
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
          source_id INTEGER,
          source_type TEXT NOT NULL CHECK (source_type IN ('paper', 'newsletter', 'blog', 'tweet')),
          title TEXT NOT NULL,
          url TEXT NOT NULL,
          summary TEXT,
          body TEXT,
          published_at TIMESTAMPTZ NOT NULL,
          raw_metadata JSONB DEFAULT '{}'::JSONB,
          topics TEXT[] DEFAULT '{}',
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

        CREATE TABLE IF NOT EXISTS item_reads (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          item_id UUID NOT NULL,
          read_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(user_id, item_id)
        );

        CREATE TABLE IF NOT EXISTS user_preferences (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL UNIQUE,
          filter_preferences JSONB DEFAULT '{}'::JSONB,
          ui_preferences JSONB DEFAULT '{}'::JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS collections (
          id SERIAL PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS collection_items (
          id SERIAL PRIMARY KEY,
          collection_id INTEGER NOT NULL,
          item_id UUID NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE(collection_id, item_id)
        );

        CREATE INDEX IF NOT EXISTS idx_sources_active ON sources(active);
        CREATE INDEX IF NOT EXISTS idx_sources_type ON sources(type);
        CREATE INDEX IF NOT EXISTS idx_sources_medium ON sources(medium);
        CREATE INDEX IF NOT EXISTS idx_items_source_id ON items(source_id);
        CREATE INDEX IF NOT EXISTS idx_items_published_at ON items(published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_source_type ON items(source_type);
        CREATE INDEX IF NOT EXISTS idx_items_url ON items(url);
        CREATE INDEX IF NOT EXISTS idx_items_topics_gin ON items USING GIN(topics);
        CREATE INDEX IF NOT EXISTS idx_item_topics_item_id ON item_topics(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_topics_topic ON item_topics(topic);
        CREATE INDEX IF NOT EXISTS idx_item_likes_user_id ON item_likes(user_id);
        CREATE INDEX IF NOT EXISTS idx_item_likes_item_id ON item_likes(item_id);
        CREATE INDEX IF NOT EXISTS idx_item_reads_user_id ON item_reads(user_id);
        CREATE INDEX IF NOT EXISTS idx_item_reads_item_id ON item_reads(item_id);
        CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);

        -- Compound indexes for common query patterns
        CREATE INDEX IF NOT EXISTS idx_items_source_type_published ON items(source_type, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_items_source_id_published ON items(source_id, published_at DESC);
        CREATE INDEX IF NOT EXISTS idx_item_topics_item_topic ON item_topics(item_id, topic);
        CREATE INDEX IF NOT EXISTS idx_item_likes_user_item ON item_likes(user_id, item_id);
        CREATE INDEX IF NOT EXISTS idx_collections_user_id ON collections(user_id);
        CREATE INDEX IF NOT EXISTS idx_collection_items_collection_id ON collection_items(collection_id);
        CREATE INDEX IF NOT EXISTS idx_collection_items_item_id ON collection_items(item_id);
        CREATE INDEX IF NOT EXISTS idx_collection_items_collection_item ON collection_items(collection_id, item_id);
      `);

      return drizzle(pg, { schema: { papers, sources, items, itemTopics, itemLikes, itemReads, userPreferences, collections, collectionItems } });
    })();
  }
  return dbPromise;
}
