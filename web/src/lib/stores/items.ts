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
    const electricUrl = getCachedElectricUrl();
    const electricSecret = getCachedElectricSecret();

    // Start syncing `items`, `sources`, `item_topics`, `item_likes` shapes into local tables
    const authHeaders = electricSecret ? { Authorization: `Bearer ${electricSecret}` } : {};

    const shapes = await Promise.all([
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: `${electricUrl}/v1/shape`,
          params: {
            table: 'items',
            subset__order_by: 'published_at DESC',
            subset__limit: 500,
          },
          headers: authHeaders,
        },
        table: 'items',
        primaryKey: ['id'],
        shapeKey: 'items',
        onError: (error: unknown) => {
          console.error('items shape sync error', error);
          stateStore.set({
            loading: false,
            error: (error as Error).message ?? String(error),
          });
        },
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: `${electricUrl}/v1/shape`,
          params: {
            table: 'sources',
          },
          headers: authHeaders,
        },
        table: 'sources',
        primaryKey: ['id'],
        shapeKey: 'sources',
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: `${electricUrl}/v1/shape`,
          params: {
            table: 'item_topics',
          },
          headers: authHeaders,
        },
        table: 'item_topics',
        primaryKey: ['id'],
        shapeKey: 'item_topics',
      }),
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: `${electricUrl}/v1/shape`,
          params: {
            table: 'item_likes',
          },
          headers: authHeaders,
        },
        table: 'item_likes',
        primaryKey: ['id'],
        shapeKey: 'item_likes',
      }),
    ]);

    shapeSubscriptions['items'] = shapes[0];
    shapeSubscriptions['sources'] = shapes[1];
    shapeSubscriptions['item_topics'] = shapes[2];
    shapeSubscriptions['item_likes'] = shapes[3];

    // Wait briefly for initial snapshot to apply, then read from PGlite
    setTimeout(async () => {
      try {
        try {
          const countResult = await pg.query<{ count: number }>(
            'SELECT COUNT(*)::int AS count FROM items;'
          );
          console.log('PGlite items count:', countResult.rows[0]?.count);
        } catch (err) {
          console.warn('Could not count items (table may not exist yet):', err);
        }

        await refreshItemsFromDb();
        stateStore.set({ loading: false, error: null });
      } catch (err) {
        console.error('refreshItemsFromDb failed', err);
        // Don't set error state - items table may just be empty or syncing
        stateStore.set({ loading: false, error: null });
      }
    }, 1000);
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
