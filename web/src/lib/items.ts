// web/src/lib/items.ts
import type { InferSelectModel } from 'drizzle-orm';
import { desc, eq, gte, lte, sql, inArray, and, isNull } from 'drizzle-orm';
import { getPGlite, getDb } from './db';
import { items, itemTopics, itemLikes, sources } from './schema';
import { logger } from '@/utils/logger';

export type Item = InferSelectModel<typeof items>;
export type Source = InferSelectModel<typeof sources>;
export type ItemTopic = InferSelectModel<typeof itemTopics>;
export type ItemLike = InferSelectModel<typeof itemLikes>;

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
 * Search items with full-text search and filtering
 * Searches title, summary, and body fields
 * Supports filtering by source type, date range, topics, and sources
 */
export async function searchItems(options: SearchOptions, userId: string): Promise<Item[]> {
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
      qb = qb.from(items).leftJoin(itemLikes, and(eq(items.id, itemLikes.itemId), eq(itemLikes.userId, userId)));
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
 * Get all items (no filtering)
 */
export async function getAllItems(): Promise<Item[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(items)
      .orderBy(desc(items.publishedAt));
    return rows;
  } catch (err) {
    logger.warn('Failed to get all items:', err);
    return [];
  }
}
