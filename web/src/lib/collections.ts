// web/src/lib/collections.ts
import type { InferSelectModel } from 'drizzle-orm';
import { eq, and, desc, inArray } from 'drizzle-orm';
import { getDb } from './db';
import { collections, collectionItems, items } from './schema';
import { logger } from '@/utils/logger';
import type { Item } from './items';

export type Collection = InferSelectModel<typeof collections>;
export type CollectionItem = InferSelectModel<typeof collectionItems>;

export interface CollectionWithCount extends Collection {
  itemCount: number;
}

export interface CollectionWithItems extends Collection {
  items: Item[];
}

/**
 * Get all collections for a user
 */
export async function getUserCollections(userId: string): Promise<CollectionWithCount[]> {
  try {
    const db = await getDb();
    const rows = await db
      .select()
      .from(collections)
      .where(eq(collections.userId, userId))
      .orderBy(desc(collections.updatedAt));

    // Get item counts for each collection
    const withCounts = await Promise.all(
      rows.map(async (col) => {
        const countRows = await db
          .select()
          .from(collectionItems)
          .where(eq(collectionItems.collectionId, col.id));
        return { ...col, itemCount: countRows.length };
      })
    );

    return withCounts;
  } catch (err) {
    logger.warn('Failed to get user collections:', err);
    return [];
  }
}

/**
 * Get a single collection with its items
 */
export async function getCollectionWithItems(
  collectionId: number,
  userId: string
): Promise<CollectionWithItems | null> {
  try {
    const db = await getDb();

    const colRows = await db
      .select()
      .from(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .limit(1);

    if (colRows.length === 0) return null;

    const collection = colRows[0];

    // Get item ids in this collection
    const colItemRows = await db
      .select()
      .from(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId))
      .orderBy(desc(collectionItems.createdAt));

    const itemIds = colItemRows.map((ci) => ci.itemId);

    if (itemIds.length === 0) {
      return { ...collection, items: [] };
    }

    // Fetch all items — explicit column select to avoid missing search_vector in PGlite
    const itemRows = await db
      .select({
        id: items.id,
        sourceId: items.sourceId,
        sourceType: items.sourceType,
        title: items.title,
        url: items.url,
        summary: items.summary,
        body: items.body,
        publishedAt: items.publishedAt,
        rawMetadata: items.rawMetadata,
        topics: items.topics,
        createdAt: items.createdAt,
        updatedAt: items.updatedAt,
      })
      .from(items)
      .where(
        itemIds.length === 1
          ? eq(items.id, itemIds[0])
          : inArray(items.id, itemIds)
      )
      .orderBy(desc(items.publishedAt));

    return { ...collection, items: itemRows as Item[] };
  } catch (err) {
    logger.warn('Failed to get collection with items:', err);
    return null;
  }
}

/**
 * Create a new collection
 */
export async function createCollection(
  userId: string,
  name: string,
  description?: string
): Promise<Collection> {
  const db = await getDb();
  const now = new Date();

  const rows = await db
    .insert(collections)
    .values({
      userId,
      name: name.trim(),
      description: description?.trim() || null,
      createdAt: now,
      updatedAt: now,
    } as any)
    .returning();

  return rows[0] as Collection;
}

/**
 * Update a collection name/description
 */
export async function updateCollection(
  collectionId: number,
  userId: string,
  updates: { name?: string; description?: string }
): Promise<Collection | null> {
  try {
    const db = await getDb();

    const rows = await db
      .update(collections)
      .set({
        ...(updates.name !== undefined ? { name: updates.name.trim() } : {}),
        ...(updates.description !== undefined
          ? { description: updates.description.trim() || null }
          : {}),
        updatedAt: new Date(),
      })
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .returning();

    return rows.length > 0 ? (rows[0] as Collection) : null;
  } catch (err) {
    logger.warn('Failed to update collection:', err);
    return null;
  }
}

/**
 * Delete a collection and all its items
 */
export async function deleteCollection(collectionId: number, userId: string): Promise<boolean> {
  try {
    const db = await getDb();

    // Delete collection items first (no cascade in PGlite)
    await db
      .delete(collectionItems)
      .where(eq(collectionItems.collectionId, collectionId));

    // Delete collection
    const rows = await db
      .delete(collections)
      .where(and(eq(collections.id, collectionId), eq(collections.userId, userId)))
      .returning();

    return rows.length > 0;
  } catch (err) {
    logger.warn('Failed to delete collection:', err);
    return false;
  }
}

/**
 * Add an item to a collection
 */
export async function addItemToCollection(
  collectionId: number,
  itemId: string
): Promise<boolean> {
  try {
    const db = await getDb();

    await db
      .insert(collectionItems)
      .values({
        collectionId,
        itemId,
        createdAt: new Date(),
      } as any)
      .onConflictDoNothing();

    // Touch the collection updatedAt
    await db
      .update(collections)
      .set({ updatedAt: new Date() })
      .where(eq(collections.id, collectionId));

    return true;
  } catch (err) {
    logger.warn('Failed to add item to collection:', err);
    return false;
  }
}

/**
 * Remove an item from a collection
 */
export async function removeItemFromCollection(
  collectionId: number,
  itemId: string
): Promise<boolean> {
  try {
    const db = await getDb();

    await db
      .delete(collectionItems)
      .where(
        and(
          eq(collectionItems.collectionId, collectionId),
          eq(collectionItems.itemId, itemId)
        )
      );

    return true;
  } catch (err) {
    logger.warn('Failed to remove item from collection:', err);
    return false;
  }
}

/**
 * Get the collection IDs that contain a given item (for a user)
 */
export async function getCollectionsForItem(
  itemId: string,
  userId: string
): Promise<number[]> {
  try {
    const db = await getDb();

    // Get all collection ids belonging to user
    const userCols = await db
      .select({ id: collections.id })
      .from(collections)
      .where(eq(collections.userId, userId));

    const userColIds = userCols.map((c) => c.id);

    if (userColIds.length === 0) return [];

    const rows = await db
      .select({ collectionId: collectionItems.collectionId })
      .from(collectionItems)
      .where(
        and(
          eq(collectionItems.itemId, itemId),
          userColIds.length === 1
            ? eq(collectionItems.collectionId, userColIds[0])
            : inArray(collectionItems.collectionId, userColIds)
        )
      );

    return rows.map((r) => r.collectionId);
  } catch (err) {
    logger.warn('Failed to get collections for item:', err);
    return [];
  }
}
