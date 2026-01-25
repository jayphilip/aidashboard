<script lang="ts">
  import { onMount } from 'svelte';

  type Paper = {
    id: string;
    source: string;
    external_id: string;
    title: string;
    authors: string | string[];
    abstract: string | null;
    categories: string | string[];
    published_at: string;
    url: string | null;
    pdf_url: string | null;
    created_at: string;
    updated_at: string;
  };

  let loading = true;
  let error: string | null = null;
  let papers: Paper[] = [];

onMount(async () => {
  loading = true;
  error = null;

  try {
    const url =
      'http://localhost:3000/v1/shape?table=papers&offset=-1&subset__order_by=created_at%20DESC&subset__limit=100';

    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Shape HTTP error: ${res.status}`);
    }

    const json = await res.json();
    console.log('RAW SHAPE JSON:', json);

    const entries = Array.isArray((json as any).data) ? (json as any).data : [];

    papers = entries
      .filter((e: any) => e && e.value)
      .map((e: any) => e.value as Paper);

    console.log('Parsed papers length:', papers.length);

    loading = false;
  } catch (e) {
    console.error('Error in onMount shape fetch:', e);
    error = (e as Error).message ?? String(e);
    loading = false;
  }
});



  function asArray(authors: string | string[] | null | undefined): string[] {
    if (!authors) return [];
    if (Array.isArray(authors)) return authors;
    // handle serialized array strings if needed
    return authors
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((s) => s.replace(/^"|"$/g, '').trim())
      .filter(Boolean);
  }

  function formatAuthors(authors: string | string[] | null | undefined) {
    const arr = asArray(authors);
    if (arr.length === 0) return 'Unknown';
    if (arr.length === 1) return arr[0];
    if (arr.length === 2) return `${arr[0]}, ${arr[1]}`;
    return `${arr[0]}, ${arr[1]} et al.`;
  }

  function excerpt(text: string | null | undefined, max = 200) {
    if (!text) return '';
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function formatDate(str: string | null | undefined) {
    if (!str) return '';
    const d = new Date(str);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString();
  }

  function splitCategories(raw: string | string[] | null | undefined): string[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return raw
      .replace(/^\{|\}$/g, '')
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean);
  }
</script>

{#if loading}
  <div class="flex flex-col items-center justify-center py-16 bg-slate-950 min-h-screen">
    <div class="h-8 w-8 animate-spin rounded-full border-4 border-slate-700 border-t-slate-400"></div>
    <p class="mt-4 text-slate-400">Loading papers...</p>
  </div>
{:else if error}
  <div class="min-h-screen bg-slate-950">
    <div class="mx-auto max-w-3xl rounded-lg border border-red-900/50 bg-red-950/20 p-4 text-red-300 mt-10">
      <h2 class="font-semibold">Error loading papers</h2>
      <p class="mt-1 text-sm">{error}</p>
    </div>
  </div>
{:else if papers.length === 0}
  <div class="flex items-center justify-center py-16 bg-slate-950 min-h-screen">
    <p class="text-slate-400">No papers found.</p>
  </div>
{:else}
  <div class="min-h-screen bg-slate-950 text-slate-50">
    <div class="mx-auto max-w-7xl px-4 py-10">
      <header class="mb-12 flex items-center justify-between gap-4">
        <div>
          <h1 class="text-4xl font-bold tracking-tight text-slate-50">Research Papers</h1>
          <p class="mt-2 text-sm text-slate-400">
            {papers.length} papers synced from Postgres via Electric &amp; PGlite.
          </p>
        </div>
        <div class="inline-flex items-center gap-2 rounded-full bg-emerald-500/10 px-4 py-2 text-xs font-medium text-emerald-300 border border-emerald-500/30">
          <span class="h-2 w-2 rounded-full bg-emerald-400"></span>
          Live sync
        </div>
      </header>

      <div class="paper-grid">
        {#each papers as paper}
          <div class="paper-card">
            <div class="paper-header">
              <h2 class="paper-title">{paper.title}</h2>
              <p class="paper-authors">{formatAuthors((paper as any).authors)}</p>
              <span class="inline-block text-xs font-semibold uppercase text-purple-300 bg-purple-500/20 px-2 py-1 rounded mt-2">
                {paper.source}
              </span>
            </div>

            <div class="paper-content">
              {#if paper.abstract}
                <p class="paper-abstract">
                  {excerpt((paper as any).abstract, 150)}
                </p>
              {:else}
                <p class="text-base text-slate-500">No abstract available</p>
              {/if}
            </div>

            <div class="paper-footer">
              <div class="mb-3">
                <p class="text-xs text-slate-500">
                  Published: <span class="text-slate-300">{formatDate((paper as any).publishedAt ?? (paper as any).published_at)}</span>
                </p>
              </div>
              <div class="mb-4">
                {#each splitCategories((paper as any).categories) as cat}
                  <span class="paper-tag">{cat}</span>
                {/each}
              </div>
              {#if (paper as any).url}
                <a href={(paper as any).url} target="_blank" rel="noreferrer" class="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  View paper →
                </a>
              {:else if (paper as any).pdfUrl ?? (paper as any).pdf_url}
                <a href={(paper as any).pdfUrl ?? (paper as any).pdf_url} target="_blank" rel="noreferrer" class="text-blue-400 hover:text-blue-300 text-sm font-medium">
                  View PDF →
                </a>
              {:else}
                <span class="text-sm text-slate-600">No link available</span>
              {/if}
            </div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

