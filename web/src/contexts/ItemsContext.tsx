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
      const electricUrl = '/v1/shape';
      const electricFetchUrl = typeof window !== 'undefined'
        ? new URL(electricUrl, window.location.origin).toString()
        : electricUrl;
    setLoading(false);
    setError(null);

    // Call any waiting callbacks
    syncCompletionCallbacks.forEach(cb => cb());
    syncCompletionCallbacks = [];
  }
}

export function ItemsProvider({ children }: { children: ReactNode }) {
  const hasInitialized = useRef(false);
  const electricUrl = '/v1/shape';
  const electricFetchUrl = typeof window !== 'undefined'
    ? new URL(electricUrl, window.location.origin).toString()
    : electricUrl;
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

      // Use same-origin proxy for Electric shapes. The server should proxy
      // `/v1/shape` to the Electric container so remote browsers hit the web
      // origin rather than developer localhost.
      const electricUrl = '/v1/shape';

      const t2 = performance.now();

      // Calculate 7-day cutoff for shape filtering
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);
      const cutoffIso = sevenDaysAgo.toISOString();

        const t3 = performance.now();
      // Before creating subscriptions, ensure local PGlite isn't stale compared to server
      async function ensureLocalIsFresh(baseUrl: string, pgInstance: any) {
        try {
          const probeUrl = `${baseUrl}?offset=-1&limit=1&table=items`;
          const resp = await fetch(probeUrl);
          if (!resp.ok) return;

          const contentType = resp.headers.get('content-type') || '';
          let rows: any[] = [];

          if (contentType.includes('application/json')) {
            const json = await resp.json();
            rows = Array.isArray(json) ? json : (json?.rows ?? []);
          } else {
            // Fallback to NDJSON or line-delimited JSON where each line is { "value": {...} }
            const text = await resp.text();
            rows = text.trim().split('\n').filter(Boolean).map(line => {
              try {
                const parsed = JSON.parse(line);
                return parsed?.value ?? parsed;
              } catch (e) {
                return null;
              }
            }).filter(Boolean);
          }

          console.log('[ItemsSync] ensureLocalIsFresh server response:', { contentType, rowCount: rows.length, sample: rows[0] });
          if (!rows.length) return;

          // Take last row as the most recent in the probe
          const serverRow = rows[rows.length - 1];
          const serverIso = serverRow?.published_at ?? serverRow?.created_at ?? serverRow?.publishedAt ?? serverRow?.createdAt ?? null;
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

      // Add timeout to prevent infinite spinner (shorter for slow/latency networks)
      const syncTimeout = setTimeout(() => {
        (async () => {
          const elapsedSec = ((performance.now() - t0) / 1000).toFixed(1);
          console.warn(`[ItemsSync] Sync timeout after ${elapsedSec}s`);
          if (syncCompleted) return;

          async function shapeReachable(table: string) {
            const url = `${electricUrl}?offset=-1&table=${encodeURIComponent(table)}&limit=10`;
            for (let attempt = 0; attempt < 2; attempt++) {
              try {
                const controller = new AbortController();
                const id = setTimeout(() => controller.abort(), 4000);
                const r = await fetch(url, { signal: controller.signal });
                clearTimeout(id);
                if (r.ok) return true;
              } catch (e) {
                // ignore and retry
              }
              await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
            }
            return false;
          }

          if (shapesSyncedCount === 0) {
            // If no shapes progressed, probe the shape endpoints before deciding
            const tables = ['items', 'sources', 'item_topics', 'item_likes'];
            const results = await Promise.all(tables.map(t => shapeReachable(t)));
            const anyReachable = results.some(Boolean);
            if (!anyReachable) {
              console.warn('[ItemsSync] No shapes progressed and none reachable; marking sync complete to avoid blocking UI');
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
              console.warn('[ItemsSync] Shape endpoints reachable; keeping sync running in background and clearing loading state');
              setLoading(false);
            }
          } else {
            console.warn('[ItemsSync] Partial progress detected; keeping sync running in background and clearing loading state');
            setLoading(false);
          }
        })();
      }, 8000);

      // Use the official syncShapesToTables API (plural) for syncing multiple tables
      console.log('[ItemsSync] Starting multi-table sync with syncShapesToTables');

      const syncResult = await (pg as any).electric.syncShapesToTables({
        key: 'items-sync', // Persist sync state across sessions
        shapes: {
          items: {
            shape: {
              url: `${electricFetchUrl}?offset=-1`,
              params: {
                table: 'items',
                limit: 200,
                where: `(published_at >= '${cutoffIso}' OR created_at >= '${cutoffIso}')`,
              },
            },
            table: 'items',
            primaryKey: ['id'],
          },
          sources: {
            shape: {
              url: electricFetchUrl,
              params: {
                table: 'sources',
              },
            },
            table: 'sources',
            primaryKey: ['id'],
          },
          item_topics: {
            shape: {
              url: electricFetchUrl,
              params: {
                table: 'item_topics',
              },
            },
            table: 'item_topics',
            primaryKey: ['id'],
          },
          item_likes: {
            shape: {
              url: electricFetchUrl,
              params: {
                table: 'item_likes',
              },
            },
            table: 'item_likes',
            primaryKey: ['id'],
          },
        },
        onInitialSync: () => {
          try {
            console.log('[ItemsSync] ALL shapes initial sync complete!');
            clearTimeout(syncTimeout);

            // Mark all shapes as synced
            shapesCompleted.add('items');
            shapesCompleted.add('sources');
            shapesCompleted.add('item_topics');
            shapesCompleted.add('item_likes');
            shapesSyncedCount = totalShapesToSync;

            syncCompleted = true;
            refreshItems();
            isSyncing = false;
            setLoading(false);
            setError(null);

            // Call any waiting callbacks
            syncCompletionCallbacks.forEach(cb => cb());
            syncCompletionCallbacks = [];
          } catch (e) {
            console.warn('[ItemsSync] onInitialSync handler failed:', e);
          }
        },
        onError: async (error: unknown) => {
          console.error('[ItemsSync] Global sync error:', error);
          if (error instanceof Error) {
            console.error('[ItemsSync] Error stack:', error.stack);
          }
          const errStr = (error as any)?.message ?? String(error);
          setError(errStr);

          // Comprehensive 409 / must-refetch detection
          try {
            const anyStatus = (error as any)?.status ?? (error as any)?.response?.status ?? null;
            const is409 = anyStatus === 409 || String(error).includes('409') || String(error).toLowerCase().includes('must-refetch');
            if (is409) {
              console.warn('[ItemsSync] Detected 409/must-refetch from Electric, forcing local DB reset');
              try {
                await ensureLocalIsFresh(electricFetchUrl, pg);
                // after clearing local DB, reload to reinitialize sync from fresh snapshot
                window.location.reload();
              } catch (e) {
                console.warn('[ItemsSync] ensureLocalIsFresh failed during onError handling:', e);
              }
            }
          } catch (e) {
            console.warn('[ItemsSync] onError post-check failed:', e);
          }
        },
      });

      // If the sync API exposes a `synced` promise, await it to mark completion
      try {
        if (syncResult && typeof (syncResult as any).synced?.then === 'function') {
          console.log('[ItemsSync] waiting for syncResult.synced promise');
          try {
            await (syncResult as any).synced;
            console.log('[ItemsSync] syncResult.synced resolved');
            clearTimeout(syncTimeout);

            // Mark as completed similar to onInitialSync
            shapesCompleted.add('items');
            shapesCompleted.add('sources');
            shapesCompleted.add('item_topics');
            shapesCompleted.add('item_likes');
            shapesSyncedCount = totalShapesToSync;

            syncCompleted = true;
            refreshItems();
            isSyncing = false;
            setLoading(false);
            setError(null);
            syncCompletionCallbacks.forEach(cb => cb());
            syncCompletionCallbacks = [];
          } catch (e) {
            console.warn('[ItemsSync] syncResult.synced rejected:', e);
          }
        }
      } catch (e) {
        console.warn('[ItemsSync] error handling syncResult.synced:', e);
      }

      shapeSubscriptions['all'] = syncResult;

      const t4 = performance.now();
      console.log(`[ItemsSync] Shapes subscribed successfully (elapsed: ${(t4 - t0).toFixed(0)}ms)`);

      // Fallback: if onInitialSync doesn't fire for some reason, clear loading
      // so the UI doesn't stay stuck on a spinner. Sync continues in background.
      try {
        setLoading(false);
        setError(null);
        await refreshItems();
      } catch (e) {
        console.warn('[ItemsSync] fallback refresh after subscribe failed:', e);
      }

      // Stronger fallback: mark sync as completed and resolve any waiters
      // so the UI won't block waiting for an onInitialSync that may never fire
      // for resumed syncs. Background sync continues.
      try {
        if (!syncCompleted) {
          console.log('[ItemsSync] Applying subscribe fallback: marking sync completed to unblock UI');
          shapesCompleted.add('items');
          shapesCompleted.add('sources');
          shapesCompleted.add('item_topics');
          shapesCompleted.add('item_likes');
          shapesSyncedCount = totalShapesToSync;

          syncCompleted = true;
          isSyncing = false;
          setLoading(false);
          setError(null);
          // best-effort refresh
          refreshItems().catch(() => {});

          syncCompletionCallbacks.forEach(cb => cb());
          syncCompletionCallbacks = [];
        }
      } catch (e) {
        console.warn('[ItemsSync] subscribe fallback marking sync completed failed:', e);
      }

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
