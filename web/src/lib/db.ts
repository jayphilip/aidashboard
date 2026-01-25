// web/src/lib/db.ts
import { PGlite } from '@electric-sql/pglite';
import { electricSync } from '@electric-sql/pglite-sync';
import { drizzle } from 'drizzle-orm/pglite';
import { papers } from '$lib/schema';

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

      // Ensure local table exists (schema matches server `papers`)
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
      `);

      return drizzle(pg, { schema: { papers } });
    })();
  }
  return dbPromise;
}
