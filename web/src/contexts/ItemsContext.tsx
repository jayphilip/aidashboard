import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { getPGlite, getDb } from '@/lib/db';
import { getAllItems, type Item } from '@/lib/items';
import { logger } from '@/utils/logger';

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

let shapeSubscriptions: { [key: string]: { unsubscribe: () => void } } = {};
let isSyncing = false;
let syncCompleted = false;
let syncCompletionCallbacks: (() => void)[] = [];

let shapesSyncedCount = 0;
let shapesCompleted = new Set<string>(); // Track which shapes have completed
const totalShapesToSync = 4; // items, sources, item_topics, item_likes

function tryCompletingSync(
  shapeName: string,
  refreshCallback: () => Promise<void>,
  setLoading: (loading: boolean) => void,
  setError: (error: string | null) => void
) {
  // Only count each shape once
  if (shapesCompleted.has(shapeName)) {
    console.log(`[ItemsSync] ${shapeName} already counted, skipping`);
    return;
  }

  shapesCompleted.add(shapeName);
  shapesSyncedCount++;
  console.log(`[ItemsSync] Shape sync progress: ${shapesSyncedCount}/${totalShapesToSync} (${shapeName})`);

  if (shapesSyncedCount === totalShapesToSync) {
    console.log('[ItemsSync] All shapes synced, completing initialization');
    syncCompleted = true;
    refreshCallback();
    isSyncing = false;
    setLoading(false);
    setError(null);

    // Call any waiting callbacks
    syncCompletionCallbacks.forEach(cb => cb());
    syncCompletionCallbacks = [];
  }
}

