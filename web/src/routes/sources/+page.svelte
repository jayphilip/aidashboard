<script lang="ts">
  import { onMount } from 'svelte';
  import { initializeItemsSync, cleanupItemsSync } from '$lib/stores/items';
  import {
    sources$,
    sourcesState,
    initializeSourcesFromDb,
    toggleSourceActive,
    updateSource,
    createSource,
  } from '$lib/stores/sources';
  import type { Source } from '$lib/stores/sources';
  import SourceForm from '$lib/components/SourceForm.svelte';

  let showNewForm = false;
  let editingId: number | null = null;
  let loading = true;
  let error: string | null = null;

  let sourceTypes = ['arxiv', 'rss', 'twitter_api', 'manual'];
  let mediumTypes = ['paper', 'newsletter', 'blog', 'tweet'];

  async function handleToggleActive(sourceId: number, currentActive: boolean) {
    try {
      await toggleSourceActive(sourceId, !currentActive);
    } catch (err) {
      console.error('Failed to toggle source:', err);
      error = (err as Error).message;
    }
  }

  async function handleDelete(sourceId: number) {
    // TODO: Implement delete after confirming with user
  }

  async function handleSaveNew(event: CustomEvent<Omit<Source, 'id' | 'createdAt' | 'updatedAt'>>) {
    try {
      await createSource(event.detail);
      showNewForm = false;
    } catch (err) {
      console.error('Failed to create source:', err);
      error = (err as Error).message;
    }
  }

  async function handleSaveEdit(
    sourceId: number,
    event: CustomEvent<{
      ingestUrl?: string;
      frequency?: string;
      meta?: any;
    }>
  ) {
    try {
      await updateSource(sourceId, event.detail);
      editingId = null;
    } catch (err) {
      console.error('Failed to update source:', err);
      error = (err as Error).message;
    }
  }

  function getMediumIcon(medium: string): string {
    switch (medium) {
      case 'paper':
        return '📄';
      case 'newsletter':
        return '📧';
      case 'blog':
        return '✍️';
      case 'tweet':
        return '🐦';
      default:
        return '📌';
    }
  }

  function getTypeIcon(type: string): string {
    switch (type) {
      case 'arxiv':
        return '🔬';
      case 'rss':
        return '🔗';
      case 'twitter_api':
        return '🐦';
      case 'manual':
        return '✋';
      default:
        return '?';
    }
  }

  onMount(async () => {
    try {
      await initializeItemsSync();
      await initializeSourcesFromDb();
    } catch (err) {
      console.error('Initialization failed:', err);
      error = (err as Error).message;
    }
  });

  $: if ($sourcesState) {
    loading = $sourcesState.loading;
    if ($sourcesState.error) error = $sourcesState.error;
  }

  onMount(() => {
    return () => {
      cleanupItemsSync();
    };
  });
</script>

<div class="min-h-screen bg-slate-950 text-slate-50 p-6">
  <div class="max-w-6xl mx-auto">
    <div class="flex justify-between items-center mb-8">
      <h1 class="text-4xl font-bold">Sources</h1>
      <button
        class="btn-primary px-4 py-2"
        on:click={() => (showNewForm = !showNewForm)}
      >
        {showNewForm ? '✕ Cancel' : '+ Add Source'}
      </button>
    </div>

    {#if showNewForm}
      <div class="bg-slate-900 rounded-lg p-6 mb-8 border border-slate-800">
        <h3 class="text-xl font-semibold mb-4">Add New Source</h3>
        <SourceForm
          sourceTypes={sourceTypes}
          mediumTypes={mediumTypes}
          on:save={handleSaveNew}
          on:cancel={() => (showNewForm = false)}
        />
      </div>
    {/if}

    {#if loading}
      <div class="flex items-center justify-center py-12">
        <p class="text-slate-400">Loading sources...</p>
      </div>
    {/if}

    {#if error}
      <div class="bg-red-900/20 border border-red-800 rounded-lg p-4 mb-6">
        <p class="text-red-400">Error: {error}</p>
      </div>
    {/if}

    {#if !loading}
      <div class="overflow-x-auto">
        <table class="w-full">
          <thead>
            <tr class="border-b border-slate-700">
              <th class="text-left py-3 px-4 font-semibold text-slate-300">Name</th>
              <th class="text-left py-3 px-4 font-semibold text-slate-300">Type</th>
              <th class="text-left py-3 px-4 font-semibold text-slate-300">Medium</th>
              <th class="text-left py-3 px-4 font-semibold text-slate-300">URL</th>
              <th class="text-left py-3 px-4 font-semibold text-slate-300">Frequency</th>
              <th class="text-center py-3 px-4 font-semibold text-slate-300">Active</th>
              <th class="text-center py-3 px-4 font-semibold text-slate-300">Actions</th>
            </tr>
          </thead>
          <tbody>
            {#each $sources$ as source (source.id)}
              <tr class="border-b border-slate-800 hover:bg-slate-900/50">
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span>{getMediumIcon(source.medium)}</span>
                    <span class="font-medium">{source.name}</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <div class="flex items-center gap-2">
                    <span>{getTypeIcon(source.type)}</span>
                    <span class="text-sm text-slate-400">{source.type}</span>
                  </div>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-slate-400">{source.medium}</span>
                </td>
                <td class="py-3 px-4">
                  <code class="text-xs bg-slate-950 px-2 py-1 rounded text-slate-300">
                    {source.ingestUrl ? source.ingestUrl.substring(0, 40) + '...' : '—'}
                  </code>
                </td>
                <td class="py-3 px-4">
                  <span class="text-sm text-slate-400">{source.frequency || '—'}</span>
                </td>
                <td class="py-3 px-4 text-center">
                  <button
                    class="px-3 py-1 rounded text-sm {source.active ? 'bg-emerald-600/30 text-emerald-300' : 'bg-slate-700/30 text-slate-400'}"
                    on:click={() => handleToggleActive(source.id, source.active)}
                  >
                    {source.active ? '✓ Active' : '○ Inactive'}
                  </button>
                </td>
                <td class="py-3 px-4 text-center">
                  <div class="flex gap-2 justify-center">
                    <button
                      class="btn text-xs px-2 py-1"
                      on:click={() => (editingId = editingId === source.id ? null : source.id)}
                    >
                      {editingId === source.id ? '✕' : '✎'}
                    </button>
                  </div>
                </td>
              </tr>
              {#if editingId === source.id}
                <tr class="border-b border-slate-800 bg-slate-900/30">
                  <td colspan="7" class="py-4 px-4">
                    <div class="max-w-2xl">
                      <h4 class="font-semibold mb-4">Edit Source</h4>
                      <SourceForm
                        {source}
                        sourceTypes={sourceTypes}
                        mediumTypes={mediumTypes}
                        on:save={e => handleSaveEdit(source.id, e)}
                        on:cancel={() => (editingId = null)}
                      />
                    </div>
                  </td>
                </tr>
              {/if}
            {/each}
          </tbody>
        </table>
      </div>

      {#if $sources$.length === 0}
        <div class="bg-slate-900 rounded-lg p-8 text-center">
          <p class="text-slate-400">No sources configured yet</p>
        </div>
      {/if}
    {/if}
  </div>
</div>

<style>
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
