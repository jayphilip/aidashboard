<script lang="ts">
  export let data: Array<{ week: string; count: number }> = [];

  function generateSparklinePoints(): string {
    if (data.length === 0) return '';

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const width = 200;
    const height = 60;
    const padding = 4;

    const pointWidth = (width - 2 * padding) / Math.max(1, data.length - 1);
    const scale = (height - 2 * padding) / maxCount;

    const points = data.map((d, i) => {
      const x = padding + i * pointWidth;
      const y = height - padding - d.count * scale;
      return `${x},${y}`;
    });

    return points.join(' ');
  }

  function generateBarChart(): string {
    if (data.length === 0) return '';

    const maxCount = Math.max(...data.map(d => d.count), 1);
    const bars: string[] = [];
    const barWidth = 12;
    const spacing = 4;
    const height = 40;
    const padding = 2;

    data.forEach((d, i) => {
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
    {generateBarChart()}
  </svg>
  <div class="text-xs text-slate-400">
    <div>Peak: {Math.max(...data.map(d => d.count), 0)}</div>
    <div>Avg: {data.length > 0 ? Math.round(data.reduce((a, b) => a + b.count, 0) / data.length) : 0}</div>
  </div>
</div>

<style>
  :global(svg rect) {
    fill: #3b82f6;
  }
</style>
