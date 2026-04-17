<script lang="ts">
  import { onMount } from 'svelte';

  let {
    label,
    value,
    unit = '',
    icon = '',
    sublabel = '',
    accent = false
  }: {
    label: string;
    value: string | number;
    unit?: string;
    icon?: string;
    sublabel?: string;
    accent?: boolean;
  } = $props();

  // Count-up on mount for numeric values only. Non-numeric strings render as-is.
  function parseNumeric(raw: string | number): { num: number; prefix: string; suffix: string } | null {
    const s = String(raw).trim();
    const m = s.match(/^(-?[\d,]+\.?\d*)(.*)$/);
    if (!m) return null;
    const numStr = m[1].replace(/,/g, '');
    const n = parseFloat(numStr);
    if (Number.isNaN(n)) return null;
    return { num: n, prefix: '', suffix: m[2] };
  }

  const parsed = parseNumeric(value);
  const target = parsed?.num ?? 0;
  let display = $state<string>(parsed ? formatNum(0, target) : String(value));

  function formatNum(n: number, ref: number): string {
    const decimals = Number.isInteger(ref) ? 0 : Math.min(2, String(ref).split('.')[1]?.length ?? 0);
    const rounded = decimals === 0 ? Math.round(n) : Math.round(n * 10 ** decimals) / 10 ** decimals;
    return rounded.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  onMount(() => {
    if (!parsed) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      display = formatNum(target, target) + parsed.suffix;
      return;
    }
    const duration = 800;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      display = formatNum(target * eased, target) + parsed.suffix;
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  });
</script>

<div
  class="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 sm:p-5 transition-all duration-300 hover:shadow-lg hover:shadow-slate-200/50 dark:hover:shadow-slate-900/50 hover:-translate-y-0.5"
  class:ring-2={accent}
  class:ring-sky-300={accent}
>
  <div class="flex items-start justify-between gap-2">
    <div class="min-w-0 flex-1">
      <p class="text-xs sm:text-sm font-medium text-slate-500 dark:text-slate-400 leading-tight">{label}</p>
      <p class="mt-1 text-xl sm:text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100 leading-tight tabular-nums">
        {display}<span class="text-xs sm:text-sm font-normal text-slate-400 dark:text-slate-500 ml-1">{unit}</span>
      </p>
      {#if sublabel}
        <p class="mt-1 text-xs text-slate-400 dark:text-slate-500 leading-tight">{sublabel}</p>
      {/if}
    </div>
    {#if icon}
      <span class="text-xl sm:text-2xl flex-shrink-0 group-hover:scale-110 transition-transform duration-300">{icon}</span>
    {/if}
  </div>
</div>
