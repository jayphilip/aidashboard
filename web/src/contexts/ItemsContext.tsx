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

export function ItemsProvider({ children }: { children: ReactNode }) {
  const hasInitialized = useRef(false);
  const [state, setState] = useState<ItemsState>({
    loading: true,
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

  // Clear IndexedDB databases
  const clearLocalDB = async () => {
    try {
      if ((indexedDB as any)?.databases) {
        const dbs = await (indexedDB as any).databases();
        await Promise.all(dbs.map((d: any) => {
          const name: string = d.name ?? '';
          if (/pglite|electric|aidashboard/i.test(name)) {
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
          new Promise<void>(r => { const rq = indexedDB.deleteDatabase('pglite'); rq.onsuccess = r; rq.onerror = r; }),
          new Promise<void>(r => { const rq = indexedDB.deleteDatabase('electric'); rq.onsuccess = r; rq.onerror = r; }),
        ]);
      }
      console.log('[ItemsSync] IndexedDB cleared');
    } catch (err) {
      console.warn('[ItemsSync] Error deleting IndexedDB:', err);
    }
  };

  // Ensure local DB is fresh compared to server
  const ensureLocalIsFresh = async (pgInstance: any) => {
    try {
      const probeUrl = `${window.location.origin}/v1/shape?table=items&offset=-1`;
      console.log('[ItemsSync] Probing:', probeUrl);
      
      const resp = await fetch(probeUrl);
      if (!resp.ok) {
        console.log('[ItemsSync] Server probe failed:', resp.status);
        return;
      }

      // Electric returns JSON array: [{"key":"...","value":{...}}, ...]
      const data = await resp.json();
      console.log('[ItemsSync] Response type:', Array.isArray(data) ? 'array' : 'object', 'length:', data?.length);
      
      if (!Array.isArray(data) || data.length === 0) {
        console.log('[ItemsSync] No data in response');
        return;
      }

      // Extract values from array of {key, value} objects
      const rows = data.map((item: any) => item.value).filter(Boolean);
      
      console.log('[ItemsSync] Parsed rows:', { 
        totalItems: data.length,
        rowCount: rows.length, 
        firstRow: rows[0],
        lastRow: rows[rows.length - 1]
      });

      if (rows.length === 0) {
        console.log('[ItemsSync] No valid rows parsed');
        return;
      }

      // Get the newest row (last in response)
      const serverRow = rows[rows.length - 1];
      const serverIso = serverRow?.published_at ?? serverRow?.created_at ?? null;
      
      if (!serverIso) {
        console.log('[ItemsSync] No timestamp in server row, fields:', Object.keys(serverRow || {}));
        return;
      }
      
      const serverMax = new Date(serverIso).getTime();

      // Check local max timestamp
      const localRes = await pgInstance.query(
        "SELECT max(COALESCE(published_at, created_at))::text AS max_date FROM items;"
      );
      const localIso = localRes?.rows?.[0]?.max_date ?? null;
      const localMax = localIso ? new Date(localIso).getTime() : 0;

      console.log('[ItemsSync] Timestamp comparison:', { 
        serverIso, 
        localIso, 
        serverMax,
        localMax,
        deltaMs: serverMax - localMax 
      });

      // If server is newer by >60s, reset local DB
      if (serverMax - localMax > 60_000) {
        console.warn('[ItemsSync] Server has newer data, resetting (delta ms):', serverMax - localMax);
        await clearLocalDB();
        window.location.reload();
      } else {
        console.log('[ItemsSync] Local DB is up to date (or newer)');
      }
    } catch (err) {
      console.error('[ItemsSync] ensureLocalIsFresh error:', err);
    }
  };

  const initializeSync = useCallback(async () => {
    if (hasInitialized.current) {
      console.log('[ItemsSync] Already initialized, skipping');
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

    hasInitialized.current = true;
    isSyncing = true;
    setError(null);

    try {
      const t0 = performance.now();
      console.log('[ItemsSync] Initializing sync...');

      const pg = await getPGlite();
      console.log(`[ItemsSync] PGlite initialized in ${(performance.now() - t0).toFixed(0)}ms`);

      // Initialize database schema BEFORE starting sync
      await getDb();
      console.log(`[ItemsSync] Database schema ready in ${(performance.now() - t0).toFixed(0)}ms`);

      // Ensure local DB isn't stale
      await ensureLocalIsFresh(pg);

      // Calculate 7-day cutoff
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      sevenDaysAgo.setUTCHours(0, 0, 0, 0);
      const cutoffIso = sevenDaysAgo.toISOString();

      console.log('[ItemsSync] Starting multi-table sync');

      // Timeout fallback to prevent infinite spinner
      const syncTimeout = setTimeout(() => {
        if (!syncCompleted) {
          console.warn('[ItemsSync] Sync timeout reached, unblocking UI');
          completeSyncFlow();
        }
      }, 15000); // Increased to 15s for initial load

      // Use absolute URL with proper origin
      const baseUrl = typeof window !== 'undefined'
        ? `${window.location.origin}/v1/shape`
        : '/v1/shape';

      console.log('[ItemsSync] Using base URL:', baseUrl);

      // Helper to complete sync flow
      function completeSyncFlow() {
        if (syncCompleted) return;
        
        console.log('[ItemsSync] Completing sync flow');
        syncCompleted = true;
        isSyncing = false;
        setLoading(false);
        setError(null);
        
        refreshItems().catch(err => 
          console.warn('[ItemsSync] Refresh after sync failed:', err)
        );
        
        syncCompletionCallbacks.forEach(cb => cb());
        syncCompletionCallbacks = [];
      }

      // Start sync
      const syncResult = await (pg as any).electric.syncShapesToTables({
        key: 'items-sync',
        shapes: {
          items: {
            shape: {
              url: baseUrl,
              params: {
                table: 'items',
                where: `published_at >= '${cutoffIso}' OR created_at >= '${cutoffIso}'`,
              },
            },
            table: 'items',
            primaryKey: ['id'],
          },
          sources: {
            shape: {
              url: baseUrl,
              params: {
                table: 'sources',
              },
            },
            table: 'sources',
            primaryKey: ['id'],
          },
          item_topics: {
            shape: {
              url: baseUrl,
              params: {
                table: 'item_topics',
              },
            },
            table: 'item_topics',
            primaryKey: ['id'],
          },
          item_likes: {
            shape: {
              url: baseUrl,
              params: {
                table: 'item_likes',
              },
            },
            table: 'item_likes',
            primaryKey: ['id'],
          },
        },
        onInitialSync: () => {
          console.log('[ItemsSync] Initial sync complete!');
          clearTimeout(syncTimeout);
          completeSyncFlow();
        },
        onError: async (error: unknown) => {
          console.error('[ItemsSync] Sync error:', error);
          console.error('[ItemsSync] Error details:', {
            type: typeof error,
            keys: Object.keys(error || {}),
            message: (error as any)?.message,
            full: JSON.stringify(error, null, 2)
          });
          
          clearTimeout(syncTimeout);
          
          const errStr = (error as any)?.message ?? String(error);
          const errorObj = error as any;
          
          const anyStatus = errorObj?.status ?? 
                           errorObj?.response?.status ?? 
                           errorObj?.statusCode;
          
          const errorMessage = errStr.toLowerCase();
          const is409 = anyStatus === 409 || 
                       anyStatus === '409' ||
                       errorMessage.includes('409') || 
                       errorMessage.includes('conflict') ||
                       errorMessage.includes('must-refetch') ||
                       errorMessage.includes('expired');

          console.log('[ItemsSync] Error analysis:', { anyStatus, is409, errorMessage });

          if (is409) {
            console.warn('[ItemsSync] Detected 409 - clearing local cache');
            await clearLocalDB();
            await new Promise(r => setTimeout(r, 100));
            window.location.reload();
          } else {
            setError(errStr);
            isSyncing = false;
            setLoading(false);
          }
        },
      });

      console.log('[ItemsSync] Shapes subscribed successfully');
      shapeSubscriptions['all'] = syncResult;

      // Check if already up-to-date (resumed from cache)
      if (syncResult?.isUpToDate) {
        console.log('[ItemsSync] Already up-to-date (resumed from cache)');
        clearTimeout(syncTimeout);
        completeSyncFlow();
      }

    } catch (err) {
      console.error('[ItemsSync] Initialization failed:', err);
      isSyncing = false;
      setLoading(false);
      setError((err as Error).message ?? String(err));
    }
  }, [refreshItems]);

  useEffect(() => {
    initializeSync();

    return () => {
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
