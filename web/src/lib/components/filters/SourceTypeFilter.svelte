<script lang="ts">
  export let selected: string[] = [];
  export let disabled = false;

  const sourceTypes = [
    { value: 'paper', label: '📄 Papers', color: 'blue' },
    { value: 'newsletter', label: '📧 Newsletters', color: 'emerald' },
    { value: 'blog', label: '✍️ Blogs', color: 'amber' },
    { value: 'tweet', label: '🐦 Social', color: 'purple' },
  ];

  function toggleType(value: string) {
    if (selected.includes(value)) {
      selected = selected.filter(t => t !== value);
    } else {
      selected = [...selected, value];
    }
  }
</script>

<fieldset class="space-y-0 w-full">
  <legend class="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2.5 block">Content Type</legend>
  <div class="space-y-1 w-full">
    {#each sourceTypes as type}
      <label class="flex items-center gap-3 cursor-pointer hover:bg-slate-800/60 px-3 py-3 rounded-md transition-colors min-h-[44px]">
        <input
          type="checkbox"
          checked={selected.includes(type.value)}
          on:change={() => toggleType(type.value)}
          {disabled}
          class="w-5 h-5 rounded flex-shrink-0"
        />
        <span class="text-sm text-slate-300 flex-1">{type.label}</span>
      </label>
    {/each}
  </div>
</fieldset>

<style>
  :global(input[type='checkbox']) {
    accent-color: rgb(37, 99, 235);
    cursor: pointer;
  }

  :global(input[type='checkbox']:disabled) {
    cursor: not-allowed;
    opacity: 0.5;
  }
</style>
