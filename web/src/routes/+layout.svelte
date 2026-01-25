<script lang="ts">
  import '$lib/styles/app.css';  // path must match the real file
  import favicon from '$lib/assets/favicon.svg';
  import Navigation from '$lib/components/Navigation.svelte';
  import { setServerConfig } from '$lib/config';

  let { children, data } = $props();

  // Inject server-side config into client
  $effect.pre(() => {
    console.log('Layout data:', data);
    if (data?.publicElectricUrl) {
      console.log('Setting server config:', {
        url: data.publicElectricUrl,
        secret: data.publicElectricSecret ? 'SET' : 'NOT SET',
      });
      setServerConfig({
        publicElectricUrl: data.publicElectricUrl,
        publicElectricSecret: data.publicElectricSecret,
      });
    } else {
      console.warn('No publicElectricUrl in layout data');
    }
  });
</script>

<svelte:head>
  <link rel="icon" href={favicon} />
</svelte:head>

<div class="min-h-screen bg-slate-950 text-slate-50">
  <Navigation />
  {@render children()}
</div>

