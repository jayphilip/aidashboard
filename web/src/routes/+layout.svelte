<script lang="ts">
  import '$lib/styles/app.css';  // path must match the real file
  import favicon from '$lib/assets/favicon.svg';
  import Navigation from '$lib/components/Navigation.svelte';
  import { setServerConfig } from '$lib/config';

  let { children, data } = $props();

  // Inject server-side config into client
  $effect.pre(() => {
    if (data?.publicElectricUrl) {
      setServerConfig({
        publicElectricUrl: data.publicElectricUrl,
        publicElectricSecret: data.publicElectricSecret,
      });
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

