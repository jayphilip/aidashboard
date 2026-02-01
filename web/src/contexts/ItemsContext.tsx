import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getPGlite, getDb } from '@/lib/db';
import { getAllItems, type Item } from '@/lib/items';
import { logger } from '@/utils/logger';
import { ShapeStream } from '@electric-sql/client';

interface ItemsState {
  loading: boolean;
  error: string | null;
  items: Item[];
}

interface ItemsContextType extends ItemsState {
  refreshItems: () => Promise<void>;
  waitForSync: () => Promise<void>;
}

const ItemsContext = createContext<ItemsContextType | undefined>(undefined);

let syncCompleted = false;
let syncCompletionCallbacks: (() => void)[] = [];

export function ItemsProvider({ children }: { children: ReactNode }) {
  const hasInitialized = useRef(false);
  const [state, setState] = useState<ItemsState>({
    loading: true,
    error: null,
    items: [],
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
      
      const baseUrl = `${window.location.origin}/v1/shape`;
      const cutoffIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      let completedShapes = new Set<string>();
      const totalShapes = 4;
      const BATCH_SIZE = 1000;

      const syncTimeout = setTimeout(() => {
        console.warn('[ItemsSync] Timeout reached');
        completeSyncFlow();
      }, 60000); // Increased to 60 seconds

      function completeSyncFlow() {
        if (syncCompleted) return;
        console.log('[ItemsSync] ✅ Sync complete');
        
        syncCompleted = true;
        setState(prev => ({ ...prev, loading: false, error: null }));
        
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
      
      const itemsStream = new ShapeStream({
        url: `${baseUrl}?table=items&where=${encodeURIComponent(`published_at >= '${cutoffIso}' OR created_at >= '${cutoffIso}'`)}`,
      });

      itemsStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            // Flush remaining batch
            if (itemBatch.length > 0) {
              await flushBatch('items', itemBatch, pg);
              itemBatch = [];
            }
            console.log(`[ItemsSync] items complete - ${itemCount} total`);
            onShapeComplete('items');
            return;
          }
          
          if (message.value) {
            itemCount++;
            itemBatch.push(message.value);
            
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
      });

      // Sync sources with batching
      let sourcesBatch: any[] = [];
      let sourcesCount = 0;
      
      const sourcesStream = new ShapeStream({
        url: `${baseUrl}?table=sources`,
      });

      sourcesStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            if (sourcesBatch.length > 0) {
              await flushBatch('sources', sourcesBatch, pg);
              sourcesBatch = [];
            }
            console.log(`[ItemsSync] sources complete - ${sourcesCount} total`);
            onShapeComplete('sources');
            return;
          }
          
          if (message.value) {
            sourcesCount++;
            sourcesBatch.push(message.value);
            
            if (sourcesBatch.length >= BATCH_SIZE) {
              await flushBatch('sources', sourcesBatch, pg);
              sourcesBatch = [];
            }
          }
        }
      });

      // Sync item_topics with batching
      let topicsBatch: any[] = [];
      let topicsCount = 0;
      
      const topicsStream = new ShapeStream({
        url: `${baseUrl}?table=item_topics`,
      });

      topicsStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            if (topicsBatch.length > 0) {
              await flushBatch('item_topics', topicsBatch, pg);
              topicsBatch = [];
            }
            console.log(`[ItemsSync] item_topics complete - ${topicsCount} total`);
            onShapeComplete('item_topics');
            return;
          }
          
          if (message.value) {
            topicsCount++;
            topicsBatch.push(message.value);
            
            if (topicsBatch.length >= BATCH_SIZE) {
              await flushBatch('item_topics', topicsBatch, pg);
              topicsBatch = [];
            }
          }
        }
      });

      // Sync item_likes with batching
      let likesBatch: any[] = [];
      let likesCount = 0;
      
      const likesStream = new ShapeStream({
        url: `${baseUrl}?table=item_likes`,
      });

      likesStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            if (likesBatch.length > 0) {
              await flushBatch('item_likes', likesBatch, pg);
              likesBatch = [];
            }
            console.log(`[ItemsSync] item_likes complete - ${likesCount} total`);
            onShapeComplete('item_likes');
            return;
          }
          
          if (message.value) {
            likesCount++;
            likesBatch.push(message.value);
            
            if (likesBatch.length >= BATCH_SIZE) {
              await flushBatch('item_likes', likesBatch, pg);
              likesBatch = [];
            }
          }
        }
      });

      console.log('[ItemsSync] All streams subscribed');

    } catch (err) {
      console.error('[ItemsSync] Init failed:', err);
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: (err as Error).message 
      }));
    }
  }, [refreshItems]);

  useEffect(() => {
    initializeSync();
  }, [initializeSync]);

  return (
    <ItemsContext.Provider value={{ ...state, refreshItems, waitForSync }}>
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
