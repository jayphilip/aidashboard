// web/src/lib/stores/sources.ts
import { writable, type Readable } from 'svelte/store';
import type { InferSelectModel } from 'drizzle-orm';
import { desc, eq } from 'drizzle-orm';
import { getDb } from '$lib/db';
import { sources } from '$lib/schema';

export type Source = InferSelectModel<typeof sources>;

type SourcesState = {
  loading: boolean;
  error: string | null;
};

const sourcesStore = writable<Source[]>([]);
const stateStore = writable<SourcesState>({ loading: false, error: null });

export const sources$: Readable<Source[]> = { subscribe: sourcesStore.subscribe };
export const sourcesState: Readable<SourcesState> = { subscribe: stateStore.subscribe };

export async function refreshSourcesFromDb() {
  try {
    const db = await getDb();

    const rows = await db
      .select()
      .from(sources)
      .orderBy(desc(sources.createdAt));

    sourcesStore.set(rows);
  } catch (err) {
    console.warn('Failed to refresh sources from db:', err);
    sourcesStore.set([]);
  }
}

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
    await refreshSourcesFromDb();
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
  updates: { ingestUrl?: string; frequency?: string; meta?: any }
) {
  try {
    const db = await getDb();
    await db
      .update(sources)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(sources.id, sourceId));
    await refreshSourcesFromDb();
  } catch (err) {
    console.error('Failed to update source:', err);
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
    const db = await getDb();
    await db.insert(sources).values({
      ...source,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any);
    await refreshSourcesFromDb();
  } catch (err) {
    console.error('Failed to create source:', err);
    throw err;
  }
}

export async function initializeSourcesFromDb() {
  try {
    stateStore.set({ loading: true, error: null });
    await refreshSourcesFromDb();
    stateStore.set({ loading: false, error: null });
  } catch (err) {
    console.error('initializeSourcesFromDb failed', err);
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}
