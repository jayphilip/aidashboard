<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';
  import type { SearchOptions } from '$lib/stores/items';
  import FilterPanel from './filters/FilterPanel.svelte';

  export let filters: SearchOptions = {};
  export let onFiltersChange: (filters: SearchOptions) => void = () => {};
  export let showLikeStatusFilter: boolean = true;

  let isOpen = true; // Default to open for SSR/desktop
  let isMobile = false;

  onMount(() => {
    // Check if mobile on mount
    isMobile = window.innerWidth < 1024;

    // On desktop, restore from localStorage; on mobile, default to closed
    if (!isMobile) {
      const saved = localStorage.getItem('sidebarOpen');
      isOpen = saved !== null ? saved !== 'false' : true;
    } else {
      isOpen = false;
    }

    // Listen for resize to update mobile state
    const handleResize = () => {
      const wasMobile = isMobile;
      isMobile = window.innerWidth < 1024;

      // If switching from mobile to desktop, restore saved state
      if (wasMobile && !isMobile) {
        isOpen = localStorage.getItem('sidebarOpen') !== 'false';
      }
      // If switching from desktop to mobile, close sidebar
      if (!wasMobile && isMobile) {
        isOpen = false;
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  });

  // Persist state to localStorage (desktop only)
  $: if (browser && !isMobile) {
    localStorage.setItem('sidebarOpen', String(isOpen));
  }

  function toggleSidebar() {
    isOpen = !isOpen;
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.altKey && event.key === 'f') {
      event.preventDefault();
      toggleSidebar();
    }
  }

  // Close sidebar when clicking backdrop on mobile
  function handleBackdropClick() {
    if (isMobile) {
      isOpen = false;
    }
  }
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Mobile backdrop - only shown when sidebar is open on mobile -->
{#if isOpen && isMobile}
  <div
    class="fixed inset-0 bg-black/70 z-40 lg:hidden backdrop-blur-sm"
    on:click={handleBackdropClick}
    on:keydown={(e) => e.key === 'Escape' && handleBackdropClick()}
    role="button"
    tabindex="-1"
    aria-label="Close filters"
  ></div>
{/if}

<!-- Mobile floating filter button (when closed) -->
{#if !isOpen && isMobile}
  <button
    class="fixed bottom-20 right-6 z-[60] w-16 h-16 rounded-full bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-2xl flex items-center justify-center lg:hidden transition-all active:scale-95"
    on:click={toggleSidebar}
    aria-label="Open filters"
  >
    <span class="text-3xl">🎚️</span>
  </button>
{/if}

<!-- Desktop collapsed icon bar (not shown on mobile) -->
{#if !isOpen && !isMobile}
  <nav class="w-16 bg-slate-900/50 border-r border-slate-700/50 flex flex-col items-center py-4 gap-3 overflow-y-auto transition-all duration-300">
    <button
      title="Filters (Alt+F)"
      class="flex items-center justify-center w-12 h-12 rounded-lg bg-slate-800/50 hover:bg-slate-700/50 text-slate-400 hover:text-slate-200 transition-colors duration-200 cursor-pointer group relative"
      on:click={toggleSidebar}
    >
      <span class="text-2xl">🎚️</span>
      <div class="absolute left-full ml-2 px-2.5 py-1.5 bg-slate-800 text-slate-100 text-xs rounded whitespace-nowrap hidden group-hover:block z-10 font-medium">
        Filters
      </div>
    </button>
  </nav>
{/if}

<!-- Expanded sidebar -->
{#if isOpen}
  <aside
    class="
      {isMobile ? 'fixed inset-y-0 left-0 w-[85vw] max-w-sm z-50' : 'w-80'}
      bg-slate-900/95 backdrop-blur-sm border-r border-slate-700/50 overflow-y-auto p-6 transition-all duration-300
      {isMobile ? 'shadow-2xl' : ''}
    "
  >
    <!-- Header with icon and collapse button -->
    <div class="flex items-center justify-between mb-6">
      <span class="text-2xl">🎚️</span>
      <button
        title="{isMobile ? 'Close' : 'Collapse'} (Alt+F)"
        class="text-slate-400 hover:text-slate-200 transition-colors duration-200 cursor-pointer text-lg w-10 h-10 flex items-center justify-center rounded-lg hover:bg-slate-800/60"
        on:click={toggleSidebar}
      >
        {isMobile ? '✕' : '◀'}
      </button>
    </div>

    <!-- FilterPanel component -->
    <FilterPanel
      {filters}
      {onFiltersChange}
      {showLikeStatusFilter}
    />
  </aside>
{/if}
