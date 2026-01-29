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
    const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

    // Use SQL to aggregate by topic and week - much faster than client-side
    const weeklyResults = await db.execute<{
      topic: string;
      week: string;
      count: number;
    }>(sql`
      SELECT
        it.topic,
        to_char(date_trunc('week', i.published_at), 'YYYY-"W"IW') as week,
        COUNT(*) as count
      FROM item_topics it
      INNER JOIN items i ON it.item_id = i.id
      WHERE i.published_at >= ${cutoff}
      GROUP BY it.topic, date_trunc('week', i.published_at)
      ORDER BY it.topic, week
    `);

    // Group by topic
    const topicMap = new Map<string, TopicTrend>();

    weeklyResults.rows.forEach(row => {
      if (!topicMap.has(row.topic)) {
        topicMap.set(row.topic, {
          topic: row.topic,
          weeklyData: [],
          totalItems: 0,
          totalLiked: 0,
        });
      }

      const trend = topicMap.get(row.topic)!;
      trend.weeklyData.push({ week: row.week, count: Number(row.count) });
      trend.totalItems += Number(row.count);
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
    const cutoff = new Date(Date.now() - weeksBack * 7 * 24 * 60 * 60 * 1000);

    // Use SQL aggregation for better performance
    const weeklyResults = await db.execute<{
      topic: string;
      week: string;
      count: number;
    }>(sql`
      SELECT
        it.topic,
        to_char(date_trunc('week', i.published_at), 'YYYY-"W"IW') as week,
        COUNT(*) as count
      FROM item_topics it
      INNER JOIN items i ON it.item_id = i.id
      WHERE i.published_at >= ${cutoff}
        AND i.source_type = ${sourceType}
      GROUP BY it.topic, date_trunc('week', i.published_at)
      ORDER BY it.topic, week
    `);

    // Group by topic
    const topicMap = new Map<string, TopicTrend>();

    weeklyResults.rows.forEach(row => {
      if (!topicMap.has(row.topic)) {
        topicMap.set(row.topic, {
          topic: row.topic,
          weeklyData: [],
          totalItems: 0,
          totalLiked: 0,
        });
      }

      const trend = topicMap.get(row.topic)!;
      trend.weeklyData.push({ week: row.week, count: Number(row.count) });
      trend.totalItems += Number(row.count);
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