export function ItemsProvider({ children }: { children: ReactNode }) {
  const hasInitialized = useRef(false);
  const [state, setState] = useState<ItemsState>({
    loading: false,
    error: null,
    items: [],
  });

  const setLoading = (loading: boolean) => {
    setState(prev => ({ ...prev, loading }));
  };

  const setError = (error: string | null) => {
    setState(prev => ({ ...prev, error, loading: false }));
  };

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
      console.log('[ItemsSync] Already initialized (ref check), skipping');
      return;
    }
    if (isSyncing) {
      console.log('[ItemsSync] Already syncing, skipping');
      return;
    }
    if (syncCompleted) {
      console.log('[ItemsSync] Sync already completed, skipping');
      return;
    }
    if (shapeSubscriptions['all']) {
      console.log('[ItemsSync] Already subscribed, skipping');
      return;
    }

    hasInitialized.current = true;
    isSyncing = true;
    setLoading(true);
    setError(null);

    try {
      const t0 = performance.now();
      console.log('[ItemsSync] Initializing sync...');

      const t1 = performance.now();
      const pg = await getPGlite();
      console.log(`[ItemsSync] PGlite initialized in ${(performance.now() - t1).toFixed(0)}ms (total: ${(performance.now() - t0).toFixed(0)}ms)`);

      // IMPORTANT: Initialize database schema BEFORE starting sync
      const t1b = performance.now();
      await getDb();
      console.log(`[ItemsSync] Database schema created in ${(performance.now() - t1b).toFixed(0)}ms (total: ${(performance.now() - t0).toFixed(0)}ms)`);

      // Connect directly to Electric (bypassing Vite proxy which struggles with streaming)
      const electricUrl = 'http://localhost:3000/v1/shape';

      const t2 = performance.now();
      console.log(`[ItemsSync] Starting sync with Electric: ${electricUrl} (elapsed: ${(t2 - t0).toFixed(0)}ms)`);

      // Calculate 7-day cutoff for shape filtering
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);
      const cutoffIso = sevenDaysAgo.toISOString();

      const t3 = performance.now();
      // Before creating subscriptions, ensure local PGlite isn't stale compared to server
      async function ensureLocalIsFresh(electricUrlParam: string, pgInstance: any) {
        try {
          const resp = await fetch(`${electricUrlParam}?offset=-1&limit=1&table=items`);
          if (!resp.ok) return;
          const body = await resp.json();
          let serverRow: any = null;
          if (Array.isArray(body) && body.length > 0) serverRow = body[0];
          else if (body && body.rows && body.rows.length > 0) serverRow = body.rows[0];
          const serverIso = serverRow?.published_at ?? serverRow?.created_at ?? null;
          if (!serverIso) return;
          const serverMax = new Date(serverIso).getTime();

          const localRes = await pgInstance.query("SELECT max(COALESCE(published_at, created_at))::text AS max_date FROM items;");
          const localIso = localRes?.rows?.[0]?.max_date ?? null;
          const localMax = localIso ? new Date(localIso).getTime() : 0;

          // If server is newer by >60s, clear local DB and reload to force fresh snapshot
          if (serverMax - localMax > 60_000) {
            console.warn('[ItemsSync] Server has newer data, resetting local DB (delta ms):', serverMax - localMax);
            try {
              if ((indexedDB as any)?.databases) {
                const dbs = await (indexedDB as any).databases();
                await Promise.all(dbs.map((d: any) => {
                  const name: string = d.name ?? '';
                  if (/pglite|electric|aidashboard|pglite_db/i.test(name)) {
                    return new Promise<void>((resolve) => {
                      const req = indexedDB.deleteDatabase(name);
                      req.onsuccess = () => resolve();
                      req.onerror = () => resolve();
                      req.onblocked = () => resolve();
                    });
                  }
                  return Promise.resolve();
                }));
              } else {
                await Promise.all([
                  new Promise<void>(r => { const rq = indexedDB.deleteDatabase('pglite'); rq.onsuccess = r; rq.onerror = r; rq.onblocked = r; }),
                  new Promise<void>(r => { const rq = indexedDB.deleteDatabase('electric'); rq.onsuccess = r; rq.onerror = r; rq.onblocked = r; }),
                ]);
              }
            } catch (err) {
              console.warn('[ItemsSync] error deleting IndexedDB:', err);
            }
            window.location.reload();
          }
        } catch (err) {
          console.warn('[ItemsSync] ensureLocalIsFresh error (ignored):', err);
        }
      }

      console.log(`[ItemsSync] Creating shape subscriptions (elapsed: ${(t3 - t0).toFixed(0)}ms)`);
      await ensureLocalIsFresh(electricUrl, pg);

      // Add timeout to prevent infinite spinner
      const syncTimeout = setTimeout(() => {
        const elapsedSec = ((performance.now() - t0) / 1000).toFixed(1);
        console.warn(`[ItemsSync] Sync timeout after ${elapsedSec}s`);
        if (!syncCompleted) {
          if (shapesSyncedCount === 0) {
            console.warn('[ItemsSync] No shapes progressed; marking sync complete to avoid blocking UI');
            shapesCompleted.add('items');
            shapesCompleted.add('sources');
            shapesCompleted.add('item_topics');
            shapesCompleted.add('item_likes');
            shapesSyncedCount = totalShapesToSync;
            syncCompleted = true;
            refreshItems();
            isSyncing = false;
            setLoading(false);
            syncCompletionCallbacks.forEach(cb => cb());
            syncCompletionCallbacks = [];
          } else {
            console.warn('[ItemsSync] Partial progress detected; keeping sync running in background and clearing loading state');
            setLoading(false);
          }
        }
      }, 30000);

      // Use the official syncShapesToTables API (plural) for syncing multiple tables
      console.log('[ItemsSync] Starting multi-table sync with syncShapesToTables');

      const syncResult = await (pg as any).electric.syncShapesToTables({
        key: 'items-sync', // Persist sync state across sessions
        shapes: {
          items: {
            shape: {
              url: `${electricUrl}?offset=-1`,
              params: {
                table: 'items',
                limit: 200,
                where: `COALESCE(published_at, created_at) >= '${cutoffIso}'`,
              },
            },
            table: 'items',
            primaryKey: ['id'],
          },
          sources: {
            shape: {
              url: electricUrl,
              params: {
                table: 'sources',
              },
            },
            table: 'sources',
            primaryKey: ['id'],
          },
          item_topics: {
            shape: {
              url: electricUrl,
              params: {
                table: 'item_topics',
              },
            },
            table: 'item_topics',
            primaryKey: ['id'],
          },
          item_likes: {
            shape: {
              url: electricUrl,
              params: {
                table: 'item_likes',
              },
            },
            table: 'item_likes',
            primaryKey: ['id'],
          },
        },
        onInitialSync: () => {
          console.log('[ItemsSync] ALL shapes initial sync complete!');
          clearTimeout(syncTimeout);

          // Mark all shapes as synced
          shapesCompleted.add('items');
          shapesCompleted.add('sources');
          shapesCompleted.add('item_topics');
          shapesCompleted.add('item_likes');
          shapesSyncedCount = 4;

          syncCompleted = true;
          refreshItems();
          isSyncing = false;
          setLoading(false);
          setError(null);

          // Call any waiting callbacks
          syncCompletionCallbacks.forEach(cb => cb());
          syncCompletionCallbacks = [];
        },
        onError: (error: unknown) => {
          console.error('[ItemsSync] Global sync error:', error);
          if (error instanceof Error) {
            console.error('[ItemsSync] Error stack:', error.stack);
          }
          setError((error as Error).message ?? String(error));
        },
      });

      shapeSubscriptions['all'] = syncResult;

      const t4 = performance.now();
      console.log(`[ItemsSync] Shapes subscribed successfully (elapsed: ${(t4 - t0).toFixed(0)}ms)`);

      // Check if sync is already up-to-date (resumed from persisted state)
      if (syncResult.isUpToDate) {
        console.log('[ItemsSync] Sync already up-to-date (resumed from cache)');
        clearTimeout(syncTimeout);

        // Manually trigger completion since onInitialSync won't fire for 304s
        shapesCompleted.add('items');
        shapesCompleted.add('sources');
        shapesCompleted.add('item_topics');
        shapesCompleted.add('item_likes');
        shapesSyncedCount = 4;

        syncCompleted = true;
        refreshItems();
        isSyncing = false;
        setLoading(false);
        setError(null);

        syncCompletionCallbacks.forEach(cb => cb());
        syncCompletionCallbacks = [];
      }
    } catch (err) {
      console.error('[ItemsSync] initializeItemsSync failed:', err);
      isSyncing = false;
      setLoading(false);
      setError((err as Error).message ?? String(err));
    }
  }, [refreshItems]);

  useEffect(() => {
    initializeSync();

    // Note: We don't cleanup sync state on unmount because:
    // 1. React StrictMode remounts components in dev
    // 2. We want to persist sync state across component lifecycle
    // 3. PGlite persists the synced data anyway
    return () => {
      // Only log, don't reset state
      console.log('[ItemsSync] Component unmounting (keeping sync state)');
    };
  }, [initializeSync]);

  return (
    <ItemsContext.Provider
      value={{
        ...state,
        refreshItems,
        waitForSync,
      }}
    >
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
