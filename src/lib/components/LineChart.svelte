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

  function rawColor(c: string | undefined, fallback: string): string {
    return c || fallback;
  }

  const fallbackColor = $derived(rawColor(color, 'var(--color-ink-900)'));
  const fallbackPoints = $derived.by(() => {
    const finite = data.filter((value) => Number.isFinite(value));
    if (data.length === 0 || finite.length === 0) return '';

    const minValue = beginAtZero ? Math.min(0, ...finite) : Math.min(...finite);
    const maxValue = Math.max(...finite);
    const range = Math.max(maxValue - minValue, 1);
    const plotWidth = svgWidth - svgPad * 2;
    const plotHeight = svgHeight - svgPad * 2;

    return data
      .map((value, index) => {
        const safeValue = Number.isFinite(value) ? value : minValue;
        const x = svgPad + (data.length === 1 ? plotWidth / 2 : (index / (data.length - 1)) * plotWidth);
        const y = svgHeight - svgPad - ((safeValue - minValue) / range) * plotHeight;
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  });

  const fallbackArea = $derived.by(() => {
    if (!fill || !fallbackPoints) return '';
    const points = fallbackPoints.split(' ');
    const firstX = points[0]?.split(',')[0] ?? String(svgPad);
    const lastX = points[points.length - 1]?.split(',')[0] ?? String(svgWidth - svgPad);
    return `${firstX},${svgHeight - svgPad} ${fallbackPoints} ${lastX},${svgHeight - svgPad}`;
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
              font: { family: fontMono, size: 10 },
              autoSkip: true,
              maxRotation: 0,
              maxTicksLimit: 7
            }
          },
          y: {
            grid: { color: paper300, lineWidth: 0.5 },
            border: { color: ink, width: 1 },
            ticks: {
              color: inkMuted,
              font: { family: fontMono, size: 10 },
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
    <line x1={svgPad} y1={svgHeight - svgPad} x2={svgWidth - svgPad} y2={svgHeight - svgPad} class="chart-fallback__axis" />
    <line x1={svgPad} y1={svgPad} x2={svgPad} y2={svgHeight - svgPad} class="chart-fallback__axis" />
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
