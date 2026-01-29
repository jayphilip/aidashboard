<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { initializeItemsSync, cleanupItemsSync, getRecentItems, searchItems, itemsState, waitForSyncCompletion } from '$lib/stores/items';
  import { rankItems } from '$lib/scoring';
  import { paramsToFilters, filtersToParams } from '$lib/utils/urlParams';
  import type { Item, SearchOptions } from '$lib/stores/items';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import CollapsibleSidebar from '$lib/components/CollapsibleSidebar.svelte';
  import PaginationControls from '$lib/components/PaginationControls.svelte';

  // UI state (initialized for SSR)
  let loading: boolean = true;
  let error: string | null = null;

  // Filter and pagination state
  let filters: SearchOptions = {};
  let currentPage = 1;
  let hasMore = false;
  let allLoadedItems: Item[] = [];  // Accumulator across pages
  let displayedItems: Item[] = [];   // What's currently shown

  // Keep UI state in sync with the itemsState store (SSR-safe)
  $: {
    const s = $itemsState ?? { loading: true, error: null };
    loading = s.loading;
    error = s.error;
  }

  // Load and filter items from the DB (via stores helpers) with pagination support
  async function loadAndFilterItems(pageNum: number = 1, append: boolean = false) {
    try {
      console.debug('[TodayPage] loadAndFilterItems start, page:', pageNum, 'filters ->', filters);
      const pageSize = 50;
      const offset = (pageNum - 1) * pageSize;
      const hasActiveFilters = !!(filters.query || (filters.sourceTypes && filters.sourceTypes.length) || (filters.topics && filters.topics.length) || filters.dateRange);

      // Fetch items based on active filters
      let newItems: Item[] = [];
      if (hasActiveFilters) {
        newItems = await searchItems({ ...filters, limit: pageSize, offset });
      } else {
        // No filters: get recent items from last 168 hours (7 days)
        newItems = await getRecentItems(168, pageSize, offset);
      }

      // Rank the new items
      const rankedNew = rankItems(newItems).map(r => r.item);

      // Append or replace
      if (append) {
        allLoadedItems = [...allLoadedItems, ...rankedNew];
      } else {
        allLoadedItems = rankedNew;
      }

      displayedItems = allLoadedItems;
      hasMore = newItems.length === pageSize;
      currentPage = pageNum;

      // Update URL with page number if not first page
      if (pageNum > 1) {
        const params = filtersToParams({ ...filters, page: pageNum });
        await goto(`/today?${params.toString()}`, { replaceState: true });
      }
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

    // Reset pagination when filters change
    currentPage = 1;
    allLoadedItems = [];
    displayedItems = [];

    const params = filtersToParams(filters);
    const newUrl = params.toString() ? `/today?${params.toString()}` : '/today';
    await goto(newUrl, { replaceState: true });
    await loadAndFilterItems(1, false);
  }

  async function handleLoadMore() {
    await loadAndFilterItems(currentPage + 1, true);
  }

  onMount(() => {
    (async () => {
      try {
        await initializeItemsSync();
        await waitForSyncCompletion();

        // Initialize filters and page from URL params
        filters = paramsToFilters($page.url.searchParams);
        currentPage = filters.page || 1;

        await loadAndFilterItems(currentPage, false);
      } catch (err) {
        console.error('Failed to initialize:', err);
        error = (err as Error)?.message ?? String(err);
      }
    })();

    return () => {
      cleanupItemsSync();
    };
  });


</script>

<div class="min-h-screen bg-slate-950 text-slate-50">
  <!-- Loading overlay: covers content but does not remove it from DOM -->
  {#if loading}
    <div class="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 pointer-events-auto">
      <div class="flex flex-col items-center">
        <svg class="h-8 w-8 text-blue-400 mb-4 spinner-fast" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
        </svg>
        <p class="text-slate-400 text-lg">Loading items...</p>
      </div>
    </div>
  {/if}

  {#if !loading}
    <div class="flex h-screen overflow-hidden">
      <!-- Collapsible Sidebar: Filters -->
      <CollapsibleSidebar
        {filters}
        onFiltersChange={handleFiltersChange}
        showLikeStatusFilter={false}
      />

      <!-- Main Content: Items Grid -->
      <main class="flex-1 overflow-y-auto p-4 sm:p-6 pb-32 sm:pb-6">
        {#if error}
          <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6 max-w-6xl">
            <p class="text-red-400">Error: {error}</p>
          </div>
        {/if}

        {#if displayedItems.length === 0}
          <div class="bg-slate-900 border border-slate-700 rounded-lg p-6 text-center max-w-6xl">
            <p class="text-slate-400 mb-2">No items found</p>
            <p class="text-slate-500 text-sm">Run the backend ingestor to populate data from sources, or adjust your filters.</p>
          </div>
        {/if}

        <!-- Mosaic/Grid layout for all items -->
        {#if displayedItems.length > 0}
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl">
            {#each displayedItems as item (item.id)}
              <div>
                <ItemCard {item} />
              </div>
            {/each}
          </div>

          <!-- Pagination controls -->
          <PaginationControls
            {currentPage}
            itemsOnPage={displayedItems.length}
            pageSize={50}
            {loading}
            {hasMore}
            on:loadmore={handleLoadMore}
          />
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

  .spinner-fast {
    animation: spin 0.6s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
