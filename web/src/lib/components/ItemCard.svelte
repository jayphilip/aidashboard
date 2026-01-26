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
    if (text.length <= length) return text;
    // Try to break at a word boundary
    const truncated = text.substring(0, length);
    const lastSpace = truncated.lastIndexOf(' ');
    return (lastSpace > length * 0.8 ? truncated.substring(0, lastSpace) : truncated) + '...';
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
    <div class="flex items-start gap-2 mb-2">
      <div class="flex-1 min-w-0">
        <h3 class="paper-title">{item.title}</h3>
      </div>
      <div class="flex items-center gap-1.5 flex-shrink-0">
        {#if item.rawMetadata?.categories}
          <span class="paper-category-badge">{item.rawMetadata.categories[0]}</span>
        {/if}
        <span class="paper-source-type">
          {item.sourceType === 'paper' ? 'Paper'
            : item.sourceType === 'tweet' ? 'Social'
            : item.sourceType === 'blog' ? 'Blog'
            : item.sourceType === 'newsletter' ? 'Newsletter'
            : 'Other'}
        </span>
      </div>
    </div>
    <p class="paper-source">{getSourceIcon()} {sourceName}</p>
  </div>

  {#if item.summary}
    <div class="paper-content">
      <p class="paper-abstract">{excerpt(item.summary, 150)}</p>
    </div>
  {/if}

  <div class="paper-footer">
    <div class="flex items-center justify-between gap-2">
      <span class="paper-date">{formatDate(item.publishedAt)}</span>

      <div class="flex gap-1.5">
        <button
          class="btn-icon {liked === 1 ? 'btn-liked' : ''}"
          on:click={() => toggleLike(1)}
          disabled={loading}
          title="Like"
        >
          👍
        </button>
        <button
          class="btn-icon {liked === -1 ? 'btn-disliked' : ''}"
          on:click={() => toggleLike(-1)}
          disabled={loading}
          title="Dislike"
        >
          👎
        </button>
        <button
          class="btn-primary"
          on:click={() => window.open(item.url, '_blank')}
        >
          Open
        </button>
      </div>
    </div>
  </div>
</div>

<style>
  :global(.paper-card) {
    min-height: auto;
    height: fit-content;
    padding: 0.875rem;
    background: rgb(30, 41, 59);
    border: 1px solid rgb(51, 65, 85);
    border-radius: 0.375rem;
    transition: all 0.2s;
  }

  :global(.paper-card:hover) {
    border-color: rgb(71, 85, 105);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  :global(.paper-header) {
    margin-bottom: 0.5rem;
  }

  :global(.paper-title) {
    font-size: 0.9375rem;
    font-weight: 600;
    line-height: 1.4;
    margin: 0;
    color: rgb(241, 245, 249);
  }

  :global(.paper-source) {
    font-size: 0.8125rem;
    color: rgb(148, 163, 184);
    margin: 0;
  }

  :global(.paper-category-badge) {
    font-size: 0.65rem;
    background-color: rgb(71, 85, 105);
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    color: rgb(203, 213, 225);
    white-space: nowrap;
    font-weight: 500;
    flex-shrink: 0;
    display: inline-block;
  }

  :global(.paper-source-type) {
    font-size: 0.65rem;
    background-color: rgba(15, 23, 42, 0.6);
    padding: 0.15rem 0.4rem;
    border-radius: 0.25rem;
    color: rgb(203, 213, 225);
    font-weight: 600;
    white-space: nowrap;
    flex-shrink: 0;
    display: inline-block;
  }

  :global(.paper-content) {
    margin-bottom: 0;
    flex-shrink: 0;
    height: auto;
  }

  :global(.paper-abstract) {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
    color: rgb(203, 213, 225);
  }

  :global(.paper-footer) {
    margin-top: 0.5rem;
    padding-top: 0.5rem;
    border-top: 1px solid rgb(51, 65, 85);
  }

  :global(.paper-date) {
    font-size: 0.6875rem;
    color: rgb(148, 163, 184);
    font-weight: 500;
  }

  :global(.btn-icon) {
    background-color: rgb(51, 65, 85);
    color: rgb(226, 232, 240);
    border: 1px solid rgb(71, 85, 105);
    border-radius: 0.25rem;
    padding: 0.375rem 0.625rem;
    cursor: pointer;
    font-size: 0.9375rem;
    transition: all 0.2s;
    line-height: 1;
  }

  :global(.btn-icon:hover:not(:disabled)) {
    background-color: rgb(71, 85, 105);
    border-color: rgb(100, 116, 139);
  }

  :global(.btn-icon:disabled) {
    opacity: 0.5;
    cursor: not-allowed;
  }

  :global(.btn-liked) {
    background-color: rgb(5, 150, 105);
    border-color: rgb(5, 150, 105);
  }

  :global(.btn-disliked) {
    background-color: rgb(220, 38, 38);
    border-color: rgb(220, 38, 38);
  }

  :global(.btn-primary) {
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.25rem;
    padding: 0.375rem 0.75rem;
    cursor: pointer;
    font-size: 0.8125rem;
    font-weight: 500;
    transition: all 0.2s;
  }

  :global(.btn-primary:hover) {
    background-color: rgb(37, 99, 235);
  }
</style>
