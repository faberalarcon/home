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

  function cssVar(name: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }

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
          backgroundColor: colors.length > 0 ? colors : data.map(() => defaultColor),
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
    chart.data.datasets[0].backgroundColor = colors.length > 0 ? colors : data.map(() => ink);
    chart.update();
  });
</script>

<div class="chart-box">
  <canvas bind:this={canvas}></canvas>
</div>

<style>
  .chart-box {
    position: relative;
    width: 100%;
    height: clamp(220px, 38vw, 300px);
    min-width: 0;
  }
  @media (max-width: 520px) {
    .chart-box { height: 220px; }
  }
</style>
