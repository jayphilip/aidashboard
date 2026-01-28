<script lang="ts">
  import { createEventDispatcher } from 'svelte';

  export let startDate: Date | undefined = undefined;
  export let endDate: Date | undefined = undefined;
  export let disabled = false;

  const dispatch = createEventDispatcher();

  function getDateString(date: Date | undefined): string {
    if (!date) return '';
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function setPreset(days: number | null) {
    const now = new Date();
    now.setHours(0, 0, 0, 0);

    if (days === null) {
      // All time
      startDate = undefined;
      endDate = undefined;
    } else {
      const start = new Date(now);
      start.setDate(start.getDate() - days);
      startDate = start;
      endDate = new Date(now);
    }
    dispatch('change', { startDate, endDate });
  }

  // Helper to check if dates match a preset
  function checkPreset(days: number): boolean {
    if (!startDate || !endDate) return false;

    const now = new Date();
    now.setHours(0, 0, 0, 0);

    const normalizedStart = new Date(startDate);
    normalizedStart.setHours(0, 0, 0, 0);
    const normalizedEnd = new Date(endDate);
    normalizedEnd.setHours(0, 0, 0, 0);

    const presetStart = new Date(now);
    presetStart.setDate(presetStart.getDate() - days);
    const presetEnd = new Date(now);

    return normalizedStart.getTime() === presetStart.getTime() &&
           normalizedEnd.getTime() === presetEnd.getTime();
  }

  // Reactive computed values - explicitly depend on startDate and endDate
  $: isAllTimeActive = !startDate && !endDate;
  $: isTodayActive = startDate && endDate && checkPreset(0);
  $: isLast7Active = startDate && endDate && checkPreset(7);
  $: isLast30Active = startDate && endDate && checkPreset(30);

  function parseLocalDate(dateString: string): Date {
    // Parse "YYYY-MM-DD" as a local date, not UTC
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  function handleStartChange(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    startDate = value ? parseLocalDate(value) : undefined;
    dispatch('change', { startDate, endDate });
  }

  function handleEndChange(e: Event) {
    const value = (e.target as HTMLInputElement).value;
    endDate = value ? parseLocalDate(value) : undefined;
    dispatch('change', { startDate, endDate });
  }

  function clearDates() {
    startDate = undefined;
    endDate = undefined;
    dispatch('change', { startDate, endDate });
  }
</script>

<fieldset class="space-y-0 w-full">
  <legend class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5 block">Date Range</legend>

  <!-- Preset buttons -->
  <div class="flex flex-wrap gap-1.5 mb-3 w-full">
    <button
      class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors {isAllTimeActive
        ? 'bg-blue-600 text-white'
        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}"
      on:click={() => setPreset(null)}
      {disabled}
    >
      All
    </button>
    <button
      class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors {isTodayActive
        ? 'bg-blue-600 text-white'
        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}"
      on:click={() => setPreset(0)}
      {disabled}
    >
      Today
    </button>
    <button
      class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors {isLast7Active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}"
      on:click={() => setPreset(7)}
      {disabled}
    >
      7d
    </button>
    <button
      class="px-2.5 py-1 text-xs font-medium rounded-md transition-colors {isLast30Active
        ? 'bg-blue-600 text-white'
        : 'bg-slate-800/60 text-slate-300 hover:bg-slate-800'}"
      on:click={() => setPreset(30)}
      {disabled}
    >
      30d
    </button>
  </div>

  <!-- Custom date range - stack on narrow screens -->
  <div class="flex flex-col gap-2 w-full">
    <div class="w-full">
      <label class="block text-xs font-medium text-slate-400 mb-1.5">From</label>
      <input
        type="date"
        value={getDateString(startDate)}
        on:change={handleStartChange}
        {disabled}
        class="w-full bg-slate-800/50 border border-slate-700/60 rounded-md px-2.5 py-1.5 text-slate-50 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
      />
    </div>
    <div class="w-full">
      <label class="block text-xs font-medium text-slate-400 mb-1.5">To</label>
      <input
        type="date"
        value={getDateString(endDate)}
        on:change={handleEndChange}
        {disabled}
        class="w-full bg-slate-800/50 border border-slate-700/60 rounded-md px-2.5 py-1.5 text-slate-50 text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
      />
    </div>
  </div>
  {#if startDate || endDate}
    <button
      class="w-full text-xs font-medium text-slate-400 hover:text-slate-200 px-2.5 py-1.5 hover:bg-slate-800/60 rounded-md transition-colors"
      on:click={clearDates}
      {disabled}
      title="Clear dates"
    >
      Clear dates
    </button>
  {/if}
</fieldset>

<style>
  :global(input[type='date']) {
    color-scheme: dark;
  }

  :global(input[type='date']:focus) {
    outline: none;
    border-color: rgb(37, 99, 235);
  }
</style>
