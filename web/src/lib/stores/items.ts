// web/src/lib/stores/items.ts
import { writable, type Readable, get } from 'svelte/store';
import type { InferSelectModel } from 'drizzle-orm';
import { desc, eq, gte, lte, sql, inArray, and, isNull } from 'drizzle-orm';
import { getPGlite, getDb } from '$lib/db';
import { items, itemTopics, itemLikes, sources } from '$lib/schema';
import { userId } from './user';
import { logger } from '$lib/utils/logger';

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
let isSyncing = false;
let syncCompleted = false;
let syncCompletionCallbacks: (() => void)[] = [];

async function refreshItemsFromDb() {
  try {
    const db = await getDb();

    const rows = await db
      .select()
      .from(items)
      .orderBy(desc(items.publishedAt)); // newest first

    itemsStore.set(rows);
  } catch (err) {
    logger.warn('Failed to refresh items from db:', err);
    itemsStore.set([]);
  }
}

/**
 * Helper to check if all shapes have completed initial sync
 * and notify waiting callers
 */
let shapesSyncedCount = 0;
const totalShapesToSync = 4; // items, sources, item_topics, item_likes

function tryCompletingSync() {
  shapesSyncedCount++;
  console.log(`[ItemsSync] Shape sync progress: ${shapesSyncedCount}/${totalShapesToSync}`);

  if (shapesSyncedCount === totalShapesToSync) {
    console.log('[ItemsSync] All shapes synced, completing initialization');
    syncCompleted = true;
    refreshItemsFromDb();
    isSyncing = false;
    stateStore.set({ loading: false, error: null });

    // Call any waiting callbacks
    syncCompletionCallbacks.forEach(cb => cb());
    syncCompletionCallbacks = [];
  }
}

/**
 * Wait for initial sync to complete
 * Returns immediately if already synced, otherwise returns a promise
 */
export function waitForSyncCompletion(): Promise<void> {
  if (syncCompleted) {
    return Promise.resolve();
  }

  return new Promise(resolve => {
    syncCompletionCallbacks.push(resolve);
  });
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
    logger.warn(`Failed to get items by source type ${sourceType}:`, err);
    return [];
  }
}

/**
 * Get items from the last N hours with pagination support
 */
export async function getRecentItems(
  hours: number = 24,
  limit: number = 50,
  offset: number = 0
): Promise<Item[]> {
  try {
    const db = await getDb();
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);

    const rows = await db
      .select()
      .from(items)
      .where(gte(items.publishedAt, cutoff))
      .orderBy(desc(items.publishedAt))
      .limit(limit)
      .offset(offset);
    return rows;
  } catch (err) {
    logger.warn('Failed to get recent items, returning empty array:', err);
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
    .where(inArray(itemTopics.topic, topics))
    .groupBy(items.id)
    .orderBy(desc(items.publishedAt));

  return rows.map(r => r.item);
}

/**
 * Search options for flexible item filtering
 */
export interface SearchOptions {
  query?: string;
  sourceTypes?: string[];  // ['paper', 'newsletter', 'blog', 'tweet']
  dateRange?: {
    start?: Date;
    end?: Date;
  };
  topics?: string[];
  sourceIds?: number[];
  likeStatus?: 'liked' | 'disliked' | 'unrated' | null;  // Filter by user's like/dislike status
  limit?: number;
  offset?: number;
  page?: number;  // Page number (1-indexed)
}

/**
 * Search items with full-text search and filtering
 * Searches title, summary, and body fields
 * Supports filtering by source type, date range, topics, and sources
 */
export async function searchItems(options: SearchOptions): Promise<Item[]> {
  const db = await getDb();
  const {
    query,
    sourceTypes,
    dateRange,
    topics,
    sourceIds,
    likeStatus,
    limit = 50,
    offset = 0,
  } = options;

  // Build WHERE conditions
  const conditions: any[] = [];

  // Text search on title, summary, body
  if (query && query.trim()) {
    const searchPattern = `%${query.toLowerCase()}%`;
    conditions.push(
      sql`(
        LOWER(${items.title}) LIKE ${searchPattern}
        OR LOWER(${items.summary}) LIKE ${searchPattern}
        OR LOWER(${items.body}) LIKE ${searchPattern}
      )`
    );
  }

  // Filter by source types
  if (sourceTypes && sourceTypes.length > 0) {
    conditions.push(inArray(items.sourceType, sourceTypes));
  }

  // Filter by date range
  if (dateRange?.start) {
    conditions.push(gte(items.publishedAt, dateRange.start));
  }
  if (dateRange?.end) {
    // Set end date to end of day (23:59:59) to include all items published that day
    const endOfDay = new Date(dateRange.end);
    endOfDay.setHours(23, 59, 59, 999);
    conditions.push(lte(items.publishedAt, endOfDay));
  }

  // Filter by source IDs
  if (sourceIds && sourceIds.length > 0) {
    conditions.push(inArray(items.sourceId, sourceIds));
  }

  // Get current user ID for like filtering
  const currentUserId = get(userId);

  // Filter by topics and/or likes (may require joins)
  let rows: Item[] = [];
  const needsTopicJoin = topics && topics.length > 0;
  const needsLikeJoin = likeStatus !== null && likeStatus !== undefined;

  if (needsTopicJoin || needsLikeJoin) {
    let qb: any = db.select({ item: items });

    if (needsTopicJoin) {
      qb = qb.from(items).innerJoin(itemTopics, eq(items.id, itemTopics.itemId));
    } else if (needsLikeJoin) {
      // Left join for likes so we can filter by missing entries
      qb = qb.from(items).leftJoin(itemLikes, and(eq(items.id, itemLikes.itemId), eq(itemLikes.userId, currentUserId)));
    } else {
      qb = qb.from(items);
    }

    // Build filter conditions
    let allConditions = [...conditions];

    // Add topic condition if needed
    if (needsTopicJoin) {
      allConditions.push(inArray(itemTopics.topic, topics!));
    }

    // Add like status condition if needed
    if (needsLikeJoin) {
      if (likeStatus === 'liked') {
        allConditions.push(eq(itemLikes.score, 1));
      } else if (likeStatus === 'disliked') {
        allConditions.push(eq(itemLikes.score, -1));
      } else if (likeStatus === 'unrated') {
        // For unrated items, check if the join resulted in NULL (no like entry for this user)
        allConditions.push(isNull(itemLikes.id));
      }
    }

    // Apply conditions
    if (allConditions.length > 0) {
      qb = qb.where(and(...allConditions));
    }

    // Group and sort
    qb = qb.groupBy(items.id).orderBy(desc(items.publishedAt));
    const results = await qb;
    rows = results.map((r: any) => r.item);
  } else {
    // No topic or like filter, use regular query
    let qb: any = db.select().from(items);

    // Apply all conditions with a single where() using and()
    if (conditions.length > 0) {
      qb = qb.where(and(...conditions));
    }

    // Add sort
    qb = qb.orderBy(desc(items.publishedAt));

    rows = await qb;
  }

  // Sort: exact title match first, then by recency
  rows.sort((a, b) => {
    if (query) {
      const queryLower = query.toLowerCase();
      const aExact = a.title.toLowerCase() === queryLower ? 0 : 1;
      const bExact = b.title.toLowerCase() === queryLower ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
    }
    return b.publishedAt.getTime() - a.publishedAt.getTime();
  });

  const result = rows.slice(offset, offset + limit);

  // Apply pagination
  return result;
}

