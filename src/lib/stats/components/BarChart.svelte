<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, BarController, BarElement, CategoryScale, LinearScale, Tooltip } from 'chart.js';

  Chart.register(BarController, BarElement, CategoryScale, LinearScale, Tooltip);

  let {
    labels,
    data,
    colors = [],
    horizontal = false,
    label = 'Count',
    unit = ''
  }: {
    labels: string[];
    data: number[];
    colors?: string[];
    horizontal?: boolean;
    label?: string;
    unit?: string;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  const svgWidth = 320;
  const svgHeight = 180;

  function plotLeft(): number {
    return horizontal ? 78 : 38;
  }

  function plotRight(): number {
    return horizontal ? 18 : 10;
  }

  function plotTop(): number {
    return 14;
  }

  function plotBottom(): number {
    return 28;
  }

  function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function resolveColor(c: string, fallback: string): string {
    if (c.startsWith('var(--')) return cssVar(c.slice(4, -1), fallback);
    return c;
  }

  function fallbackColor(index: number): string {
    return colors[index] ?? 'var(--color-ink-900)';
  }

  function formatAxisValue(value: number): string {
    const abs = Math.abs(value);
    const formatted = Number.isInteger(value)
      ? String(value)
      : abs < 10
        ? value.toFixed(1).replace(/\.0$/, '')
        : value.toFixed(0);
    return `${formatted}${unit}`;
  }

  function tickIndexes(count: number, maxTicks: number): number[] {
    if (count <= 0) return [];
    if (count <= maxTicks) return Array.from({ length: count }, (_, index) => index);

    const last = count - 1;
    const indexes = new Set<number>();
    for (let i = 0; i < maxTicks; i += 1) {
      indexes.add(Math.round((i / (maxTicks - 1)) * last));
    }
    return [...indexes].sort((a, b) => a - b);
  }

  function shortLabel(value: string, max = 10): string {
    return value.length > max ? `${value.slice(0, max - 1)}…` : value;
  }

  const fallbackScale = $derived.by(() => {
    const finite = data.filter((value) => Number.isFinite(value));
    if (!data.length || !finite.length) return null;

    const maxValue = Math.max(...finite, 1);
    const left = plotLeft();
    const right = plotRight();
    const top = plotTop();
    const bottom = plotBottom();
    const width = svgWidth - left - right;
    const height = svgHeight - top - bottom;

    return { maxValue, left, top, width, height };
  });

  const fallbackBars = $derived.by(() => {
    if (!fallbackScale) return [];

    return data.map((value, index) => {
      const safeValue = Number.isFinite(value) ? value : 0;
      if (horizontal) {
        const rowHeight = fallbackScale.height / data.length;
        const barHeight = Math.max(5, rowHeight * 0.58);
        return {
          x: fallbackScale.left,
          y: fallbackScale.top + index * rowHeight + (rowHeight - barHeight) / 2,
          width: Math.max(1, (safeValue / fallbackScale.maxValue) * fallbackScale.width),
          height: barHeight,
          fill: fallbackColor(index)
        };
      }

      const colWidth = fallbackScale.width / data.length;
      const barWidth = Math.max(5, colWidth * 0.62);
      const barHeight = Math.max(1, (safeValue / fallbackScale.maxValue) * fallbackScale.height);
      return {
        x: fallbackScale.left + index * colWidth + (colWidth - barWidth) / 2,
        y: fallbackScale.top + fallbackScale.height - barHeight,
        width: barWidth,
        height: barHeight,
        fill: fallbackColor(index)
      };
    });
  });

  const fallbackValueTicks = $derived.by(() => {
    if (!fallbackScale) return [];
    return Array.from({ length: 5 }, (_, index) => {
      const value = (fallbackScale.maxValue * index) / 4;
      if (horizontal) {
        const x = fallbackScale.left + (value / fallbackScale.maxValue) * fallbackScale.width;
        return { value, x, y: fallbackScale.top + fallbackScale.height, label: formatAxisValue(value) };
      }
      const y = fallbackScale.top + fallbackScale.height - (value / fallbackScale.maxValue) * fallbackScale.height;
      return { value, x: fallbackScale.left, y, label: formatAxisValue(value) };
    });
  });

  const fallbackCategoryTicks = $derived.by(() => {
    if (!fallbackScale) return [];
    if (horizontal) {
      return tickIndexes(labels.length, 8).map((index) => {
        const rowHeight = fallbackScale.height / labels.length;
        return {
          x: fallbackScale.left - 6,
          y: fallbackScale.top + index * rowHeight + rowHeight / 2,
          label: shortLabel(labels[index] ?? '', 13)
        };
      });
    }

    return tickIndexes(labels.length, 7).map((index) => {
      const colWidth = fallbackScale.width / labels.length;
      return {
        x: fallbackScale.left + index * colWidth + colWidth / 2,
        y: fallbackScale.top + fallbackScale.height + 15,
        label: shortLabel(labels[index] ?? '', 9)
      };
    });
  });

  onMount(() => {
    const ink       = cssVar('--color-ink-900', '#1a1612');
    const inkMuted  = cssVar('--color-ink-500', '#6b6355');
    const paper100  = cssVar('--color-paper-100', '#f5efdf');
    const paper300  = cssVar('--color-paper-300', '#d6c9a5');
    const blood     = cssVar('--color-blood-500', '#7a1f1f');
    const defaultColor = ink;
    const fontBody  = "Inter Tight, system-ui, sans-serif";
    const fontMono  = "JetBrains Mono, ui-monospace, monospace";
    const smallScreen = window.matchMedia('(max-width: 520px)').matches;
    const tickFontSize = smallScreen ? 11 : 10;

    chart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label,
          data,
          backgroundColor: colors.length > 0 ? colors.map(c => resolveColor(c, defaultColor)) : data.map(() => defaultColor),
          hoverBackgroundColor: blood,
          borderRadius: 0,
          borderSkipped: false,
          barPercentage: 0.75,
          categoryPercentage: 0.85
        }]
      },
      options: {
        indexAxis: horizontal ? 'y' : 'x',
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 700, easing: 'easeOutQuart' },
        plugins: {
          tooltip: {
            backgroundColor: paper100,
            titleColor: ink,
            bodyColor: ink,
            borderColor: ink,
            borderWidth: 1,
            cornerRadius: 0,
            padding: 10,
            titleFont: { family: fontBody, weight: 'bold', size: 11 },
            bodyFont: { family: fontMono, size: 11 },
            displayColors: false
          }
        },
        scales: {
          x: {
            grid: { color: paper300, lineWidth: 0.5 },
            border: { color: ink, width: 1 },
            ticks: {
              color: inkMuted,
              font: { family: fontMono, size: tickFontSize },
              autoSkip: true,
              maxRotation: 0,
              maxTicksLimit: horizontal ? (smallScreen ? 4 : 5) : (smallScreen ? 5 : 7),
              callback: function (val) {
                if (horizontal && unit) return `${val}${unit}`;
                return (this as { getLabelForValue: (v: number) => string }).getLabelForValue(val as number);
              }
            }
          },
          y: {
            grid: { color: paper300, lineWidth: 0.5 },
            border: { color: ink, width: 1 },
            ticks: {
              color: inkMuted,
              font: { family: fontMono, size: tickFontSize },
              autoSkip: true,
              maxTicksLimit: horizontal ? 8 : (smallScreen ? 4 : 5),
              callback: function (val) {
                if (!horizontal && unit) return `${val}${unit}`;
                return (this as { getLabelForValue: (v: number) => string }).getLabelForValue(val as number);
              }
            }
          }
        }
      }
    });

    return () => chart?.destroy();
  });

  $effect(() => {
    if (!chart) return;
    const ink = cssVar('--color-ink-900', '#1a1612');
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
    chart.data.datasets[0].backgroundColor = colors.length > 0 ? colors.map(c => resolveColor(c, ink)) : data.map(() => ink);
    chart.update();
  });
