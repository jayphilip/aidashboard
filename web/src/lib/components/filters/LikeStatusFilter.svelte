<script lang="ts">
  export let likeStatus: 'liked' | 'disliked' | 'unrated' | null = null;

  const options = [
    { value: null, label: 'All items', emoji: '📋' },
    { value: 'liked' as const, label: 'Liked', emoji: '👍' },
    { value: 'disliked' as const, label: 'Disliked', emoji: '👎' },
    { value: 'unrated' as const, label: 'Not yet rated', emoji: '❓' },
  ];

  function handleChange(value: typeof likeStatus) {
    likeStatus = value;
    dispatch('change');
  }

  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher();
</script>

<div class="filter-section">
  <h3 class="filter-title">Your Rating</h3>
  <div class="filter-options">
    {#each options as option (option.value)}
      <label class="filter-option">
        <input
          type="radio"
          name="likeStatus"
          value={option.value}
          checked={likeStatus === option.value}
          on:change={() => handleChange(option.value)}
        />
        <span class="option-label">
          <span class="emoji">{option.emoji}</span>
          <span>{option.label}</span>
        </span>
      </label>
    {/each}
  </div>
</div>

<style>
  .filter-section {
    padding: 0.75rem 0;
    border-bottom: 1px solid rgb(71, 85, 105);
  }

  .filter-title {
    font-size: 0.75rem;
    font-weight: 700;
    text-transform: uppercase;
    color: rgb(148, 163, 184);
    margin: 0 0 0.5rem 0;
    letter-spacing: 0.05em;
  }

  .filter-options {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .filter-option {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.375rem 0.5rem;
    border-radius: 0.25rem;
    cursor: pointer;
    transition: background-color 0.15s;
  }

  .filter-option:hover {
    background-color: rgba(71, 85, 105, 0.3);
  }

  .filter-option input[type="radio"] {
    accent-color: rgb(59, 130, 246);
    cursor: pointer;
    flex-shrink: 0;
  }

  .option-label {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.875rem;
    color: rgb(203, 213, 225);
    user-select: none;
  }

  .emoji {
    font-size: 1rem;
  }
</style>
