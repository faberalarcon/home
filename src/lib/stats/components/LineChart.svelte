<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from 'chart.js';

  Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

  let {
    labels,
    data,
    label = 'Value',
    color,
    fill = false,
    unit = '',
    beginAtZero = false
  }: {
    labels: string[];
    data: number[];
    label?: string;
    color?: string;
    fill?: boolean;
    unit?: string;
    beginAtZero?: boolean;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart;
  const svgWidth = 320;
  const svgHeight = 180;
  const plotLeft = 42;
  const plotRight = 10;
  const plotTop = 14;
  const plotBottom = 28;
  const plotWidth = svgWidth - plotLeft - plotRight;
  const plotHeight = svgHeight - plotTop - plotBottom;

  function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

  function resolveColor(c: string, fallback: string): string {
    if (c.startsWith('var(--')) return cssVar(c.slice(4, -1), fallback);
    return c;
  }

  function rawColor(c: string | undefined, fallback: string): string {
    return c || fallback;
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

  function labelForAxis(value: string): string {
    return value.length > 10 ? `${value.slice(0, 9)}…` : value;
  }

  const fallbackScale = $derived.by(() => {
    const finite = data.filter((value) => Number.isFinite(value));
    if (data.length === 0 || finite.length === 0) return null;

    const minValue = beginAtZero ? Math.min(0, ...finite) : Math.min(...finite);
    const rawMaxValue = Math.max(...finite);
    const maxValue = rawMaxValue === minValue ? minValue + 1 : rawMaxValue;
    const range = Math.max(maxValue - minValue, 1);

    return { minValue, maxValue, range };
  });

  const fallbackColor = $derived(rawColor(color, 'var(--color-ink-900)'));
  const fallbackPoints = $derived.by(() => {
    if (!fallbackScale) return '';

    return data
      .map((value, index) => {
        const safeValue = Number.isFinite(value) ? value : fallbackScale.minValue;
        const x = plotLeft + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
        const y = plotTop + plotHeight - ((safeValue - fallbackScale.minValue) / fallbackScale.range) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  const fallbackArea = $derived.by(() => {
    if (!fill || !fallbackPoints) return '';
    const points = fallbackPoints.split(' ');
    const firstX = points[0]?.split(',')[0] ?? String(plotLeft);
    const lastX = points[points.length - 1]?.split(',')[0] ?? String(plotLeft + plotWidth);
    const baseline = plotTop + plotHeight;
    return `${firstX},${baseline} ${fallbackPoints} ${lastX},${baseline}`;
  });

  const fallbackYTicks = $derived.by(() => {
    if (!fallbackScale) return [];
    return Array.from({ length: 5 }, (_, index) => {
      const value = fallbackScale.minValue + (fallbackScale.range * index) / 4;
      const y = plotTop + plotHeight - ((value - fallbackScale.minValue) / fallbackScale.range) * plotHeight;
      return { value, y, label: formatAxisValue(value) };
    });
  });

  const fallbackXTicks = $derived.by(() => {
    return tickIndexes(labels.length, 7).map((index) => {
      const x = plotLeft + (labels.length === 1 ? plotWidth / 2 : (index / (labels.length - 1)) * plotWidth);
      return { x, label: labelForAxis(labels[index] ?? '') };
    });
  });

  onMount(() => {
    const ink       = cssVar('--color-ink-900', '#1a1612');
    const inkMuted  = cssVar('--color-ink-500', '#6b6355');
    const paper100  = cssVar('--color-paper-100', '#f5efdf');
    const paper300  = cssVar('--color-paper-300', '#d6c9a5');
    const blood     = cssVar('--color-blood-500', '#7a1f1f');
    const line      = color ? resolveColor(color, ink) : ink;
    const fontBody  = "Inter Tight, system-ui, sans-serif";
    const fontMono  = "JetBrains Mono, ui-monospace, monospace";
    const smallScreen = window.matchMedia('(max-width: 520px)').matches;
    const tickFontSize = smallScreen ? 11 : 10;

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderColor: line,
          backgroundColor: fill ? `${line}1A` : 'transparent',
          fill,
          tension: 0.25,
          pointRadius: data.length > 30 ? 0 : 2.5,
          pointHitRadius: 12,
          pointHoverRadius: 4,
          pointHoverBorderColor: blood,
          pointHoverBackgroundColor: blood,
          borderWidth: 1.25
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 800, easing: 'easeOutQuart' },
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
              maxTicksLimit: smallScreen ? 5 : 7
            }
          },
          y: {
            grid: { color: paper300, lineWidth: 0.5 },
            border: { color: ink, width: 1 },
            ticks: {
              color: inkMuted,
              font: { family: fontMono, size: tickFontSize },
              maxTicksLimit: smallScreen ? 4 : undefined,
              callback: (val) => (unit ? `${val}${unit}` : String(val))
            },
            beginAtZero
          }
        }
      }
    });

    return () => chart?.destroy();
  });

  $effect(() => {
    if (!chart) return;
    chart.data.labels = labels;
    chart.data.datasets[0].data = data;
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
    {#each fallbackYTicks as tick}
      <line x1={plotLeft} y1={tick.y} x2={plotLeft + plotWidth} y2={tick.y} class="chart-fallback__grid" />
      <text x={plotLeft - 5} y={tick.y} class="chart-fallback__tick chart-fallback__tick--y" text-anchor="end" dominant-baseline="middle">{tick.label}</text>
    {/each}
    {#each fallbackXTicks as tick}
      <text x={tick.x} y={plotTop + plotHeight + 15} class="chart-fallback__tick chart-fallback__tick--x" text-anchor="middle">{tick.label}</text>
    {/each}
    <line x1={plotLeft} y1={plotTop + plotHeight} x2={plotLeft + plotWidth} y2={plotTop + plotHeight} class="chart-fallback__axis" />
    <line x1={plotLeft} y1={plotTop} x2={plotLeft} y2={plotTop + plotHeight} class="chart-fallback__axis" />
    {#if fallbackArea}
      <polygon points={fallbackArea} fill={fallbackColor} opacity="0.12" />
    {/if}
    {#if fallbackPoints}
      <polyline points={fallbackPoints} fill="none" stroke={fallbackColor} stroke-width="3" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke" />
    {/if}
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
