<script lang="ts">
  import { onMount } from 'svelte';
  import type { Item } from '$lib/stores/items';
  import { getDb } from '$lib/db';
  import { itemLikes, sources } from '$lib/schema';
  import { eq, and } from 'drizzle-orm';

  export let item: Item;

  let liked: number | null = null;
  let sourceName = 'Unknown';
  let loading = false;

  onMount(async () => {
    try {
      const db = await getDb();
      // Get the user like status
      const result = await db
        .select()
        .from(itemLikes)
        .where(and(
          eq(itemLikes.itemId, item.id),
          eq(itemLikes.userId, 'current-user') // TODO: implement real user tracking
        ))
        .limit(1);

      if (result.length > 0) {
        liked = result[0].score;
      }

      // Get source name
      const sourceResult = await db
        .select()
        .from(sources)
        .where(eq(sources.id, item.sourceId))
        .limit(1);

      if (sourceResult.length > 0) {
        sourceName = sourceResult[0].name;
      }
    } catch (err) {
      console.error('Failed to load like status:', err);
    }
  });

  async function toggleLike(score: number) {
    if (loading) return;
    loading = true;

    try {
      const db = await getDb();
      const userId = 'current-user'; // TODO: implement real user tracking

      // Check if like exists
      const existing = await db
        .select()
        .from(itemLikes)
        .where(and(
          eq(itemLikes.itemId, item.id),
          eq(itemLikes.userId, userId)
        ))
        .limit(1);

      if (existing.length > 0) {
        // Update or delete
        if (existing[0].score === score) {
          // Delete if same score clicked again (toggle off)
          await db
            .delete(itemLikes)
            .where(and(
              eq(itemLikes.itemId, item.id),
              eq(itemLikes.userId, userId)
            ));
          liked = null;
        } else {
          // Update
          await db
            .update(itemLikes)
            .set({ score, createdAt: new Date() })
            .where(and(
              eq(itemLikes.itemId, item.id),
              eq(itemLikes.userId, userId)
            ));
          liked = score;
        }
      } else {
        // Insert
        await db.insert(itemLikes).values({
          userId,
          itemId: item.id,
          score,
          createdAt: new Date(),
        } as any);
        liked = score;
      }
    } catch (err) {
      console.error('Failed to toggle like:', err);
    } finally {
      loading = false;
    }
  }

  function excerpt(text: string | null | undefined, length: number = 150): string {
    if (!text) return '';
    return text.length > length ? text.substring(0, length) + '...' : text;
  }

  function formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  function getSourceIcon(): string {
    switch (item.sourceType) {
      case 'paper':
        return '📄';
      case 'newsletter':
        return '📧';
      case 'blog':
        return '✍️';
      case 'tweet':
        return '🐦';
      default:
        return '📌';
    }
  }
</script>

<div class="card paper-card">
  <div class="paper-header">
    <div>
      <h3 class="paper-title">{item.title}</h3>
      <p class="paper-source">{getSourceIcon()} {sourceName}</p>
    </div>
  </div>

  {#if item.summary}
    <div class="paper-content">
      <p class="paper-abstract">{excerpt(item.summary, 150)}</p>
    </div>
  {/if}

  <div class="paper-footer">
    <div class="flex items-center justify-between flex-wrap gap-2">
      <span class="paper-tag">{formatDate(item.publishedAt)}</span>
      {#if item.rawMetadata?.categories}
        <span class="paper-tag">{item.rawMetadata.categories[0]}</span>
      {/if}
    </div>

    <div class="flex gap-2 mt-3">
      <button
        class="btn-secondary text-sm flex-1"
        on:click={() => window.open(item.url, '_blank')}
      >
        Open
      </button>
      <button
        class="btn text-sm px-3 py-1 {liked === 1 ? 'bg-emerald-600' : ''}"
        on:click={() => toggleLike(1)}
        disabled={loading}
      >
        👍 {liked === 1 ? '✓' : ''}
      </button>
      <button
        class="btn text-sm px-3 py-1 {liked === -1 ? 'bg-red-600' : ''}"
        on:click={() => toggleLike(-1)}
        disabled={loading}
      >
        👎 {liked === -1 ? '✓' : ''}
      </button>
    </div>
  </div>
</div>

<style>
  :global(.paper-card) {
    min-height: auto;
    padding: 1rem;
  }

  :global(.paper-header) {
    margin-bottom: 0.75rem;
  }

  :global(.paper-title) {
    font-size: 1rem;
    line-height: 1.4;
    margin: 0;
  }

  :global(.paper-source) {
    font-size: 0.875rem;
    color: rgb(148, 163, 184);
    margin-top: 0.25rem;
  }

  :global(.paper-abstract) {
    font-size: 0.875rem;
    line-height: 1.5;
    margin: 0;
  }

  :global(.paper-footer) {
    margin-top: 0.75rem;
  }

  :global(.paper-tag) {
    font-size: 0.75rem;
    background-color: rgb(51, 65, 85);
    padding: 0.25rem 0.5rem;
    border-radius: 0.25rem;
    color: rgb(226, 232, 240);
  }

  :global(.btn) {
    background-color: rgb(30, 41, 59);
    color: rgb(226, 232, 240);
    border: 1px solid rgb(71, 85, 105);
    border-radius: 0.375rem;
    padding: 0.5rem 1rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  :global(.btn:hover:not(:disabled)) {
    background-color: rgb(51, 65, 85);
    border-color: rgb(100, 116, 139);
  }

  :global(.btn-secondary) {
    background-color: rgb(37, 99, 235);
    border-color: rgb(37, 99, 235);
  }

  :global(.btn-secondary:hover:not(:disabled)) {
    background-color: rgb(29, 78, 216);
  }
</style>
