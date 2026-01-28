<script lang="ts">
  import { page } from '$app/stores';
  import SearchBar from './SearchBar.svelte';
  import { onMount } from 'svelte';

  onMount(() => {
    // Global keyboard shortcut for search (Cmd/Ctrl+K)
    const handleKeydown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.getElementById('global-search') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeydown);
    return () => window.removeEventListener('keydown', handleKeydown);
  });
</script>

<nav class="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-3 sm:py-4">
  <div class="max-w-7xl mx-auto">
    <!-- Mobile: vertical stack, Desktop: horizontal -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-6">
      <!-- Title -->
      <div class="flex items-center gap-2 flex-shrink-0">
        <a href="/" class="text-xl sm:text-2xl font-bold text-blue-400">🤖 AI Dashboard</a>
      </div>

      <!-- Search bar -->
      <div class="flex-1 order-3 sm:order-2">
        <SearchBar />
      </div>

      <!-- Navigation links - horizontal on all screens but compact on mobile -->
      <div class="flex gap-2 sm:gap-4 flex-shrink-0 order-2 sm:order-3">
        <a
          href="/today"
          class="px-3 sm:px-4 py-2 rounded transition text-sm sm:text-base {$page.url.pathname === '/today'
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
        >
          📄 Today
        </a>
        <a
          href="/topics"
          class="px-3 sm:px-4 py-2 rounded transition text-sm sm:text-base {$page.url.pathname === '/topics'
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
        >
          📊 Trends
        </a>
        <a
          href="/sources"
          class="px-3 sm:px-4 py-2 rounded transition text-sm sm:text-base {$page.url.pathname === '/sources'
            ? 'bg-blue-600 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
        >
          ⚙️ Sources
        </a>
      </div>
    </div>
  </div>
</nav>

<style>
  :global(nav a) {
    text-decoration: none;
  }
</style>