</script>

<div class="chart-box">
  <canvas bind:this={canvas}></canvas>
  <svg
    class="chart-fallback"
    viewBox="0 0 {svgWidth} {svgHeight}"
    role="img"
    aria-label={label}
    preserveAspectRatio="none"
  >
    {#if fallbackScale}
      {#each fallbackValueTicks as tick}
        {#if horizontal}
          <line x1={tick.x} y1={fallbackScale.top} x2={tick.x} y2={fallbackScale.top + fallbackScale.height} class="chart-fallback__grid" />
          <text x={tick.x} y={fallbackScale.top + fallbackScale.height + 15} class="chart-fallback__tick chart-fallback__tick--x" text-anchor="middle">{tick.label}</text>
        {:else}
          <line x1={fallbackScale.left} y1={tick.y} x2={fallbackScale.left + fallbackScale.width} y2={tick.y} class="chart-fallback__grid" />
          <text x={fallbackScale.left - 5} y={tick.y} class="chart-fallback__tick chart-fallback__tick--y" text-anchor="end" dominant-baseline="middle">{tick.label}</text>
        {/if}
      {/each}
      {#each fallbackCategoryTicks as tick}
        {#if horizontal}
          <text x={tick.x} y={tick.y} class="chart-fallback__tick chart-fallback__tick--category" text-anchor="end" dominant-baseline="middle">{tick.label}</text>
        {:else}
          <text x={tick.x} y={tick.y} class="chart-fallback__tick chart-fallback__tick--category" text-anchor="middle">{tick.label}</text>
        {/if}
      {/each}
      <line x1={fallbackScale.left} y1={fallbackScale.top + fallbackScale.height} x2={fallbackScale.left + fallbackScale.width} y2={fallbackScale.top + fallbackScale.height} class="chart-fallback__axis" />
      <line x1={fallbackScale.left} y1={fallbackScale.top} x2={fallbackScale.left} y2={fallbackScale.top + fallbackScale.height} class="chart-fallback__axis" />
    {/if}
    {#each fallbackBars as bar}
      <rect
        x={bar.x}
        y={bar.y}
        width={bar.width}
        height={bar.height}
        fill={bar.fill}
        rx="1.5"
        vector-effect="non-scaling-stroke"
      />
    {/each}
  </svg>
</div>

<style>
  .chart-box {
    position: relative;
    width: 100%;
    height: clamp(220px, 38vw, 300px);
    min-width: 0;
  }
  .chart-fallback {
    display: none;
    width: 100%;
    height: 100%;
  }
  .chart-fallback__axis {
    stroke: var(--color-paper-300);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
  .chart-fallback__grid {
    stroke: var(--color-paper-300);
    stroke-width: 0.6;
    stroke-opacity: 0.65;
    vector-effect: non-scaling-stroke;
  }
  .chart-fallback__tick {
    fill: var(--color-ink-500);
    font-family: var(--font-mono);
    font-size: 8px;
  }
  :global(.swipe-page) .chart-box canvas {
    display: none !important;
  }
  :global(.swipe-page) .chart-fallback {
    display: block !important;
  }
  @media (max-width: 520px) {
    .chart-box { height: 220px; }
  }
</style>
