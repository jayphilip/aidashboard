<script lang="ts">
  import { itemsState } from '$lib/stores/items';

  export let retryFn: (() => void) | null = null;
</script>

{#if $itemsState.error}
  <div class="error-boundary">
    <div class="error-content">
      <h2>⚠️ Sync Error</h2>
      <p>Failed to sync data from the server. Please check your connection and try again.</p>
      {#if $itemsState.error}
        <details class="error-details">
          <summary>Error Details</summary>
          <pre>{$itemsState.error}</pre>
        </details>
      {/if}
      {#if retryFn}
        <button class="retry-button" on:click={retryFn}>
          Retry Sync
        </button>
      {/if}
    </div>
  </div>
{/if}

<style>
  .error-boundary {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(0, 0, 0, 0.8);
    z-index: 1000;
    padding: 1rem;
  }

  .error-content {
    background: rgb(30, 41, 59);
    border: 2px solid rgb(239, 68, 68);
    border-radius: 0.5rem;
    padding: 2rem;
    max-width: 32rem;
    width: 100%;
    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.5);
  }

  h2 {
    color: rgb(248, 113, 113);
    margin: 0 0 1rem;
    font-size: 1.5rem;
  }

  p {
    color: rgb(226, 232, 240);
    margin: 0 0 1rem;
    line-height: 1.5;
  }

  .error-details {
    margin: 1rem 0;
    padding: 0.75rem;
    background: rgb(15, 23, 42);
    border-radius: 0.25rem;
    border: 1px solid rgb(71, 85, 105);
  }

  .error-details summary {
    cursor: pointer;
    color: rgb(148, 163, 184);
    font-size: 0.875rem;
    font-weight: 500;
    user-select: none;
  }

  .error-details summary:hover {
    color: rgb(203, 213, 225);
  }

  .error-details pre {
    margin: 0.75rem 0 0;
    padding: 0.75rem;
    background: rgb(0, 0, 0);
    border-radius: 0.25rem;
    color: rgb(239, 68, 68);
    font-size: 0.75rem;
    overflow-x: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .retry-button {
    background: rgb(59, 130, 246);
    color: white;
    border: none;
    border-radius: 0.375rem;
    padding: 0.75rem 1.5rem;
    font-size: 0.875rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    width: 100%;
  }

  .retry-button:hover {
    background: rgb(37, 99, 235);
  }

  .retry-button:active {
    background: rgb(29, 78, 216);
  }
</style>
