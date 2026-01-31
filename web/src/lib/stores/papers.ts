// web/src/lib/stores/papers.ts
import { writable, type Readable } from 'svelte/store';
import type { InferSelectModel } from 'drizzle-orm';
import { desc } from 'drizzle-orm';
import { getPGlite, getDb } from '$lib/db';
import { papers } from '$lib/schema';

const ELECTRIC_URL = import.meta.env.PUBLIC_ELECTRIC_URL || 'http://localhost:3000';

export type Paper = InferSelectModel<typeof papers>;

type PapersState = {
  loading: boolean;
  error: string | null;
};

const papersStore = writable<Paper[]>([]);
const stateStore = writable<PapersState>({ loading: false, error: null });

export const papers$: Readable<Paper[]> = { subscribe: papersStore.subscribe };
export const papersState: Readable<PapersState> = { subscribe: stateStore.subscribe };

let shapeSubscription: { unsubscribe: () => void } | null = null;

async function refreshPapersFromDb() {
  const db = await getDb();

  const rows = await db
    .select()
    .from(papers)
    .orderBy(desc(papers.createdAt)); // newest first

  papersStore.set(rows);
}

/**
 * Hydrate PGlite from Electric and expose data via Svelte store.
 */
export async function initializePapersSync() {
  if (shapeSubscription) return; // already started

  stateStore.set({ loading: true, error: null });

  try {
    const pg = await getPGlite();
    const db = await getDb();

    // Start syncing `papers` shape into local `papers` table
    const shape = await (pg as any).electric.syncShapeToTable({
      shape: {
        url: `${ELECTRIC_URL}/v1/shape`,
        params: {
          table: 'papers',
          offset: -1,
          subset__order_by: 'created_at DESC',
          subset__limit: 100,
        },
      },
      table: 'papers',
      primaryKey: ['id'],
      shapeKey: 'papers',
      onError: (error: unknown) => {
        console.error('papers shape sync error', error);
        stateStore.set({
          loading: false,
          error: (error as Error).message ?? String(error),
        });
      },
    });

    shapeSubscription = shape;

    // Wait briefly for initial snapshot to apply, then read from PGlite
    setTimeout(async () => {
      try {
        // Quick sanity check (optional)
        const countResult = await pg.query<{ count: number }>(
          'SELECT COUNT(*)::int AS count FROM papers;'
        );
        console.log(
          'PGlite papers count:',
          countResult.rows[0]?.count
        );

        await refreshPapersFromDb();
        stateStore.set({ loading: false, error: null });
      } catch (err) {
        console.error('refreshPapersFromDb failed', err);
        stateStore.set({
          loading: false,
          error: (err as Error).message ?? String(err),
        });
      }
    }, 1000);
  } catch (err) {
    console.error('initializePapersSync failed', err);
    stateStore.set({
      loading: false,
      error: (err as Error).message ?? String(err),
    });
  }
}

export function cleanupPapersSync() {
  shapeSubscription?.unsubscribe();
  shapeSubscription = null;
}
