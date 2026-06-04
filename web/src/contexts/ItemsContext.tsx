import { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getPGlite, getDb } from '@/lib/db';
import { getAllItems, type Item } from '@/lib/items';
import { logger } from '@/utils/logger';
import { ShapeStream, isChangeMessage } from '@electric-sql/client';
import { sources, itemLikes, itemReads, trendReports, type TrendTheme } from '@/lib/schema';
import { eq, desc } from 'drizzle-orm';
import { useUser } from './UserContext';

export interface TrendReport {
  id: string;
  reportDate: string;
  itemsAnalyzed: number;
  narrative: string;
  themes: TrendTheme[];
  model: string | null;
}

interface ItemsState {
  loading: boolean;
  error: string | null;
  items: Item[];
  sourcesMap: Map<number, string>;
  likesMap: Map<string, number | null>;
  readsMap: Map<string, boolean>;
  trendReport: TrendReport | null;
}

interface ItemsContextType extends ItemsState {
  refreshItems: () => Promise<void>;
  waitForSync: () => Promise<void>;
  refreshLikes: () => Promise<void>;
  refreshReads: () => Promise<void>;
  refreshSources: () => Promise<void>;
  refreshTrendReport: () => Promise<void>;
  markAsRead: (itemId: string) => Promise<void>;
  markAsUnread: (itemId: string) => Promise<void>;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

let syncCompleted = false;
let syncCompletionCallbacks: (() => void)[] = [];

export function ItemsProvider({ children }: { children: ReactNode }) {
  const { userId } = useUser();
  const hasInitialized = useRef(false);
  const [state, setState] = useState<ItemsState>({
    loading: true,
    error: null,
    items: [],
    sourcesMap: new Map(),
    likesMap: new Map(),
    readsMap: new Map(),
    trendReport: null,
  });

  const refreshItems = useCallback(async () => {
    try {
      const items = await getAllItems();
      setState(prev => ({ ...prev, items }));
    } catch (err) {
      logger.warn('Failed to refresh items from db:', err);
      setState(prev => ({ ...prev, items: [] }));
    }
  }, []);

  const loadAuxiliaryData = useCallback(async () => {
    try {
      const db = await getDb();

      // Load all sources into a map
      const allSources = await db.select().from(sources);
      const sourcesMap = new Map(allSources.map(s => [s.id, s.name]));

      // Load all user likes into a map
      const userLikes = await db
        .select()
        .from(itemLikes)
        .where(eq(itemLikes.userId, userId));
      const likesMap = new Map(userLikes.map(l => [l.itemId, l.score]));

      // Load all user reads into a map
      const userReads = await db
        .select()
        .from(itemReads)
        .where(eq(itemReads.userId, userId));
      const readsMap = new Map(userReads.map(r => [r.itemId, true]));

      setState(prev => ({ ...prev, sourcesMap, likesMap, readsMap }));
    } catch (err) {
      logger.warn('Failed to load auxiliary data:', err);
    }
  }, [userId]);

  const refreshLikes = useCallback(async () => {
    try {
      const db = await getDb();
      const userLikes = await db
        .select()
        .from(itemLikes)
        .where(eq(itemLikes.userId, userId));
      const likesMap = new Map(userLikes.map(l => [l.itemId, l.score]));
      setState(prev => ({ ...prev, likesMap }));
    } catch (err) {
      logger.warn('Failed to refresh likes:', err);
    }
  }, [userId]);

  const refreshReads = useCallback(async () => {
    try {
      const db = await getDb();
      const userReads = await db
        .select()
        .from(itemReads)
        .where(eq(itemReads.userId, userId));
      const readsMap = new Map(userReads.map(r => [r.itemId, true]));
      setState(prev => ({ ...prev, readsMap }));
    } catch (err) {
      logger.warn('Failed to refresh reads:', err);
    }
  }, [userId]);

  const refreshSources = useCallback(async () => {
    try {
      const db = await getDb();
      const allSources = await db.select().from(sources);
      const sourcesMap = new Map(allSources.map(s => [s.id, s.name]));
      setState(prev => ({ ...prev, sourcesMap }));
    } catch (err) {
      logger.warn('Failed to refresh sources:', err);
    }
  }, []);

  const refreshTrendReport = useCallback(async () => {
    try {
      const db = await getDb();
      const rows = await db
        .select()
        .from(trendReports)
        .orderBy(desc(trendReports.reportDate))
        .limit(1);
      const row = rows[0];
      const trendReport: TrendReport | null = row
        ? {
            id: row.id,
            reportDate: row.reportDate,
            itemsAnalyzed: row.itemsAnalyzed,
            narrative: row.narrative,
            themes: (row.themes ?? []) as TrendTheme[],
            model: row.model,
          }
        : null;
      setState(prev => ({ ...prev, trendReport }));
    } catch (err) {
      logger.warn('Failed to refresh trend report:', err);
    }
  }, []);

  const markAsRead = useCallback(async (itemId: string) => {
    try {
      const db = await getDb();
      // Insert or ignore if already exists
      await db.insert(itemReads).values({
        userId,
        itemId,
        readAt: new Date(),
        createdAt: new Date(),
      } as any).onConflictDoNothing();

      await refreshReads();
    } catch (err) {
      logger.error('Failed to mark item as read:', err);
    }
  }, [userId, refreshReads]);

  const markAsUnread = useCallback(async (itemId: string) => {
    try {
      const db = await getDb();
      await db.delete(itemReads).where(
        eq(itemReads.itemId, itemId)
      );

      await refreshReads();
    } catch (err) {
      logger.error('Failed to mark item as unread:', err);
    }
  }, [refreshReads]);

  const waitForSync = useCallback((): Promise<void> => {
    if (syncCompleted) {
      return Promise.resolve();
    }
    return new Promise(resolve => {
      syncCompletionCallbacks.push(resolve);
    });
  }, []);

  const initializeSync = useCallback(async () => {
    if (hasInitialized.current) {
      console.log('[ItemsSync] Already initialized');
      return;
    }

    hasInitialized.current = true;

    try {
      console.log('[ItemsSync] Initializing...');
      const pg = await getPGlite();
      await getDb(); // Create schema

      // OPTIMIZATION: Load cached data immediately (optimistic render)
      console.log('[ItemsSync] Loading cached data for instant render...');
      await refreshItems();
      await loadAuxiliaryData();
      await refreshTrendReport();
      setState(prev => ({ ...prev, loading: false })); // Show UI immediately!

      const electricUrl = import.meta.env.VITE_ELECTRIC_URL || 'http://localhost:3000';
      const baseUrl = `${electricUrl}/v1/shape`;
      console.log('[ItemsSync] Electric base URL:', baseUrl);
      const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let completedShapes = new Set<string>();
      const totalShapes = 3; // items, sources, item_likes only (removed item_topics)
      const BATCH_SIZE = 1000;

      const syncTimeout = setTimeout(() => {
        console.warn('[ItemsSync] Timeout reached');
        completeSyncFlow();
      }, 60000); // Increased to 60 seconds

      function completeSyncFlow() {
        if (syncCompleted) return;
        console.log('[ItemsSync] ✅ Sync complete');

        syncCompleted = true;
        // Don't set loading: false here - already done optimistically above

        // Debug logging
        (async () => {
          try {
            const result = await pg.query(`
              SELECT
                MIN(published_at)::text as earliest,
                MAX(published_at)::text as latest,
                COUNT(*) as total
              FROM items
            `);
            console.log('[ItemsSync] 📊 Local DB stats:', result.rows[0]);

            const recent = await pg.query(`
              SELECT
                id,
                title,
                published_at::text,
                created_at::text
              FROM items
              ORDER BY COALESCE(published_at, created_at) DESC
              LIMIT 5
            `);
            console.log('[ItemsSync] 📰 Most recent items:', recent.rows);
          } catch (err) {
            console.error('[ItemsSync] Debug query failed:', err);
          }
        })();

        refreshItems();
        loadAuxiliaryData();
        syncCompletionCallbacks.forEach(cb => cb());
        syncCompletionCallbacks = [];
      }

      function onShapeComplete(shapeName: string) {
        if (completedShapes.has(shapeName)) {
          console.log(`[ItemsSync] ${shapeName} already completed, skipping`);
          return;
        }
        
        completedShapes.add(shapeName);
        console.log(`[ItemsSync] ${shapeName} synced (${completedShapes.size}/${totalShapes})`);
        
        if (completedShapes.size === totalShapes) {
          clearTimeout(syncTimeout);
          completeSyncFlow();
        }
      }

      // Batch insert helper
      async function flushBatch(tableName: string, batch: any[], pg: any) {
        if (batch.length === 0) return;
        
        const columns = Object.keys(batch[0]);
        const valuePlaceholders = batch.map((_, batchIdx) => 
          `(${columns.map((_, colIdx) => `$${batchIdx * columns.length + colIdx + 1}`).join(',')})`
        ).join(',');
        
        const allValues = batch.flatMap(item => Object.values(item));
        const updates = columns.map(k => `${k} = EXCLUDED.${k}`).join(',');
        
        try {
          await pg.query(
            `INSERT INTO ${tableName} (${columns.join(',')}) 
             VALUES ${valuePlaceholders}
             ON CONFLICT (id) DO UPDATE SET ${updates}`,
            allValues
          );
          console.log(`[ItemsSync] ${tableName}: Inserted batch of ${batch.length} rows`);
        } catch (err) {
          console.error(`[ItemsSync] ${tableName}: Batch insert failed:`, err);
          // Fallback to individual inserts on batch failure
          for (const item of batch) {
            try {
              const cols = Object.keys(item);
              const vals = Object.values(item);
              const placeholders = cols.map((_, i) => `$${i + 1}`).join(',');
              const upd = cols.map(k => `${k} = EXCLUDED.${k}`).join(',');
              await pg.query(
                `INSERT INTO ${tableName} (${cols.join(',')}) 
                 VALUES (${placeholders})
                 ON CONFLICT (id) DO UPDATE SET ${upd}`,
                vals
              );
            } catch (itemErr) {
              console.error(`[ItemsSync] ${tableName}: Failed to insert single item:`, itemErr);
            }
          }
        }
      }

      // Sync items with batching
      let itemBatch: any[] = [];
      let itemCount = 0;
      let itemsInitialSyncDone = false;

      const itemsUrl = `${baseUrl}?table=items&where=${encodeURIComponent(`published_at >= '${cutoffIso}' OR created_at >= '${cutoffIso}'`)}`;
      console.log('[ItemsSync] Subscribing to items stream:', itemsUrl);

      const itemsStream = new ShapeStream({
        url: itemsUrl,
      });

      itemsStream.subscribe(
        async (messages) => {
          for (const message of messages) {
            if (message.headers?.control === 'up-to-date') {
            // Flush remaining batch
            if (itemBatch.length > 0) {
              await flushBatch('items', itemBatch, pg);
              itemBatch = [];
            }

            if (!itemsInitialSyncDone) {
              console.log(`[ItemsSync] items initial sync complete - ${itemCount} total`);
              onShapeComplete('items');
              itemsInitialSyncDone = true;
            } else {
              console.log(`[ItemsSync] items update received`);
            }
            // Don't return - continue processing future updates
            continue;
          }
          
          if (isChangeMessage(message) && message.value) {
            itemCount++;

            const itemData: any = { ...message.value };
            
            // Convert source_id from string to integer
            if (itemData.source_id) {
              itemData.source_id = parseInt(itemData.source_id, 10);
            }

            // Convert timestamp strings to Date objects (for Drizzle compatibility)
            if (itemData.published_at && typeof itemData.published_at === 'string') {
              itemData.published_at = new Date(itemData.published_at);
            }
            if (itemData.created_at && typeof itemData.created_at === 'string') {
              itemData.created_at = new Date(itemData.created_at);
            }
            if (itemData.updated_at && typeof itemData.updated_at === 'string') {
              itemData.updated_at = new Date(itemData.updated_at);
            }

            // Parse topics array from PostgreSQL format
            if (itemData.topics) {
              if (typeof itemData.topics === 'string') {
                // Handle PostgreSQL array format: "{topic1,topic2}" or with quotes: "{\"topic one\",\"topic two\"}"
                try {
                  // Remove outer braces
                  let arrayContent = itemData.topics.replace(/^\{|\}$/g, '');
                  
                  if (arrayContent === '') {
                    itemData.topics = [];
                  } else {
                    // Parse PostgreSQL array format properly
                    // Handle both simple format {a,b,c} and quoted format {"a","b","c"}
                    const topics: string[] = [];
                    let current = '';
                    let inQuotes = false;
                    let escaped = false;
                    
                    for (let i = 0; i < arrayContent.length; i++) {
                      const char = arrayContent[i];
                      
                      if (escaped) {
                        current += char;
                        escaped = false;
                      } else if (char === '\\') {
                        escaped = true;
                      } else if (char === '"') {
                        inQuotes = !inQuotes;
                      } else if (char === ',' && !inQuotes) {
                        if (current.trim()) {
                          topics.push(current.trim());
                        }
                        current = '';
                      } else {
                        current += char;
                      }
                    }
                    
                    // Don't forget the last item
                    if (current.trim()) {
                      topics.push(current.trim());
                    }
                    
                    itemData.topics = topics;
                  }
                } catch (err) {
                  console.warn('[ItemsSync] Failed to parse topics array:', err);
                  itemData.topics = [];
                }
              } else if (!Array.isArray(itemData.topics)) {
                // Fallback: ensure its an array
                itemData.topics = [];
              }
            } else {
              itemData.topics = [];
            }
            
            // Validate required fields
            if (!itemData.id || !itemData.title || !itemData.url) {
              console.warn('[ItemsSync] Missing required fields, skipping item:', {
                id: itemData.id,
                title: itemData.title,
                url: itemData.url
              });
              continue;
            }
            
            itemBatch.push(itemData);
            
            if (itemCount % 100 === 0) {
              console.log(`[ItemsSync] items: Processed ${itemCount}...`);
            }
            
            // Flush batch when it reaches size limit
            if (itemBatch.length >= BATCH_SIZE) {
              await flushBatch('items', itemBatch, pg);
              itemBatch = [];
            }
          }
        }

        // Flush any remaining batch after processing all messages
        if (itemBatch.length > 0) {
          await flushBatch('items', itemBatch, pg);
          itemBatch = [];
          // Refresh items when new data arrives
          await refreshItems();
        }
      },
      (error) => {
        console.error('[ItemsSync] Items stream error:', error);
        setState(prev => ({ ...prev, error: `Items sync failed: ${error.message}` }));
      }
      );

      // Sync sources with batching
      let sourcesBatch: any[] = [];
      let sourcesCount = 0;
      let sourcesInitialSyncDone = false;

      const sourcesUrl = `${baseUrl}?table=sources`;
      console.log('[ItemsSync] Subscribing to sources stream:', sourcesUrl);

      const sourcesStream = new ShapeStream({
        url: sourcesUrl,
      });

      sourcesStream.subscribe(
        async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            if (sourcesBatch.length > 0) {
              await flushBatch('sources', sourcesBatch, pg);
              sourcesBatch = [];
            }

            if (!sourcesInitialSyncDone) {
              console.log(`[ItemsSync] sources initial sync complete - ${sourcesCount} total`);
              onShapeComplete('sources');
              sourcesInitialSyncDone = true;
            } else {
              console.log(`[ItemsSync] sources update received`);
            }
            // Don't return - continue processing future updates
            continue;
          }

          if (isChangeMessage(message) && message.value) {
            sourcesCount++;
            console.log('[ItemsSync] sources: Received source data:', message.value);
            sourcesBatch.push(message.value);

            if (sourcesBatch.length >= BATCH_SIZE) {
              await flushBatch('sources', sourcesBatch, pg);
              sourcesBatch = [];
            }
          }
        }

        // Flush any remaining batch after processing all messages
        if (sourcesBatch.length > 0) {
          console.log(`[ItemsSync] sources: Flushing final batch of ${sourcesBatch.length} sources`);
          await flushBatch('sources', sourcesBatch, pg);
          sourcesBatch = [];
          // Refresh sources map when new data arrives
          await loadAuxiliaryData();
          console.log('[ItemsSync] sources: Refreshed auxiliary data after sync');
        }
      },
      (error) => {
        console.error('[ItemsSync] Sources stream error:', error);
        setState(prev => ({ ...prev, error: `Sources sync failed: ${error.message}` }));
      }
      );

      // Sync item_likes with batching
      let likesBatch: any[] = [];
      let likesCount = 0;
      let likesInitialSyncDone = false;

      const likesUrl = `${baseUrl}?table=item_likes`;
      console.log('[ItemsSync] Subscribing to item_likes stream:', likesUrl);

      const likesStream = new ShapeStream({
        url: likesUrl,
      });

      likesStream.subscribe(
        async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            if (likesBatch.length > 0) {
              await flushBatch('item_likes', likesBatch, pg);
              likesBatch = [];
            }

            if (!likesInitialSyncDone) {
              console.log(`[ItemsSync] item_likes initial sync complete - ${likesCount} total`);
              onShapeComplete('item_likes');
              likesInitialSyncDone = true;
            } else {
              console.log(`[ItemsSync] item_likes update received`);
            }
            // Don't return - continue processing future updates
            continue;
          }

          if (isChangeMessage(message) && message.value) {
            likesCount++;
            likesBatch.push(message.value);

            if (likesBatch.length >= BATCH_SIZE) {
              await flushBatch('item_likes', likesBatch, pg);
              likesBatch = [];
            }
          }
        }

