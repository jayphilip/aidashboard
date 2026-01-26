<script lang="ts">
  import '$lib/styles/app.css';  // path must match the real file
  import favicon from '$lib/assets/favicon.svg';
  import Navigation from '$lib/components/Navigation.svelte';
  import SyncErrorBoundary from '$lib/components/SyncErrorBoundary.svelte';
  import { setServerConfig } from '$lib/config';
  import { initializeItemsSync } from '$lib/stores/items';
  import { logger } from '$lib/utils/logger';

  let { children, data } = $props();

  function retrySync() {
    logger.log('Retrying Electric sync...');
    initializeItemsSync();
  }

  // Inject server-side config into client
  $effect.pre(() => {
    logger.log('Layout data:', data);
    if (data?.publicElectricUrl) {
      logger.log('Setting server config:', {
        url: data.publicElectricUrl,
        secret: data.publicElectricSecret ? 'SET' : 'NOT SET',
      });
      setServerConfig({
        publicElectricUrl: data.publicElectricUrl,
        publicElectricSecret: data.publicElectricSecret ?? undefined,
      });
    } else {
      logger.warn('No publicElectricUrl in layout data');
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-50">
  <Navigation />
  <SyncErrorBoundary retryFn={retrySync} />
  {@render children()}
</div>

