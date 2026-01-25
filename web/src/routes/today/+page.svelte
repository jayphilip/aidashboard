<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeItemsSync, cleanupItemsSync, getRecentItems } from '$lib/stores/items';
  import { rankItems } from '$lib/scoring';
  import type { Item } from '$lib/stores/items';
  import ItemCard from '$lib/components/ItemCard.svelte';

  let papers: Item[] = [];
  let newsletters: Item[] = [];
  let tweets: Item[] = [];
  let loading = true;
  let error: string | null = null;

  onMount(async () => {
    try {
      await initializeItemsSync();

      // Wait a moment for sync to complete
      await new Promise(resolve => setTimeout(resolve, 500));

      // Load items from the last 24 hours by type
      const recentItems = await getRecentItems(24);

      papers = recentItems.filter(item => item.sourceType === 'paper');
      newsletters = recentItems.filter(
        item => item.sourceType === 'newsletter' || item.sourceType === 'blog'
      );
      tweets = recentItems.filter(item => item.sourceType === 'tweet');

      // Rank items by score
      papers = rankItems(papers).map(r => r.item);
      newsletters = rankItems(newsletters).map(r => r.item);
      tweets = rankItems(tweets).map(r => r.item);

      loading = false;
    } catch (err) {
      console.error('Failed to load items:', err);
      // Don't show error - items table might just be empty
      loading = false;
    }

    return () => {
      cleanupItemsSync();
    };
  });
</script>

<div class="min-h-screen bg-slate-950 text-slate-50 p-6">
  <div class="max-w-full mx-auto">
    <h1 class="text-4xl font-bold mb-8">Today's AI News</h1>

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <p class="text-slate-400">Loading items...</p>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
        <p class="text-red-400">Error: {error}</p>
      </div>
    {/if}

    {#if !loading && papers.length === 0 && newsletters.length === 0 && tweets.length === 0}
      <div class="bg-slate-900 border border-slate-700 rounded-lg p-6 text-center">
        <p class="text-slate-400 mb-2">No items synced yet</p>
        <p class="text-slate-500 text-sm">Run the backend ingestor to populate data from sources, then it will appear here.</p>
      </div>
    {/if}

    <div class="grid grid-cols-1 md:grid-cols-3 gap-6" class:hidden={!loading && papers.length === 0 && newsletters.length === 0 && tweets.length === 0}>
      <!-- Papers Lane -->
      <div class="flex flex-col">
        <h2 class="text-2xl font-semibold mb-4 text-blue-400">📄 Papers</h2>
        <div class="space-y-4 flex-1">
          {#if papers.length === 0}
            <p class="text-slate-400 text-center py-8">No papers today</p>
          {/if}
          {#each papers as item (item.id)}
            <ItemCard {item} />
          {/each}
        </div>
      </div>

      <!-- Newsletters/Blogs Lane -->
      <div class="flex flex-col">
        <h2 class="text-2xl font-semibold mb-4 text-emerald-400">📰 Newsletters & Blogs</h2>
        <div class="space-y-4 flex-1">
          {#if newsletters.length === 0}
            <p class="text-slate-400 text-center py-8">No newsletters/blogs today</p>
          {/if}
          {#each newsletters as item (item.id)}
            <ItemCard {item} />
          {/each}
        </div>
      </div>

      <!-- Social Lane -->
      <div class="flex flex-col">
        <h2 class="text-2xl font-semibold mb-4 text-purple-400">🐦 Social</h2>
        <div class="space-y-4 flex-1">
          {#if tweets.length === 0}
            <p class="text-slate-400 text-center py-8">No tweets yet</p>
          {/if}
          {#each tweets as item (item.id)}
            <ItemCard {item} />
          {/each}
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: rgb(15, 23, 42);
  }

  :global(.hidden) {
    display: none;
  }
</style>
