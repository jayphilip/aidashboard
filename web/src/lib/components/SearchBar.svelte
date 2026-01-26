<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  let searchInput = '';
  let isFocused = false;
  let showRecent = false;
  let recentSearches: string[] = [];

  let debounceTimer: NodeJS.Timeout;
  let preventBlur = false;

  // Load recent searches from localStorage
  onMount(() => {
    const stored = localStorage.getItem('recentSearches');
    if (stored) {
      try {
        recentSearches = JSON.parse(stored);
      } catch {
        recentSearches = [];
      }
    }
  });

  function saveSearch(query: string) {
    if (!query.trim()) return;

    // Remove duplicates and add to front
    recentSearches = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
  }

  function handleSearch() {
    if (!searchInput.trim()) return;

    saveSearch(searchInput);
    goto(`/search?q=${encodeURIComponent(searchInput)}`);
    searchInput = '';
    isFocused = false;
    showRecent = false;
  }

  function handleRecentClick(query: string) {
    searchInput = query;
    handleSearch();
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    } else if (e.key === 'Escape') {
      isFocused = false;
      showRecent = false;
    }
  }

  function handleFocus() {
    isFocused = true;
    showRecent = recentSearches.length > 0;
  }


function handleBlur() {
  if (preventBlur) {
    preventBlur = false;
    // Don't hide dropdown or lose focus if interaction is with dropdown/clear
    const input = document.getElementById('global-search') as HTMLInputElement;
    if (input) input.focus();
    return;
  }
  isFocused = false;
  showRecent = false;
}



  function handleClear(e: MouseEvent) {
    e.preventDefault();
    preventBlur = true;
    searchInput = '';
    // Refocus the input after clearing
    const input = document.getElementById('global-search') as HTMLInputElement;
    if (input) {
      input.focus();
    }
  }


  function handleRecentMousedown(e: MouseEvent, query: string) {
    e.preventDefault();
    preventBlur = true;
    searchInput = query;
    handleSearch();
  }
</script>

<div class="relative flex-1 max-w-sm">
  <div class="flex items-center bg-slate-950 border border-slate-700 rounded px-3 py-2 focus-within:border-blue-500 transition">
    <span class="text-slate-400 mr-2">🔍</span>
    <input
      id="global-search"
      type="text"
      bind:value={searchInput}
      on:focus={handleFocus}
      on:blur={handleBlur}
      on:keydown={handleKeydown}
      placeholder="Search (Cmd+K)..."
      class="bg-transparent text-slate-50 flex-1 outline-none placeholder-slate-500 text-sm"
    />
    {#if searchInput}
      <button
        class="text-slate-400 hover:text-slate-200 transition p-1"
        on:mousedown={handleClear}
        title="Clear search"
        type="button"
      >
        ✕
      </button>
    {/if}
  </div>

  <!-- Recent searches dropdown -->
  {#if showRecent && recentSearches.length > 0}
    <div class="absolute top-full left-0 right-0 mt-2 bg-slate-900 border border-slate-700 rounded shadow-lg z-50">
      <div class="p-2">
        <p class="text-xs font-semibold text-slate-400 px-2 py-1">Recent Searches</p>
        {#each recentSearches as search}
          <button
            class="w-full text-left px-2 py-2 text-sm text-slate-300 hover:bg-slate-800 rounded transition"
            on:mousedown={(e) => handleRecentMousedown(e, search)}
            type="button"
          >
            🔍 {search}
          </button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  :global(input) {
    transition: border-color 0.2s;
  }

  :global(input:focus) {
    outline: none;
  }
</style>
