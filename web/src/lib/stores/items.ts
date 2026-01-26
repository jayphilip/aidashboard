// web/src/lib/stores/items.ts
import { writable, type Readable } from 'svelte/store';
import type { InferSelectModel } from 'drizzle-orm';
import { desc, eq, gte, sql } from 'drizzle-orm';
import { getPGlite, getDb } from '$lib/db';
import { items, itemTopics, itemLikes, sources } from '$lib/schema';
import { getCachedElectricUrl, getCachedElectricSecret } from '$lib/config';

export type Item = InferSelectModel<typeof items>;
export type Source = InferSelectModel<typeof sources>;
export type ItemTopic = InferSelectModel<typeof itemTopics>;
export type ItemLike = InferSelectModel<typeof itemLikes>;

type ItemsState = {
  loading: boolean;
  error: string | null;
};

const itemsStore = writable<Item[]>([]);
const stateStore = writable<ItemsState>({ loading: false, error: null });

export const items$: Readable<Item[]> = { subscribe: itemsStore.subscribe };
export const itemsState: Readable<ItemsState> = { subscribe: stateStore.subscribe };

let shapeSubscriptions: { [key: string]: { unsubscribe: () => void } } = {};

async function refreshItemsFromDb() {
  try {
    const db = await getDb();

    const rows = await db
      .select()
      .from(items)
      .orderBy(desc(items.publishedAt)); // newest first

    itemsStore.set(rows);
  } catch (err) {
    console.warn('Failed to refresh items from db:', err);
    itemsStore.set([]);
  }
}

/**
 * Get items by source type (paper, newsletter, blog, tweet)
 */
export async function getItemsBySourceType(sourceType: string): Promise<Item[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(items)
      .where(eq(items.sourceType, sourceType))
      .orderBy(desc(items.publishedAt));
    return rows;
  } catch (err) {
    console.warn(`Failed to get items by source type ${sourceType}:`, err);
    return [];
  }
}

/**
 * Get items from the last N hours
 */
export async function getRecentItems(hours: number = 24): Promise<Item[]> {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(items)
      .where(gte(items.publishedAt, cutoff))
      .orderBy(desc(items.publishedAt));
    return rows;
  } catch (err) {
    console.warn('Failed to get recent items, returning empty array:', err);
    return [];
  }
}

/**
 * Get items with topics by filtering through item_topics
 */
export async function getItemsWithTopics(topics: string[]): Promise<Item[]> {
  const db = await getDb();

  const rows = await db
    .select({ item: items })
    .from(items)
    .innerJoin(itemTopics, eq(items.id, itemTopics.itemId))
    .where(sql`${itemTopics.topic} = ANY(${topics})`)
    .groupBy(items.id)
    .orderBy(desc(items.publishedAt));

  return rows.map(r => r.item);
}

/**
 * Hydrate PGlite from Electric and expose data via Svelte store.
 */
export async function initializeItemsSync() {
  if (shapeSubscriptions['items']) return; // already started

  stateStore.set({ loading: true, error: null });

  try {
    const pg = await getPGlite();

    // Use the SvelteKit proxy endpoint instead of connecting directly to Electric
    // This avoids CORS issues and keeps the secret server-side
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const proxyUrl = `${baseUrl}/api/electric/shape`;

    console.log('[ItemsSync] Starting sync with proxy:', proxyUrl);

    const shapes = await Promise.all([
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: proxyUrl,
          params: {
            table: 'items',
          },
        },
        table: 'items',
        primaryKey: ['id'],
        shapeKey: 'items',
        onError: (error: unknown) => {
          console.error('[ItemsSync] items shape sync error:', error);
          if (error instanceof Error) {
            console.error('[ItemsSync] Error stack:', error.stack);
          }
          stateStore.set({
            loading: false,
            error: (error as Error).message ?? String(error),
          });
        },
        onInitialSync: () => {
          console.log('[ItemsSync] Items initial sync complete');
        },
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: proxyUrl,
          params: {
            table: 'sources',
          },
        },
        table: 'sources',
        primaryKey: ['id'],
        shapeKey: 'sources',
        onError: (error: unknown) => {
          console.error('[ItemsSync] sources shape sync error:', error);
        },
        onInitialSync: () => {
          console.log('[ItemsSync] Sources initial sync complete');
        },
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: proxyUrl,
          params: {
            table: 'item_topics',
          },
        },
        table: 'item_topics',
        primaryKey: ['id'],
        shapeKey: 'item_topics',
        onError: (error: unknown) => {
          console.error('[ItemsSync] item_topics shape sync error:', error);
        },
        onInitialSync: () => {
          console.log('[ItemsSync] Item topics initial sync complete');
        },
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: proxyUrl,
          params: {
            table: 'item_likes',
          },
        },
        table: 'item_likes',
        primaryKey: ['id'],
        shapeKey: 'item_likes',
        onError: (error: unknown) => {
          console.error('[ItemsSync] item_likes shape sync error:', error);
        },
        onInitialSync: () => {
          console.log('[ItemsSync] Item likes initial sync complete');
        },
      }),
    ]);

    shapeSubscriptions['items'] = shapes[0];
    shapeSubscriptions['sources'] = shapes[1];
    shapeSubscriptions['item_topics'] = shapes[2];
    shapeSubscriptions['item_likes'] = shapes[3];

    console.log('[ItemsSync] Shapes subscribed successfully');

    // Poll for data to arrive from Electric sync
    const pollForData = async () => {
      let attempts = 0;
      const maxAttempts = 15; // 15 attempts * 500ms = 7.5 seconds

      while (attempts < maxAttempts) {
        try {
          const countResult = await pg.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM items;'
          );
          const count = countResult.rows[0]?.count ?? 0;
          console.log('[ItemsSync] PGlite items count:', count, `(attempt ${attempts + 1}/${maxAttempts})`);

          if (count > 0) {
            // Debug: Check published_at dates
            const dateCheckResult = await pg.query(
              'SELECT MIN(published_at) as oldest, MAX(published_at) as newest, COUNT(*) as total FROM items;'
            );
            console.log('[ItemsSync] Date range:', dateCheckResult.rows[0]);

            await refreshItemsFromDb();
            stateStore.set({ loading: false, error: null });
            return;
          }

          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        } catch (err) {
          console.warn('[ItemsSync] Error querying items (attempt', attempts + 1, '):', err);
          attempts++;
          if (attempts < maxAttempts) {
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }

      console.warn('[ItemsSync] Timeout waiting for data after 7.5 seconds');
      await refreshItemsFromDb();
      stateStore.set({ loading: false, error: null });
    };

    // Start polling after initial sync has time to begin
    setTimeout(pollForData, 1000);
  } catch (err) {
    console.error('initializeItemsSync failed', err);
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}

export function cleanupItemsSync() {
  Object.values(shapeSubscriptions).forEach(sub => sub?.unsubscribe());
  shapeSubscriptions = {};
}
