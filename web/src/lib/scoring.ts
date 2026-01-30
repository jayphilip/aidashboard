// web/src/lib/scoring.ts
import type { Item, ItemLike } from './items';

/**
 * Scoring algorithm for ranking items
 * Combines recency, like history, and user interest
 */

const HOURS_PER_DAY = 24;
const DECAY_HALFLIFE = 7 * HOURS_PER_DAY; // 1 week in hours

/**
 * Calculate recency score (exponential decay)
 * Score decreases exponentially with age
 * Items from today score ~1.0
 * Items from 1 week ago score ~0.5
 * Items from 2 weeks ago score ~0.25
 */
export function getRecencyScore(publishedAt: Date): number {
  const ageHours = (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60);
  const score = Math.pow(2, -ageHours / DECAY_HALFLIFE);
  return Math.max(0, score); // never negative
}

/**
 * Get like score based on user history
 * -1 = dislike (score: -0.5)
 *  0 = neutral (score: 0)
 *  1 = like (score: 1.0)
 */
export function getLikeScore(itemLike: ItemLike | null | undefined): number {
  if (!itemLike) return 0;
  if (itemLike.score === 1) return 1.0;
  if (itemLike.score === -1) return -0.5;
  return 0;
}

/**
 * Get engagement score (likes across all users)
 * Returns a normalized score between 0 and 1
 * Max engagement before saturation: 100 likes
 */
export function getEngagementScore(likeCount: number, dislikeCount: number): number {
  const netLikes = Math.max(0, likeCount - dislikeCount);
  return Math.min(1, netLikes / 100);
}

/**
 * Calculate composite score for an item
 * Combines:
 * - Recency (60% weight)
 * - User like history (20% weight)
 * - Engagement/popularity (20% weight)
 */
export function calculateScore(
  item: Item,
  userLike: ItemLike | null | undefined,
  engagementMetrics?: { likeCount: number; dislikeCount: number }
): number {
  const recency = getRecencyScore(item.publishedAt);
  const userLikeScore = getLikeScore(userLike);
  const engagement = engagementMetrics
    ? getEngagementScore(engagementMetrics.likeCount, engagementMetrics.dislikeCount)
    : 0;

  // Weighted composite
  const score = recency * 0.6 + (userLikeScore + 1) * 0.1 + engagement * 0.2;

  return score;
}

/**
 * Sort items by score (highest first)
 */
export function rankItems(
  items: Item[],
  userLikes?: Map<string, ItemLike>,
  engagementMetrics?: Map<string, { likeCount: number; dislikeCount: number }>
): Array<{ item: Item; score: number }> {
  const scored = items.map(item => {
    const userLike = userLikes?.get(item.id);
    const metrics = engagementMetrics?.get(item.id);
    const score = calculateScore(item, userLike, metrics);
    return { item, score };
  });

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Get all-time top items by engagement
 */
export function getTopItems(
  items: Item[],
  limit: number = 10
): Item[] {
  return items
    .sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime())
    .slice(0, limit);
}

/**
 * Calculate source weight multiplier (stored in sources.meta.weight)
 * Default weight is 1.0
 */
export function getSourceWeight(sourceMeta: any): number {
  if (!sourceMeta || typeof sourceMeta !== 'object') return 1.0;
  const weight = (sourceMeta as any).weight;
  return typeof weight === 'number' ? Math.max(0.1, weight) : 1.0;
}

/**
 * Apply source weight to score
 */
export function applySourceWeight(score: number, sourceWeight: number): number {
  return score * sourceWeight;
}
