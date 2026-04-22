<script lang="ts">
  import { onMount, untrack } from 'svelte';

  let {
    label,
    value,
    unit = '',
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

  function parseNumeric(raw: string | number): { num: number; prefix: string; suffix: string } | null {
    const s = String(raw).trim();
    const m = s.match(/^(-?[\d,]+\.?\d*)(.*)$/);
    if (!m) return null;
    const numStr = m[1].replace(/,/g, '');
    const n = parseFloat(numStr);
    if (Number.isNaN(n)) return null;
    return { num: n, prefix: '', suffix: m[2] };
  }

  const parsed = untrack(() => parseNumeric(value));
  const target = parsed?.num ?? 0;
  let display = $state<string>(parsed ? formatNum(0, target) : untrack(() => String(value)));

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

<article class="stat" class:stat--accent={accent}>
  <p class="stat__label">{label}</p>
  <p class="stat__value">
    {display}{#if unit}<span class="stat__unit">{unit}</span>{/if}
  </p>
  {#if sublabel}
    <p class="stat__sub">{sublabel}</p>
  {/if}
</article>

<style>
  .stat {
    border-top: 1px solid var(--color-ink-900);
    padding: 1.25rem 0.1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.45rem;
    background: transparent;
    position: relative;
  }
  .stat--accent { border-top-color: var(--color-blood-500); border-top-width: 2px; }
  .stat__label {
    font-family: var(--font-body);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin: 0;
  }
  .stat__value {
    font-family: var(--font-mono);
    font-feature-settings: 'tnum', 'zero';
    font-size: clamp(1.75rem, 2.5vw + 0.5rem, 2.75rem);
    font-weight: 500;
    line-height: 1.05;
    color: var(--color-ink-900);
    margin: 0;
    letter-spacing: 0;
    word-break: break-word;
  }
  .stat--accent .stat__value { color: var(--color-blood-500); }
  .stat__unit {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-left: 0.3rem;
  }
  .stat__sub {
    font-family: var(--font-body);
    font-style: italic;
    font-size: 0.8125rem;
    color: var(--color-ink-500);
    margin: 0;
    line-height: 1.35;
  }
</style>