/**
 * Get all unique topics from items
 */
export async function getAllTopics(): Promise<string[]> {
  try {
    const db = await getDb();
    const results = await db
      .select({ topic: itemTopics.topic })
      .from(itemTopics)
      .groupBy(itemTopics.topic)
      .orderBy(itemTopics.topic);

    return results.map(r => r.topic);
  } catch (err) {
    logger.warn('Failed to get topics:', err);
    return [];
  }
}

/**
 * Hydrate PGlite from Electric and expose data via Svelte store.
 */
export async function initializeItemsSync() {
  if (isSyncing) return; // already syncing
  if (shapeSubscriptions['items']) return; // already started

  isSyncing = true;
  stateStore.set({ loading: true, error: null });

  try {
    const t0 = performance.now();
    console.log('[ItemsSync] Initializing sync...');

    const t1 = performance.now();
    const pg = await getPGlite();
    console.log(`[ItemsSync] PGlite initialized in ${(performance.now() - t1).toFixed(0)}ms (total: ${(performance.now() - t0).toFixed(0)}ms)`);

    // Use the SvelteKit proxy endpoint instead of connecting directly to Electric
    // This avoids CORS issues and keeps the secret server-side
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5173';
    const proxyUrl = `${baseUrl}/api/electric/shape`;

    const t2 = performance.now();
    console.log(`[ItemsSync] Starting sync with proxy: ${proxyUrl} (elapsed: ${(t2 - t0).toFixed(0)}ms)`);

    // Calculate 7-day cutoff for shape filtering
    // Round to start of day (midnight UTC) for consistency across page loads
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    sevenDaysAgo.setUTCHours(0, 0, 0, 0);
    const cutoffIso = sevenDaysAgo.toISOString();

    const itemTopicsTimeout = setTimeout(() => {
      console.warn('[ItemsSync] Item topics sync timeout (3s), marking as complete');
      tryCompletingSync();
    }, 3000);

    const t3 = performance.now();
    console.log(`[ItemsSync] Creating shape subscriptions (elapsed: ${(t3 - t0).toFixed(0)}ms)`);
    const shapes = await Promise.all([
      (pg as any).electric.syncShapeToTable({
        shape: {
          url: proxyUrl,
          params: {
            table: 'items',
            where: `published_at >= '${cutoffIso}'`,
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
          tryCompletingSync();
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
          tryCompletingSync();
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
          clearTimeout(itemTopicsTimeout);
          console.error('[ItemsSync] item_topics shape sync error:', error);
          // Treat errors as completed to avoid blocking
          console.log('[ItemsSync] Item topics errored, marking as complete');
          tryCompletingSync();
        },
        onInitialSync: () => {
          clearTimeout(itemTopicsTimeout);
          console.log('[ItemsSync] Item topics initial sync complete');
          tryCompletingSync();
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
          tryCompletingSync();
        },
      }),
    ]);

    shapeSubscriptions['items'] = shapes[0];
    shapeSubscriptions['sources'] = shapes[1];
    shapeSubscriptions['item_topics'] = shapes[2];
    shapeSubscriptions['item_likes'] = shapes[3];

    const t4 = performance.now();
    console.log(`[ItemsSync] Shapes subscribed successfully (elapsed: ${(t4 - t0).toFixed(0)}ms)`);
  } catch (err) {
    console.error('[ItemsSync] initializeItemsSync failed:', err);
    isSyncing = false;
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}

export function cleanupItemsSync() {
  Object.values(shapeSubscriptions).forEach(sub => sub?.unsubscribe());
  shapeSubscriptions = {};
  shapesSyncedCount = 0;
  syncCompleted = false;
  syncCompletionCallbacks = [];
}
