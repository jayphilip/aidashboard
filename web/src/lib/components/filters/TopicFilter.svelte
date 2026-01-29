<script lang="ts">
  import { onMount } from 'svelte';
  import { getAllTopics } from '$lib/stores/items';

  export let selected: string[] = [];
  export let disabled = false;

  let allTopics: string[] = [];
  let loading = false;
  let searchQuery = '';
  let debouncedSearchQuery = '';
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;

  onMount(async () => {
    loading = true;
    try {
      allTopics = await getAllTopics();
    } catch (err) {
      console.error('Failed to load topics:', err);
    } finally {
      loading = false;
    }
  });

  // Debounce search input
  $: {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      debouncedSearchQuery = searchQuery;
    }, 300);
  }

  // Filter based on debounced query
  $: filteredTopics = allTopics.filter(topic =>
    topic.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
  );

  function toggleTopic(topic: string) {
    if (selected.includes(topic)) {
      selected = selected.filter(t => t !== topic);
    } else {
      selected = [...selected, topic];
    }
  }

  function clearTopics() {
    selected = [];
  }
</script>

<fieldset class="space-y-0 min-w-0 w-full">
  <legend class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5 block">Topics</legend>

  {#if loading}
    <p class="text-xs text-slate-400 mb-2">Loading topics...</p>
  {/if}

  <!-- Search input -->
  <div class="mb-3 w-full">
    <input
      type="text"
      placeholder="Search topics..."
      bind:value={searchQuery}
      {disabled}
      class="w-full bg-slate-800/50 border border-slate-700/60 rounded-md px-2.5 py-1.5 text-slate-50 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500/50 transition-colors"
    />
  </div>

  <!-- Topic list -->
  <div class="space-y-1 max-h-48 overflow-y-auto pr-1">
    {#each filteredTopics as topic}
      <label class="flex items-center gap-3 cursor-pointer hover:bg-slate-800/60 px-3 py-2.5 rounded-md transition-colors min-h-[44px]">
        <input
          type="checkbox"
          checked={selected.includes(topic)}
          on:change={() => toggleTopic(topic)}
          {disabled}
          class="w-5 h-5 rounded flex-shrink-0"
        />
        <span class="text-sm text-slate-300 flex-1 truncate">{topic}</span>
        {#if selected.includes(topic)}
          <span class="text-xs text-blue-400 flex-shrink-0">✓</span>
        {/if}
      </label>
    {/each}

    {#if filteredTopics.length === 0 && !loading}
      <p class="text-xs text-slate-500 py-2 text-center">No topics found</p>
    {/if}
  </div>

  <!-- Clear button for selected topics -->
  {#if selected.length > 0}
    <button
      class="w-full text-xs font-medium text-slate-400 hover:text-slate-200 px-2.5 py-1.5 hover:bg-slate-800/60 rounded-md transition-colors mt-2"
      on:click={clearTopics}
      {disabled}
    >
      Clear {selected.length} selected
    </button>
  {/if}
</fieldset>

<style>
  :global(input[type='checkbox']) {
    accent-color: rgb(37, 99, 235);
    cursor: pointer;
  }

  :global(input[type='checkbox']:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
