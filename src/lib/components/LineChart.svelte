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
    const line      = color || ink;
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
              maxTicksLimit: 10
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
</script>

<div class="relative w-full" style="height: 280px">
  <canvas bind:this={canvas}></canvas>
</div>
