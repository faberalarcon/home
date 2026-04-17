<script lang="ts">
  import { onMount } from 'svelte';
  import { Chart, LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler } from 'chart.js';

  Chart.register(LineController, LineElement, PointElement, CategoryScale, LinearScale, Tooltip, Filler);

  let {
    labels,
    data,
    label = 'Value',
    color = '#7dd3fc',
    fill = true,
    unit = ''
  }: {
    labels: string[];
    data: number[];
    label?: string;
    color?: string;
    fill?: boolean;
    unit?: string;
  } = $props();

  let canvas: HTMLCanvasElement;
  let chart: Chart;

  onMount(() => {
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.2)';
    const textColor = isDark ? '#94a3b8' : '#64748b';

    chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels,
        datasets: [{
          label,
          data,
          borderColor: color,
          backgroundColor: fill ? `${color}20` : 'transparent',
          fill,
          tension: 0.3,
          pointRadius: data.length > 30 ? 0 : 3,
          pointHoverRadius: 5,
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 1000, easing: 'easeOutQuart' },
        plugins: {
          tooltip: {
            backgroundColor: isDark ? '#1e293b' : '#ffffff',
            titleColor: isDark ? '#e2e8f0' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: isDark ? '#334155' : '#e2e8f0',
            borderWidth: 1,
            cornerRadius: 8,
            padding: 10
          }
        },
        scales: {
          x: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { size: 11 }, maxTicksLimit: 10 }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { size: 11 },
              callback: (val) => (unit ? `${val}${unit}` : String(val))
            },
            beginAtZero: true
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
