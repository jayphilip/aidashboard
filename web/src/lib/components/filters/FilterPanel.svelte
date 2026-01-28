<script lang="ts">
  import { onMount } from 'svelte';
  import type { SearchOptions } from '$lib/stores/items';
  import SourceTypeFilter from './SourceTypeFilter.svelte';
  import DateRangeFilter from './DateRangeFilter.svelte';
  import TopicFilter from './TopicFilter.svelte';
  import LikeStatusFilter from './LikeStatusFilter.svelte';
  import ActiveFilters from './ActiveFilters.svelte';

  export let filters: SearchOptions = {};
  export let onFiltersChange: (filters: SearchOptions) => void = () => {};
  export let showLikeStatusFilter: boolean = true;
  let sourceTypes = filters.sourceTypes || [];
  let startDate = filters.dateRange?.start;
  let endDate = filters.dateRange?.end;
  let topics = filters.topics || [];
  let likeStatus: 'liked' | 'disliked' | 'unrated' | null = filters.likeStatus || null;
  let isMounted = false;
  let updateTimeout: ReturnType<typeof setTimeout> | undefined;
  let filterDeps = '';
  let currentFilters: SearchOptions = {};


  onMount(() => {
    isMounted = true;
    // Sync initial state from props on mount only
    sourceTypes = filters.sourceTypes || [];
    startDate = filters.dateRange?.start;
    endDate = filters.dateRange?.end;
    topics = filters.topics || [];
    likeStatus = filters.likeStatus || null;
  });

  // Debounced reactive statement - only update after changes settle for 300ms
  // This prevents excessive reload calls when user interacts with filters
  $: filterDeps = JSON.stringify({
    sourceTypes,
    startDate: startDate?.toISOString(),
    endDate: endDate?.toISOString(),
    topics,
    likeStatus,
  });

  $: if (isMounted && filterDeps) {
    clearTimeout(updateTimeout);
    updateTimeout = setTimeout(() => {
      updateFilters();
    }, 300);
  }

  function updateFilters() {
    const newFilters: SearchOptions = {
      // Preserve the query from existing filters
      query: filters.query,
    };

    if (sourceTypes.length > 0) {
      newFilters.sourceTypes = sourceTypes;
    }

    if (startDate || endDate) {
      newFilters.dateRange = { start: startDate, end: endDate };
    }

    if (topics.length > 0) {
      newFilters.topics = topics;
    }

    if (likeStatus) {
      newFilters.likeStatus = likeStatus;
    }

    filters = newFilters;
    try {
      onFiltersChange(filters);
    } catch (err) {
      console.error('[FilterPanel] onFiltersChange threw', err);
    }
  }

  function handleRemoveFilter(type: string, value?: string) {
    switch (type) {
      case 'query':
        // Clear query and propagate change
        filters = { ...filters, query: undefined };
        onFiltersChange(filters);
        break;
      case 'sourceType':
        sourceTypes = sourceTypes.filter(t => t !== value);
        // Reactive statement will handle the update
        break;
      case 'topic':
        topics = topics.filter(t => t !== value);
        // Reactive statement will handle the update
        break;
      case 'dateStart':
        startDate = undefined;
        // Reactive statement will handle the update
        break;
      case 'dateEnd':
        endDate = undefined;
        // Reactive statement will handle the update
        break;
      case 'likeStatus':
        likeStatus = null;
        // Reactive statement will handle the update
        break;
    }
  }

  function handleClearAll() {
    // Clear all local filter state
    // The reactive statement will rebuild filters (preserving query) and call onFiltersChange
    sourceTypes = [];
    startDate = undefined;
    endDate = undefined;
    topics = [];
    likeStatus = null;
  }

  function handleDateRangeChange(event: CustomEvent<{ startDate: Date | undefined; endDate: Date | undefined }>) {
    startDate = event.detail.startDate;
    endDate = event.detail.endDate;
  }

  function handleLikeStatusChange() {
    // The reactive statement will handle the update via filterDeps
  }

  // Reactive computed object for current filter state (for immediate display in ActiveFilters)
  // Important: We create fresh arrays to ensure proper reactivity
  $: {
    currentFilters = {
      ...(filters.query && { query: filters.query }),
      ...(sourceTypes.length > 0 && { sourceTypes: [...sourceTypes] }),
      ...((startDate || endDate) && { dateRange: { start: startDate, end: endDate } }),
      ...(topics.length > 0 && { topics: [...topics] }),
      ...(likeStatus && { likeStatus }),
    };
  }
</script>

<div class="space-y-4 overflow-x-hidden w-full">
  <!-- Header -->
  <h3 class="font-semibold text-slate-100 text-sm uppercase tracking-wide">Filters</h3>

  <!-- Active filters display -->
  <div class="w-full">
    <ActiveFilters
      filters={currentFilters}
      onRemoveFilter={handleRemoveFilter}
      onClearAll={handleClearAll}
    />
  </div>

  <!-- Vertical filter controls for sidebar -->
  <div class="space-y-4 pb-6">
    <!-- Content Type -->
    <SourceTypeFilter bind:selected={sourceTypes} />

    <!-- Date Range -->
    <DateRangeFilter bind:startDate bind:endDate on:change={handleDateRangeChange} />

    <!-- Like Status (only on search page) -->
    {#if showLikeStatusFilter}
      <LikeStatusFilter bind:likeStatus on:change={handleLikeStatusChange} />
    {/if}

    <!-- Topics -->
    <TopicFilter bind:selected={topics} />
  </div>
</div>

<style>
  :global(button) {
    cursor: pointer;
  }
</style>
