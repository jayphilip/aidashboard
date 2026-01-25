<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeItemsSync, cleanupItemsSync } from '$lib/stores/items';
  import { getTrendingTopics } from '$lib/stores/topics';
  import type { TopicTrend } from '$lib/stores/topics';
  import TopicSparkline from '$lib/components/TopicSparkline.svelte';

  let topics: TopicTrend[] = [];
  let selectedTimeRange = '4weeks';
  let selectedMediaType = 'all';
  let loading = true;
  let error: string | null = null;

  async function loadTopics() {
    try {
      loading = true;
      error = null;
      const weeksBack = selectedTimeRange === '4weeks' ? 4 : selectedTimeRange === '3months' ? 12 : 8;
      const trends = await getTrendingTopics(weeksBack);
      topics = trends;
    } catch (err) {
      console.error('Failed to load topics:', err);
      // Don't show error - topics table might just be empty
    } finally {
      loading = false;
    }
  }

  onMount(async () => {
    try {
      await initializeItemsSync();
      await new Promise(resolve => setTimeout(resolve, 500));
      await loadTopics();
    } catch (err) {
      console.error('Initialization failed:', err);
      // Don't show error - data might just be loading
      loading = false;
    }

    return () => {
      cleanupItemsSync();
    };
  });
</script>

<div class="min-h-screen bg-slate-950 text-slate-50 p-6">
  <div class="max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold">Topic Trends</h1>
      <div class="flex gap-4">
        <select
          bind:value={selectedTimeRange}
          on:change={loadTopics}
          class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-50"
        >
          <option value="4weeks">Last 4 weeks</option>
          <option value="8weeks">Last 8 weeks</option>
          <option value="3months">Last 3 months</option>
        </select>
        <select
          bind:value={selectedMediaType}
          class="bg-slate-900 border border-slate-700 rounded px-3 py-2 text-slate-50"
        >
          <option value="all">All Media</option>
          <option value="paper">Papers</option>
          <option value="newsletter">Newsletters/Blogs</option>
          <option value="tweet">Tweets</option>
        </select>
      </div>
    </div>

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

    {#if !loading && topics.length === 0}
      <div class="bg-slate-900 rounded-lg p-8 text-center">
        <p class="text-slate-400">No topics found for the selected period</p>
      </div>
    {/if}

    <div class="space-y-4">
      {#each topics as topic (topic.topic)}
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
