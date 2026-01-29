<script lang="ts">
  export let data: Array<{ week: string; count: number }> = [];

  // Memoized calculations - only recompute when data changes
  $: barChart = generateBarChart(data);
  $: peakValue = data.length > 0 ? Math.max(...data.map(d => d.count)) : 0;
  $: avgValue = data.length > 0 ? Math.round(data.reduce((a, b) => a + b.count, 0) / data.length) : 0;

  function generateBarChart(chartData: Array<{ week: string; count: number }>): string {
    if (chartData.length === 0) return '';

    const maxCount = Math.max(...chartData.map(d => d.count), 1);
    const bars: string[] = [];
    const barWidth = 12;
    const spacing = 4;
    const height = 40;
    const padding = 2;

    chartData.forEach((d, i) => {
      const x = padding + i * (barWidth + spacing);
      const barHeight = (d.count / maxCount) * height;
      const y = height + padding - barHeight;

      bars.push(`<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" fill="#3b82f6" />`);
    });

    return bars.join('');
  }
</script>

<div class="flex items-center gap-2">
  <svg width="120" height="50" class="flex-shrink-0">
    {@html barChart}
  </svg>
  <div class="text-xs text-slate-400">
    <div>Peak: {peakValue}</div>
    <div>Avg: {avgValue}</div>
  </div>
</div>

<style>
  :global(svg rect) {
    fill: #3b82f6;
  }
</style>
