// web/src/lib/sources.ts
import type { InferSelectModel } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm';
import { getDb, getPGlite } from './db';
import { sources } from './schema';

export type Source = InferSelectModel<typeof sources>;

/**
 * Get all active sources
 */
export async function getActiveSources(): Promise<Source[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(sources)
      .where(eq(sources.active, true))
      .orderBy(desc(sources.createdAt));
    return rows;
  } catch (err) {
    console.warn('Failed to get active sources:', err);
    return [];
  }
}

/**
 * Get all sources
 */
export async function getAllSources(): Promise<Source[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(sources)
      .orderBy(desc(sources.createdAt));
    return rows;
  } catch (err) {
    console.warn('Failed to get sources:', err);
    return [];
  }
}

/**
 * Get sources by type
 */
export async function getSourcesByType(type: string): Promise<Source[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(sources)
      .where(eq(sources.type, type))
      .orderBy(desc(sources.createdAt));
    return rows;
  } catch (err) {
    console.warn(`Failed to get sources by type ${type}:`, err);
    return [];
  }
}

/**
 * Get sources by medium
 */
export async function getSourcesByMedium(medium: string): Promise<Source[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(sources)
      .where(eq(sources.medium, medium))
      .orderBy(desc(sources.createdAt));
    return rows;
  } catch (err) {
    console.warn(`Failed to get sources by medium ${medium}:`, err);
    return [];
  }
}

/**
 * Toggle source active status
 */
export async function toggleSourceActive(sourceId: number, active: boolean) {
  try {
    const db = await getDb();
    await db
      .update(sources)
      .set({ active, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));
  } catch (err) {
    console.error('Failed to toggle source active:', err);
    throw err;
  }
}

/**
 * Update source URL and frequency
 */
export async function updateSource(
  sourceId: number,
  updates: Partial<{
    name: string;
    type: string;
    medium: string;
    ingestUrl: string | null | undefined;
    active: boolean;
    frequency: string | null | undefined;
    meta: any;
  }>
) {
  try {
    const db = await getDb();
    await db
      .update(sources)
      .set({ ...updates, updatedAt: new Date() } as any)
      .where(eq(sources.id, sourceId));
  } catch (err) {
    console.error('Failed to update source:', err);
    throw err;
  }
}

/**
 * Delete a source by id
 */
export async function deleteSource(sourceId: number) {
  try {
    const db = await getDb();
    await db.delete(sources).where(eq(sources.id, sourceId));
  } catch (err) {
    console.error('Failed to delete source:', err);
    throw err;
  }
}

/**
 * Create a new source
 */
export async function createSource(
  source: Omit<Source, 'id' | 'createdAt' | 'updatedAt'>
) {
  try {
    // Use raw upsert SQL against the local PGlite instance to avoid
    // primary-key sequence conflicts when inserting.
    const pg = await getPGlite();
    const now = new Date().toISOString();
    await pg.exec(
      `INSERT INTO sources (name, type, medium, ingest_url, active, frequency, meta, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)
       ON CONFLICT (name, type) DO UPDATE SET
         medium = EXCLUDED.medium,
         ingest_url = EXCLUDED.ingest_url,
         active = EXCLUDED.active,
         frequency = EXCLUDED.frequency,
         meta = EXCLUDED.meta,
         updated_at = EXCLUDED.updated_at;`,
      [
        source.name,
        source.type,
        source.medium,
        source.ingestUrl ?? null,
        source.active ?? true,
        source.frequency ?? null,
        JSON.stringify(source.meta ?? {}),
        now,
        now,
      ],
    );
  } catch (err) {
    console.error('Failed to create source:', err);
    throw err;
  }
}

/**
 * Get source name by ID from the store (cached)
 * Returns a promise that resolves with the source name or 'Unknown' if not found
 */
let sourcesCache: Map<number, string> | null = null;

export async function getSourceNameById(sourceId: number): Promise<string> {
  // If cache doesn't exist, build it from the database
  if (!sourcesCache) {
    sourcesCache = new Map();
    const db = await getDb();
    const allSources = await db.select().from(sources);
    allSources.forEach(source => {
      sourcesCache!.set(source.id, source.name);
    });
  }

  return sourcesCache.get(sourceId) || 'Unknown';
}
