<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { initializeItemsSync, cleanupItemsSync, getRecentItems, searchItems, itemsState } from '$lib/stores/items';
  import { rankItems } from '$lib/scoring';
  import { paramsToFilters, filtersToParams } from '$lib/utils/urlParams';
  import type { Item, SearchOptions } from '$lib/stores/items';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import FilterPanel from '$lib/components/filters/FilterPanel.svelte';

  // UI state (initialized for SSR)
  let loading: boolean = true;
  let error: string | null = null;

  // Filter and item buckets
  let filters: SearchOptions = {};
  let papers: Item[] = [];
  let newsletters: Item[] = [];
  let blogs: Item[] = [];
  let tweets: Item[] = [];
  let allItems: Item[] = [];

  // Keep UI state in sync with the itemsState store (SSR-safe)
  $: {
    const s = $itemsState ?? { loading: true, error: null };
    loading = s.loading;
    error = s.error;
  }

  // Load and filter items from the DB (via stores helpers)
  async function loadAndFilterItems() {
    try {
      console.debug('[TodayPage] loadAndFilterItems start, filters ->', filters);
      const hasActiveFilters = !!(filters.query || (filters.sourceTypes && filters.sourceTypes.length) || (filters.topics && filters.topics.length) || filters.dateRange);

      // Fetch items based on active filters
      // Estimate limit: if filtering by single source type, fetch 150 (to account for ranking variance)
      // Otherwise fetch 200 to handle multi-type filtering
      let fetchLimit = 200;
      if (filters.sourceTypes && filters.sourceTypes.length === 1) {
        fetchLimit = 150;
      }

      let filteredItems: Item[] = [];
      if (hasActiveFilters) {
        filteredItems = await searchItems({ ...filters, limit: fetchLimit });
      } else {
        // No filters: get recent items from last 168 hours (7 days), limit to 100
        filteredItems = (await getRecentItems(168)).slice(0, 100);
      }

      // Categorize items by source type
      papers = filteredItems.filter(i => i.sourceType === 'paper');
      newsletters = filteredItems.filter(i => i.sourceType === 'newsletter');
      blogs = filteredItems.filter(i => i.sourceType === 'blog');
      tweets = filteredItems.filter(i => i.sourceType === 'tweet');

      // Rank items within each category with per-category limits
      // This ensures fast performance even with many items per category
      papers = rankItems(papers).map(r => r.item).slice(0, 25);
      newsletters = rankItems(newsletters).map(r => r.item).slice(0, 50);
      blogs = rankItems(blogs).map(r => r.item).slice(0, 50);
      tweets = rankItems(tweets).map(r => r.item).slice(0, 50);
    } catch (err) {
      console.error('Failed to load items:', err);
      error = (err as Error)?.message ?? String(err);
    }
  }

  async function handleFiltersChange(newFilters: SearchOptions) {
    console.debug('[TodayPage] handleFiltersChange ->', newFilters);
    // Check if filters actually changed to avoid unnecessary reloads
    const filtersChanged =
      JSON.stringify(newFilters) !== JSON.stringify(filters);

    if (!filtersChanged) {
      console.debug('[TodayPage] Filters unchanged, skipping reload');
      return;
    }

    filters = newFilters;
    const params = filtersToParams(filters);
    const newUrl = params.toString() ? `/today?${params.toString()}` : '/today';
    await goto(newUrl, { replaceState: true });
    await loadAndFilterItems();
  }

  onMount(async () => {
    try {
      await initializeItemsSync();
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadAndFilterItems();
    } catch (err) {
      console.error('Failed to initialize:', err);
      error = (err as Error)?.message ?? String(err);
    }

    return () => {
      cleanupItemsSync();
    };
  });

  // Combine all items into a single array, sorted by date (newest first)
  $: allItems = [
    ...papers.map(i => ({ ...i })),
    ...newsletters.map(i => ({ ...i })),
    ...blogs.map(i => ({ ...i })),
    ...tweets.map(i => ({ ...i })),
  ].sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());

</script>

<div class="min-h-screen bg-slate-950 text-slate-50">
  <!-- Loading overlay: covers content but does not remove it from DOM -->
  {#if loading}
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 pointer-events-auto">
      <div class="flex flex-col items-center">
        <svg class="animate-spin h-8 w-8 text-blue-400 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p class="text-slate-400 text-lg">Loading items...</p>
      </div>
    </div>
  {/if}

  {#if !loading}
    <div class="flex h-screen">
      <!-- Left Sidebar: Filters -->
      <aside class="w-80 bg-slate-900/50 border-r border-slate-700/50 overflow-y-scroll p-6">
        <h1 class="text-2xl font-bold mb-6">Recent AI News</h1>
        <FilterPanel
          {filters}
          onFiltersChange={handleFiltersChange}
          showLikeStatusFilter={false}
        />
      </aside>

      <!-- Main Content: Items Grid -->
      <main class="flex-1 overflow-y-auto p-6">
        {#if error}
          <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 max-w-6xl">
            <p class="text-red-400">Error: {error}</p>
          </div>
        {/if}

        {#if papers.length === 0 && newsletters.length === 0 && blogs.length === 0 && tweets.length === 0}
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-6 text-center max-w-6xl">
            <p class="text-slate-400 mb-2">No items found</p>
            <p class="text-slate-500 text-sm">Run the backend ingestor to populate data from sources, or adjust your filters.</p>
          </div>
        {/if}

        <!-- Mosaic/Grid layout for all items -->
        {#if papers.length > 0 || newsletters.length > 0 || blogs.length > 0 || tweets.length > 0}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
            {#each allItems as item (item.id)}
              <div>
                <ItemCard {item} />
              </div>
            {/each}
          </div>
        {/if}
      </main>
    </div>
  {/if}
</div>

<style>
  :global(body) {
    background-color: rgb(15, 23, 42);
  }

  :global(.hidden) {
    display: none;
  }
</style>
