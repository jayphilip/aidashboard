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
    // Write to server Postgres via API (will sync back via Electric)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Electric will sync the change from server within seconds
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
    // Write to server Postgres via API (will sync back via Electric)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Electric will sync the change from server within seconds
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
    // Write to server Postgres via API (will sync back via Electric)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/sources/${sourceId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }

    // Electric will sync the deletion from server within seconds
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
    // Write to server Postgres via API (will sync back via Electric)
    const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3001';
    const response = await fetch(`${apiUrl}/api/sources`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: source.name,
        type: source.type,
        medium: source.medium,
        ingestUrl: source.ingestUrl ?? null,
        active: source.active ?? true,
        frequency: source.frequency ?? null,
        meta: source.meta ?? {},
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API error: ${response.statusText}`);
    }

    // Note: We don't do optimistic local insert here.
    // Electric will sync the new source from the server within seconds.
    // This avoids parameterized query issues with PGlite.
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
