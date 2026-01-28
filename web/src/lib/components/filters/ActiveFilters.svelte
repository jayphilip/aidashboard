<script lang="ts">
  import type { SearchOptions } from '$lib/stores/items';
  import { hasActiveFilters } from '$lib/utils/urlParams';

  export let filters: SearchOptions;
  export let onRemoveFilter: (type: string, value?: string) => void;
  export let onClearAll: () => void;

  function renderFilterChips() {
    const chips: Array<{ label: string; type: string; value?: string }> = [];

    if (filters.query) {
      chips.push({ label: `Search: "${filters.query}"`, type: 'query' });
    }

    if (filters.sourceTypes && filters.sourceTypes.length > 0) {
      filters.sourceTypes.forEach(type => {
        const icon =
          type === 'paper' ? '📄' :
          type === 'newsletter' ? '📧' :
          type === 'blog' ? '✍️' :
          type === 'tweet' ? '🐦' : '📌';
        chips.push({ label: `${icon} ${type}`, type: 'sourceType', value: type });
      });
    }

    if (filters.topics && filters.topics.length > 0) {
      filters.topics.forEach(topic => {
        chips.push({ label: `🏷️ ${topic}`, type: 'topic', value: topic });
      });
    }

    if (filters.dateRange?.start) {
      chips.push({
        label: `📅 From ${filters.dateRange.start.toLocaleDateString()}`,
        type: 'dateStart',
      });
    }

    if (filters.dateRange?.end) {
      chips.push({
        label: `📅 Until ${filters.dateRange.end.toLocaleDateString()}`,
        type: 'dateEnd',
      });
    }

    if (filters.likeStatus) {
      const icon =
        filters.likeStatus === 'liked' ? '👍' :
        filters.likeStatus === 'disliked' ? '👎' : '❓';
      const label =
        filters.likeStatus === 'liked' ? 'Liked' :
        filters.likeStatus === 'disliked' ? 'Disliked' : 'Not yet rated';
      chips.push({
        label: `${icon} ${label}`,
        type: 'likeStatus',
      });
    }

    return chips;
  }

  $: chips = (filters, renderFilterChips());
  $: isActive = hasActiveFilters(filters);
</script>

{#if isActive}
  <div class="flex flex-col gap-2 w-full">
    <div class="flex flex-wrap gap-2 items-center">
      {#each chips as chip}
        <div class="bg-blue-500/15 border border-blue-500/30 rounded-full px-3 py-2 flex items-center gap-2 hover:bg-blue-500/20 transition-colors max-w-full">
          <span class="text-xs font-medium text-slate-100 truncate">{chip.label}</span>
          <button
            class="text-slate-400 hover:text-slate-200 transition ml-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-slate-700/50 flex-shrink-0"
            on:click={() => onRemoveFilter(chip.type, chip.value)}
            title="Remove filter"
            aria-label="Remove {chip.label} filter"
          >
            ✕
          </button>
        </div>
      {/each}
    </div>

    <button
      class="text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800/40 px-3 py-2 rounded transition min-h-[36px] self-start"
      on:click={onClearAll}
      title="Clear all filters"
    >
      Clear all
    </button>
  </div>
{:else}
  <p class="text-xs text-slate-500 italic">No filters applied</p>
{/if}

<style>
  :global(button) {
    cursor: pointer;
  }
</style>
