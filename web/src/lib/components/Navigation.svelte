<script lang="ts">
  import { page } from '$app/stores';
</script>

<nav class="bg-slate-900 border-b border-slate-800 px-6 py-4">
  <div class="max-w-6xl mx-auto flex items-center justify-between">
    <div class="flex items-center gap-2">
      <a href="/" class="text-2xl font-bold text-blue-400">🤖 AI Dashboard</a>
    </div>

    <div class="flex gap-6">
      <a
        href="/today"
        class="px-4 py-2 rounded transition {$page.url.pathname === '/today'
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
      >
        📄 Today
      </a>
      <a
        href="/topics"
        class="px-4 py-2 rounded transition {$page.url.pathname === '/topics'
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
      >
        📊 Trends
      </a>
      <a
        href="/sources"
        class="px-4 py-2 rounded transition {$page.url.pathname === '/sources'
          ? 'bg-blue-600 text-white'
          : 'text-slate-300 hover:text-white hover:bg-slate-800'}"
      >
        ⚙️ Sources
      </a>
    </div>
  </div>
</nav>

<style>
  :global(nav a) {
    text-decoration: none;
  }
</style>
