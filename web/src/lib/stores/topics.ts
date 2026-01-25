// web/src/lib/stores/topics.ts
import { writable, type Readable } from 'svelte/store';
import { eq, and, gte, sql } from 'drizzle-orm';
import { getDb } from '$lib/db';
import { itemTopics, items } from '$lib/schema';

export type TopicTrend = {
  topic: string;
  weeklyData: Array<{
    week: string;
    count: number;
  }>;
  totalItems: number;
  totalLiked: number;
};

type TopicsState = {
  loading: boolean;
  error: string | null;
};

const topicsStore = writable<TopicTrend[]>([]);
const stateStore = writable<TopicsState>({ loading: false, error: null });

export const topics$: Readable<TopicTrend[]> = { subscribe: topicsStore.subscribe };
export const topicsState: Readable<TopicsState> = { subscribe: stateStore.subscribe };

/**
 * Get topic trends for the last N weeks
 */
export async function getTrendingTopics(weeksBack: number = 4): Promise<TopicTrend[]> {
  try {
    const db = await getDb();

    // Calculate cutoff date in JavaScript
    const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

    // Get all topics with their items
    const topicCounts = await db
      .select({
        topic: itemTopics.topic,
        itemId: itemTopics.itemId,
        publishedAt: items.publishedAt,
      })
      .from(itemTopics)
      .innerJoin(items, sql`${itemTopics.itemId} = ${items.id}`)
      .where(gte(items.publishedAt, cutoff));

    // Group by topic and calculate weekly aggregates
    const topicMap = new Map<string, TopicTrend>();

    topicCounts.forEach(row => {
      const topic = row.topic;
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          weeklyData: [],
          totalItems: 0,
          totalLiked: 0,
        });
      }

      const trend = topicMap.get(topic)!;
      trend.totalItems++;

      // Calculate week
      const date = new Date(row.publishedAt as any);
      const week = getWeekString(date);

      // Find or create weekly entry
      let weekEntry = trend.weeklyData.find(w => w.week === week);
      if (!weekEntry) {
        weekEntry = { week, count: 0 };
        trend.weeklyData.push(weekEntry);
      }
      weekEntry.count++;
    });

    // Sort weeks chronologically
    topicMap.forEach(trend => {
      trend.weeklyData.sort((a, b) => a.week.localeCompare(b.week));
    });

    return Array.from(topicMap.values()).sort(
      (a, b) => b.totalItems - a.totalItems
    );
  } catch (err) {
    console.warn('Failed to get trending topics, returning empty array:', err);
    return [];
  }
}

/**
 * Get topics by source type
 */
export async function getTopicsBySourceType(
  sourceType: string,
  weeksBack: number = 4
): Promise<TopicTrend[]> {
  try {
    const db = await getDb();

    // Calculate cutoff date in JavaScript
    const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

    const topicCounts = await db
      .select({
        topic: itemTopics.topic,
        itemId: itemTopics.itemId,
        publishedAt: items.publishedAt,
      })
      .from(itemTopics)
      .innerJoin(items, sql`${itemTopics.itemId} = ${items.id}`)
      .where(and(gte(items.publishedAt, cutoff), eq(items.sourceType, sourceType)));

    const topicMap = new Map<string, TopicTrend>();

    topicCounts.forEach(row => {
      const topic = row.topic;
      if (!topicMap.has(topic)) {
        topicMap.set(topic, {
          topic,
          weeklyData: [],
          totalItems: 0,
          totalLiked: 0,
        });
      }

      const trend = topicMap.get(topic)!;
      trend.totalItems++;

      const date = new Date(row.publishedAt as any);
      const week = getWeekString(date);

      let weekEntry = trend.weeklyData.find(w => w.week === week);
      if (!weekEntry) {
        weekEntry = { week, count: 0 };
        trend.weeklyData.push(weekEntry);
      }
      weekEntry.count++;
    });

    topicMap.forEach(trend => {
      trend.weeklyData.sort((a, b) => a.week.localeCompare(b.week));
    });

    return Array.from(topicMap.values()).sort(
      (a, b) => b.totalItems - a.totalItems
    );
  } catch (err) {
    console.warn(`Failed to get topics by source type ${sourceType}:`, err);
    return [];
  }
}

export async function initializeTopicsFromDb() {
  try {
    stateStore.set({ loading: true, error: null });
    const trends = await getTrendingTopics();
    topicsStore.set(trends);
    stateStore.set({ loading: false, error: null });
  } catch (err) {
    console.error('initializeTopicsFromDb failed', err);
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}

/**
 * Refresh topics from database
 */
export async function refreshTopicsFromDb() {
  try {
    stateStore.set({ loading: true, error: null });
    const trends = await getTrendingTopics();
    topicsStore.set(trends);
    stateStore.set({ loading: false, error: null });
  } catch (err) {
    console.error('refreshTopicsFromDb failed', err);
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}

/**
 * Helper to get week string (YYYY-WXX format)
 */
function getWeekString(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNum = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}
