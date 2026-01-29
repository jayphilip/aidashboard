<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeItemsSync, cleanupItemsSync } from '$lib/stores/items';
  import { getTrendingTopics, getTopicsBySourceType } from '$lib/stores/topics';
  import type { TopicTrend } from '$lib/stores/topics';
  import TopicSparkline from '$lib/components/TopicSparkline.svelte';

  let allTopics: TopicTrend[] = [];
  let filteredTopics: TopicTrend[] = [];
  let selectedTimeRange = '4weeks';
  let selectedMediaType = 'all';
  let searchQuery = '';
  let sortBy = 'count'; // 'count', 'alphabetical', 'growth'
  let minItems = 1;
  let loading = true;
  let error: string | null = null;
  let filterDebounceTimer: ReturnType<typeof setTimeout> | null = null;

  async function loadTopics() {
    try {
      loading = true;
      error = null;
      const weeksBack = selectedTimeRange === '4weeks' ? 4 : selectedTimeRange === '3months' ? 12 : 8;

      // Use filtered query if media type is selected
      if (selectedMediaType === 'all') {
        const trends = await getTrendingTopics(weeksBack);
        allTopics = trends;
      } else {
        const trends = await getTopicsBySourceType(selectedMediaType, weeksBack);
        allTopics = trends;
      }

      applyFiltersAndSort();
    } catch (err) {
      console.error('Failed to load topics:', err);
      // Don't show error - topics table might just be empty
    } finally {
      loading = false;
    }
  }

  function applyFiltersAndSort() {
    // Apply search filter
    let filtered = allTopics.filter(topic => {
      const matchesSearch = topic.topic.toLowerCase().includes(searchQuery.toLowerCase());
      const meetsThreshold = topic.totalItems >= minItems;
      return matchesSearch && meetsThreshold;
    });

    // Apply sorting
    if (sortBy === 'alphabetical') {
      filtered.sort((a, b) => a.topic.localeCompare(b.topic));
    } else if (sortBy === 'growth') {
      // Calculate growth rate based on weekly data
      filtered.sort((a, b) => {
        const aGrowth = calculateGrowthRate(a);
        const bGrowth = calculateGrowthRate(b);
        return bGrowth - aGrowth;
      });
    } else {
      // Default: by count (descending)
      filtered.sort((a, b) => b.totalItems - a.totalItems);
    }

    filteredTopics = filtered;
  }

  function calculateGrowthRate(topic: TopicTrend): number {
    const weeks = topic.weeklyData;
    if (weeks.length < 2) return 0;

    const lastWeek = weeks[weeks.length - 1]?.count || 0;
    const prevWeek = weeks[weeks.length - 2]?.count || 1;
    return (lastWeek - prevWeek) / prevWeek;
  }

  function handleSearchChange() {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      applyFiltersAndSort();
    }, 300);
  }

  function handleMinItemsChange() {
    if (filterDebounceTimer) clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => {
      applyFiltersAndSort();
    }, 300);
  }

  function handleSortChange() {
    applyFiltersAndSort();
  }

  onMount(() => {
    (async () => {
      try {
        await initializeItemsSync();
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadTopics();
      } catch (err) {
        console.error('Initialization failed:', err);
        // Don't show error - data might just be loading
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
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold">Topic Trends</h1>
      <div class="flex gap-3">
        <select
          bind:value={selectedTimeRange}
          on:change={loadTopics}
          class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-50 text-sm"
        >
          <option value="4weeks">Last 4 weeks</option>
          <option value="8weeks">Last 8 weeks</option>
          <option value="3months">Last 3 months</option>
        </select>
        <select
          bind:value={selectedMediaType}
          on:change={loadTopics}
          class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-50 text-sm"
        >
          <option value="all">All Media</option>
          <option value="paper">Papers</option>
          <option value="newsletter">Newsletters/Blogs</option>
          <option value="tweet">Tweets</option>
        </select>
      </div>
    </div>

    <!-- Search and Filter Controls -->
    {#if !loading}
      <div class="bg-slate-900 rounded-lg border border-slate-800 p-4 mb-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <!-- Search -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Search Topics</label>
            <input
              type="text"
              bind:value={searchQuery}
              on:input={handleSearchChange}
              placeholder="Filter topics..."
              class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50 text-sm"
            />
          </div>

          <!-- Sort By -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">Sort By</label>
            <select
              bind:value={sortBy}
              on:change={handleSortChange}
              class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50 text-sm"
            >
              <option value="count">Most Items</option>
              <option value="alphabetical">Alphabetical</option>
              <option value="growth">Fastest Growing</option>
            </select>
          </div>

          <!-- Min Items Slider -->
          <div>
            <label class="block text-sm font-medium text-slate-300 mb-2">
              Minimum Items: <span class="text-blue-400">{minItems}</span>
            </label>
            <input
              type="range"
              bind:value={minItems}
              on:input={handleMinItemsChange}
              min="1"
              max="50"
              class="w-full"
            />
          </div>
        </div>
      </div>
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <p class="text-slate-400">Loading topics...</p>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
        <p class="text-red-400">Error: {error}</p>
      </div>
    {/if}

    {#if !loading && allTopics.length === 0}
      <div class="bg-slate-900 rounded-lg p-8 text-center">
        <p class="text-slate-400">No topics found for the selected period</p>
      </div>
    {/if}

    {#if !loading && allTopics.length > 0 && filteredTopics.length === 0}
      <div class="bg-slate-900 rounded-lg p-8 text-center">
        <p class="text-slate-400">No topics match your filters</p>
        <button
          class="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded text-white text-sm transition"
          on:click={() => {
            searchQuery = '';
            minItems = 1;
            handleSearchChange();
          }}
        >
          Clear filters
        </button>
      </div>
    {/if}

    <div class="space-y-4">
      {#each filteredTopics as topic (topic.topic)}
        <div class="bg-slate-900 rounded-lg p-6 border border-slate-800">
          <div class="flex justify-between items-start mb-4">
            <div>
              <h3 class="text-xl font-semibold text-blue-400 mb-1">{topic.topic}</h3>
              <div class="flex gap-4 text-sm text-slate-400">
                <span>📊 {topic.totalItems} items</span>
                <span>👍 {topic.totalLiked} liked</span>
              </div>
            </div>
            <TopicSparkline data={topic.weeklyData} />
          </div>

          <!-- Small table of weekly data -->
          <div class="mt-4 overflow-x-auto">
            <table class="w-full text-sm">
              <thead>
                <tr class="border-b border-slate-700">
                  <th class="text-left py-2 px-3 text-slate-400">Week</th>
                  <th class="text-right py-2 px-3 text-slate-400">Count</th>
                </tr>
              </thead>
              <tbody>
                {#each topic.weeklyData.slice(-4) as week}
                  <tr class="border-b border-slate-800">
                    <td class="py-2 px-3">{week.week}</td>
                    <td class="text-right py-2 px-3">{week.count}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        </div>
      {/each}
    </div>
  </div>
</div>
