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
  const svgPad = 18;

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

  const fallbackBars = $derived.by(() => {
    const finite = data.filter((value) => Number.isFinite(value));
    if (!data.length || !finite.length) return [];

    const maxValue = Math.max(...finite, 1);
    const plotWidth = svgWidth - svgPad * 2;
    const plotHeight = svgHeight - svgPad * 2;

    return data.map((value, index) => {
      const safeValue = Number.isFinite(value) ? value : 0;
      if (horizontal) {
        const rowHeight = plotHeight / data.length;
        const barHeight = Math.max(5, rowHeight * 0.58);
        return {
          x: svgPad,
          y: svgPad + index * rowHeight + (rowHeight - barHeight) / 2,
          width: Math.max(1, (safeValue / maxValue) * plotWidth),
          height: barHeight,
          fill: fallbackColor(index)
        };
      }

      const colWidth = plotWidth / data.length;
      const barWidth = Math.max(5, colWidth * 0.62);
      const barHeight = Math.max(1, (safeValue / maxValue) * plotHeight);
      return {
        x: svgPad + index * colWidth + (colWidth - barWidth) / 2,
        y: svgHeight - svgPad - barHeight,
        width: barWidth,
        height: barHeight,
        fill: fallbackColor(index)
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
              font: { family: fontMono, size: 10 },
              autoSkip: true,
              maxRotation: horizontal ? 0 : 0,
              maxTicksLimit: horizontal ? 5 : 7,
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
              font: { family: fontMono, size: 10 },
              autoSkip: true,
              maxTicksLimit: horizontal ? 8 : 5,
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
    <line x1={svgPad} y1={svgHeight - svgPad} x2={svgWidth - svgPad} y2={svgHeight - svgPad} class="chart-fallback__axis" />
    <line x1={svgPad} y1={svgPad} x2={svgPad} y2={svgHeight - svgPad} class="chart-fallback__axis" />
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
  :global(.swipe-page) .chart-box canvas {
    display: none;
  }
  :global(.swipe-page) .chart-fallback {
    display: block;
  }
  @media (max-width: 520px) {
    .chart-box { height: 220px; }
  }
</style>
