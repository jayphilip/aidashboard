<script lang="ts">
  import { goto } from '$app/navigation';
  import { onMount } from 'svelte';

  onMount(() => {
    goto('/today');
  });
</script>

<div class="flex items-center justify-center min-h-screen">
  <p class="text-slate-400">Redirecting...</p>
</div>
