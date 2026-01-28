<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let currentPage: number = 1;
  export let itemsOnPage: number = 0;
  export let pageSize: number = 50;
  export let loading: boolean = false;
  export let hasMore: boolean = true;

  const dispatch = createEventDispatcher();

  $: startIndex = (currentPage - 1) * pageSize + 1;
  $: endIndex = startIndex + itemsOnPage - 1;

  function handleLoadMore() {
    if (!loading && hasMore) {
      dispatch('loadmore');
    }
  }
</script>

<div class="pagination-container">
  {#if itemsOnPage > 0}
    <p class="item-count">Showing {startIndex}-{endIndex}</p>
  {/if}

  {#if hasMore}
    <button
      class="btn-load-more"
      on:click={handleLoadMore}
      disabled={loading}
    >
      {loading ? 'Loading...' : 'Load More'}
    </button>
  {:else if itemsOnPage > 0}
    <p class="no-more">No more results</p>
  {/if}
</div>

<style>
  :global(.pagination-container) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-top: 2rem;
    margin-bottom: 2rem;
  }

  @media (min-width: 640px) {
    :global(.pagination-container) {
      flex-direction: row;
    }
  }

  :global(.item-count) {
    font-size: 0.875rem;
    color: rgb(148, 163, 184);
    margin: 0;
    font-weight: 500;
  }

  :global(.btn-load-more) {
    background-color: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.5rem;
    padding: 0.75rem 1.5rem;
    min-height: 44px;
    cursor: pointer;
    font-size: 0.9375rem;
    font-weight: 500;
    transition: all 0.2s;
    display: inline-flex;
    align-items: center;
    justify-content: center;
  }

  :global(.btn-load-more:hover:not(:disabled)) {
    background-color: rgb(37, 99, 235);
  }

  :global(.btn-load-more:disabled) {
    opacity: 0.6;
    cursor: not-allowed;
  }

  :global(.no-more) {
    font-size: 0.875rem;
    color: rgb(148, 163, 184);
    margin: 0;
    font-weight: 500;
  }
</style>
