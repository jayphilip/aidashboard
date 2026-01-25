<script lang="ts">
  import type { Source } from '$lib/stores/sources';
  import { createEventDispatcher } from 'svelte';

  export let source: Source | null = null;
  export let sourceTypes: string[] = [];
  export let mediumTypes: string[] = [];

  const dispatch = createEventDispatcher();

  let name = source?.name || '';
  let type = source?.type || 'rss';
  let medium = source?.medium || 'newsletter';
  let ingestUrl = source?.ingestUrl || '';
  let frequency = source?.frequency || 'daily';
  let meta = source?.meta || {};
  let active = source?.active ?? true;

  function handleSave() {
    if (!name.trim()) {
      alert('Name is required');
      return;
    }

    dispatch('save', {
      name,
      type,
      medium,
      ingestUrl,
      frequency,
      meta,
      active,
    });
  }

  function handleCancel() {
    dispatch('cancel');
  }
</script>

<div class="space-y-4">
  <div class="grid grid-cols-2 gap-4">
    <div>
      <label class="block text-sm font-medium mb-1 text-slate-300">Name *</label>
      <input
        type="text"
        bind:value={name}
        placeholder="e.g., arXiv AI"
        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50"
      />
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-slate-300">Type</label>
      <select
        bind:value={type}
        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50"
      >
        {#each sourceTypes as t}
          <option value={t}>{t}</option>
        {/each}
      </select>
    </div>
  </div>

  <div class="grid grid-cols-2 gap-4">
    <div>
      <label class="block text-sm font-medium mb-1 text-slate-300">Medium</label>
      <select
        bind:value={medium}
        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50"
      >
        {#each mediumTypes as m}
          <option value={m}>{m}</option>
        {/each}
      </select>
    </div>

    <div>
      <label class="block text-sm font-medium mb-1 text-slate-300">Frequency</label>
      <select
        bind:value={frequency}
        class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50"
      >
        <option value="hourly">Hourly</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
      </select>
    </div>
  </div>

  <div>
    <label class="block text-sm font-medium mb-1 text-slate-300">Ingest URL (for RSS/API)</label>
    <input
      type="url"
      bind:value={ingestUrl}
      placeholder="https://example.com/feed.xml"
      class="w-full bg-slate-950 border border-slate-700 rounded px-3 py-2 text-slate-50"
    />
  </div>

  <div>
    <label class="flex items-center gap-2 text-sm font-medium text-slate-300">
      <input type="checkbox" bind:checked={active} class="w-4 h-4" />
      Active
    </label>
  </div>

  <div class="flex gap-2 justify-end pt-4">
    <button class="btn px-4 py-2" on:click={handleCancel}>Cancel</button>
    <button class="btn-primary px-4 py-2" on:click={handleSave}>Save</button>
  </div>
</div>

<style>
  :global(input, select) {
    transition: border-color 0.2s;
  }

  :global(input:focus, select:focus) {
    outline: none;
    border-color: rgb(37, 99, 235);
  }

  :global(.btn) {
    background-color: rgb(30, 41, 59);
    color: rgb(226, 232, 240);
    border: 1px solid rgb(71, 85, 105);
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  :global(.btn:hover) {
    background-color: rgb(51, 65, 85);
    border-color: rgb(100, 116, 139);
  }

  :global(.btn-primary) {
    background-color: rgb(37, 99, 235);
    color: rgb(226, 232, 240);
    border: none;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: all 0.2s;
  }

  :global(.btn-primary:hover) {
    background-color: rgb(29, 78, 216);
  }
</style>
