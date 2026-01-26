<script lang="ts">
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';
  import { initializeItemsSync, cleanupItemsSync, searchItems } from '$lib/stores/items';
  import { paramsToFilters, filtersToParams } from '$lib/utils/urlParams';
  import type { SearchOptions } from '$lib/stores/items';
  import type { Item } from '$lib/stores/items';
  import FilterPanel from '$lib/components/filters/FilterPanel.svelte';
  import ItemCard from '$lib/components/ItemCard.svelte';
  import PaginationControls from '$lib/components/PaginationControls.svelte';

  let items: Item[] = [];
  let loading = true;
  let error: string | null = null;
  let filters: SearchOptions = {};
  let totalResults = 0;
  let currentPage = 1;
  let hasMore = false;

  async function performSearch(searchFilters?: SearchOptions, pageNum: number = 1, append: boolean = false) {
    loading = true;
    error = null;

    try {
      const pageSize = 50;
      const offset = (pageNum - 1) * pageSize;

      // Use provided filters or parse from URL
      const filtersToUse = searchFilters || paramsToFilters($page.url.searchParams);
      console.log('[Search] performSearch: using filters:', filtersToUse);
      const newItems = await searchItems({ ...filtersToUse, limit: pageSize, offset });
      console.log('[Search] performSearch: got', newItems.length, 'results');

      if (append) {
        items = [...items, ...newItems];
      } else {
        items = newItems;
      }

      hasMore = newItems.length === pageSize;
      currentPage = pageNum;
      totalResults = items.length;

      // Update URL with page number if not first page
      if (pageNum > 1) {
        const params = filtersToParams({ ...filters, page: pageNum });
        await goto(`/search?${params.toString()}`, { replaceState: true });
      }
    } catch (err) {
      console.error('Search failed:', err);
      error = (err as Error).message || 'Search failed';
      items = [];
    } finally {
      loading = false;
    }
  }

  async function handleFiltersChange(newFilters: SearchOptions) {
    console.log('[Search] handleFiltersChange called with:', newFilters);
    filters = newFilters;

    // Reset pagination when filters change
    currentPage = 1;
    items = [];

    // Update URL with new filters (reset page to 1)
    const params = filtersToParams(filters);
    console.log('[Search] Updated URL params:', params.toString());
    await goto(`/search?${params.toString()}`, { replaceState: true });

    // Perform search with new filters
    console.log('[Search] Calling performSearch with filters:', filters);
    await performSearch(filters, 1, false);
  }

  async function handleLoadMore() {
    await performSearch(filters, currentPage + 1, true);
  }

  onMount(() => {
    (async () => {
      try {
        await initializeItemsSync();
        await new Promise(resolve => setTimeout(resolve, 500));

        // Initialize filters and page from URL params
        filters = paramsToFilters($page.url.searchParams);
        currentPage = filters.page || 1;

        // Perform search with initial filters
        await performSearch(filters, currentPage, false);
      } catch (err) {
        console.error('Initialization failed:', err);
        error = 'Failed to initialize search';
        loading = false;
      }
    })();

    return () => {
      cleanupItemsSync();
    };
  });
</script>

<div class="min-h-screen bg-slate-950 text-slate-50 p-6">
  <div class="max-w-6xl mx-auto">
    <!-- Header -->
    <div class="mb-8">
      <h1 class="text-4xl font-bold mb-2">Search Results</h1>
      {#if filters.query}
        <p class="text-slate-400">
          {#if loading}
            Searching for "<span class="text-blue-400">{filters.query}</span>"...
          {:else if totalResults > 0}
            Found <span class="text-emerald-400 font-semibold">{totalResults}</span> result{totalResults === 1 ? '' : 's'} for "<span class="text-blue-400">{filters.query}</span>"
          {:else}
            No results found for "<span class="text-blue-400">{filters.query}</span>"
          {/if}
        </p>
      {:else}
        <p class="text-slate-400">Enter a search query above</p>
      {/if}
    </div>

    <!-- Error message -->
    {#if error}
      <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
        <p class="text-red-400">Error: {error}</p>
      </div>
    {/if}

    <!-- Main content area with sidebar -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6">
      <!-- Sidebar filters -->
      <div class="lg:col-span-1">
        <FilterPanel
          {filters}
          onFiltersChange={handleFiltersChange}
        />
      </div>

      <!-- Results -->
      <div class="lg:col-span-3">
        {#if loading}
          <div class="flex items-center justify-center py-12">
            <p class="text-slate-400">Searching...</p>
          </div>
        {:else if items.length === 0}
          <div class="bg-slate-900 rounded-lg p-8 border border-slate-800 text-center">
            <p class="text-slate-400 mb-4">No results found</p>
            <p class="text-slate-500 text-sm">
              Try adjusting your search query or filters
            </p>
            <button
              class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition"
              on:click={() => {
                filters = {};
                performSearch();
              }}
            >
              Clear filters
            </button>
          </div>
        {:else}
          <div class="space-y-3">
            {#each items as item (item.id)}
              <ItemCard {item} />
            {/each}
          </div>

          <!-- Pagination controls -->
          <PaginationControls
            {currentPage}
            itemsOnPage={items.length}
            pageSize={50}
            {loading}
            {hasMore}
            on:loadmore={handleLoadMore}
          />
        {/if}
      </div>
    </div>
  </div>
</div>

<style>
  :global(body) {
    background-color: rgb(15, 23, 42);
  }
</style>