        // Flush any remaining batch after processing all messages
        if (likesBatch.length > 0) {
          await flushBatch('item_likes', likesBatch, pg);
          likesBatch = [];
          // Refresh likes when new data arrives
          await refreshLikes();
        }
      },
      (error) => {
        console.error('[ItemsSync] Likes stream error:', error);
        setState(prev => ({ ...prev, error: `Likes sync failed: ${error.message}` }));
      }
      );

      // Sync trend_reports (Hermes summaries). Non-blocking: this does NOT
      // count toward totalShapes, so a slow/empty trend feed never gates the UI.
      let trendBatch: any[] = [];

      const trendUrl = `${baseUrl}?table=trend_reports`;
      console.log('[ItemsSync] Subscribing to trend_reports stream:', trendUrl);

      const trendStream = new ShapeStream({
        url: trendUrl,
      });

      trendStream.subscribe(
        async (messages) => {
          for (const message of messages) {
            if (message.headers?.control === 'up-to-date') {
              if (trendBatch.length > 0) {
                await flushBatch('trend_reports', trendBatch, pg);
                trendBatch = [];
              }
              await refreshTrendReport();
              continue;
            }

            if (isChangeMessage(message) && message.value) {
              const row: any = { ...message.value };
              // Coerce timestamps to Date for consistency with other tables.
              if (typeof row.created_at === 'string') row.created_at = new Date(row.created_at);
              if (typeof row.updated_at === 'string') row.updated_at = new Date(row.updated_at);
              trendBatch.push(row);

              if (trendBatch.length >= BATCH_SIZE) {
                await flushBatch('trend_reports', trendBatch, pg);
                trendBatch = [];
              }
            }
          }

          if (trendBatch.length > 0) {
            await flushBatch('trend_reports', trendBatch, pg);
            trendBatch = [];
            await refreshTrendReport();
          }
        },
        (error) => {
          console.error('[ItemsSync] Trend reports stream error:', error);
          // Non-fatal: the Trends tab simply falls back to client-side stats.
        }
      );

      console.log('[ItemsSync] All streams subscribed');

    } catch (err) {
      console.error('[ItemsSync] Init failed:', err);
      setState(prev => ({
        ...prev,
        loading: false,
        error: (err as Error).message
      }));
    }
  }, [refreshItems, loadAuxiliaryData, refreshTrendReport]);

  useEffect(() => {
    initializeSync();
  }, [initializeSync]);

  return (
    <ItemsContext.Provider value={{ ...state, refreshItems, waitForSync, refreshLikes, refreshReads, refreshSources, refreshTrendReport, markAsRead, markAsUnread }}>
      {children}
    </ItemsContext.Provider>
  );
}

export function useItems() {
  const context = useContext(ItemsContext);
  if (!context) {
    throw new Error('useItems must be used within an ItemsProvider');
  }
  return context;
}
