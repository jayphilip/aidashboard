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

      let completedShapes = 0;
      const totalShapes = 4;

      const syncTimeout = setTimeout(() => {
        console.warn('[ItemsSync] Timeout reached');
        completeSyncFlow();
      }, 20000);

      function completeSyncFlow() {
        if (syncCompleted) return;
        console.log('[ItemsSync] ✅ Sync complete');
        syncCompleted = true;
        setState(prev => ({ ...prev, loading: false, error: null }));
        refreshItems();
        syncCompletionCallbacks.forEach(cb => cb());
        syncCompletionCallbacks = [];
      }

      function onShapeComplete(shapeName: string) {
        completedShapes++;
        console.log(`[ItemsSync] ${shapeName} synced (${completedShapes}/${totalShapes})`);
        if (completedShapes === totalShapes) {
          clearTimeout(syncTimeout);
          completeSyncFlow();
        }
      }

      // Sync items with where clause
      const itemsStream = new ShapeStream({
        url: `${baseUrl}?table=items&where=${encodeURIComponent(`published_at >= '${cutoffIso}' OR created_at >= '${cutoffIso}'`)}`,
      });

      itemsStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            onShapeComplete('items');
            return;
          }
          
          // Apply inserts/updates/deletes to PGlite
          if (message.value) {
            const data = message.value;
            await pg.query(
              `INSERT INTO items (${Object.keys(data).join(',')}) 
               VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')})
               ON CONFLICT (id) DO UPDATE SET ${Object.keys(data).map(k => `${k} = EXCLUDED.${k}`).join(',')}`,
              Object.values(data)
            );
          }
        }
      });

      // Sync sources
      const sourcesStream = new ShapeStream({
        url: `${baseUrl}?table=sources`,
      });

      sourcesStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            onShapeComplete('sources');
            return;
          }
          if (message.value) {
            const data = message.value;
            await pg.query(
              `INSERT INTO sources (${Object.keys(data).join(',')}) 
               VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')})
               ON CONFLICT (id) DO UPDATE SET ${Object.keys(data).map(k => `${k} = EXCLUDED.${k}`).join(',')}`,
              Object.values(data)
            );
          }
        }
      });

      // Sync item_topics
      const topicsStream = new ShapeStream({
        url: `${baseUrl}?table=item_topics`,
      });

      topicsStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            onShapeComplete('item_topics');
            return;
          }
          if (message.value) {
            const data = message.value;
            await pg.query(
              `INSERT INTO item_topics (${Object.keys(data).join(',')}) 
               VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')})
               ON CONFLICT (id) DO UPDATE SET ${Object.keys(data).map(k => `${k} = EXCLUDED.${k}`).join(',')}`,
              Object.values(data)
            );
          }
        }
      });

      // Sync item_likes
      const likesStream = new ShapeStream({
        url: `${baseUrl}?table=item_likes`,
      });

      likesStream.subscribe(async (messages) => {
        for (const message of messages) {
          if (message.headers?.control === 'up-to-date') {
            onShapeComplete('item_likes');
            return;
          }
          if (message.value) {
            const data = message.value;
            await pg.query(
              `INSERT INTO item_likes (${Object.keys(data).join(',')}) 
               VALUES (${Object.keys(data).map((_, i) => `$${i + 1}`).join(',')})
               ON CONFLICT (id) DO UPDATE SET ${Object.keys(data).map(k => `${k} = EXCLUDED.${k}`).join(',')}`,
              Object.values(data)
            );
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
