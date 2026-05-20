<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appPath } from '$lib/drinks/app-paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // Live state — updated by SSE
  // svelte-ignore state_referenced_locally
  let totalToday = $state(data.totalToday);
  // svelte-ignore state_referenced_locally
  let totalWeek = $state(data.totalWeek);
  // svelte-ignore state_referenced_locally
  let totalAllTime = $state(data.totalAllTime);
  // svelte-ignore state_referenced_locally
  let leaderToday = $state(data.leaderToday);
  // svelte-ignore state_referenced_locally
  let leaderAllTime = $state(data.leaderAllTime);
  // svelte-ignore state_referenced_locally
  let topDrinks = $state(data.topDrinks);

  let tab = $state<'today' | 'all_time'>('today');
  // svelte-ignore state_referenced_locally
  let dowCounts = $state(data.dowCounts);
  let milestoneToast = $state<string | null>(null);
  let source: EventSource | null = null;

  // Re-sync when SvelteKit re-runs load. SSE-driven mutations are transient
  // between loads; on route re-entry the fresh snapshot wins.
  $effect(() => {
    totalToday = data.totalToday;
    totalWeek = data.totalWeek;
    totalAllTime = data.totalAllTime;
    leaderToday = data.leaderToday;
    leaderAllTime = data.leaderAllTime;
    topDrinks = data.topDrinks;
    dowCounts = data.dowCounts;
  });

  onMount(() => {
    source = new EventSource(appPath('/api/stream'));
    source.addEventListener('order', (e) => {
      const ev = JSON.parse(e.data);
      totalAllTime = ev.counts.allTime;
      totalToday = ev.counts.today;

      // Patch leaderboard today
      const pid = ev.order.profileId ?? ev.order.profile_id;
      const existing = leaderToday.find((p) => p.id === pid);
      if (existing) {
        leaderToday = leaderToday
          .map((p) => p.id === pid ? { ...p, c: p.c + 1 } : p)
          .sort((a, b) => b.c - a.c);
      } else {
        leaderToday = [
          ...leaderToday,
          { id: pid, name: ev.order.profileName, color: ev.order.profileColor, c: 1, bac: 0, bacHasData: false }
        ].sort((a, b) => b.c - a.c);
      }

      // Milestone toasts
      if (ev.firedMilestones?.length) {
        milestoneToast = ev.firedMilestones.map((m: { name: string }) => `🎉 ${m.name}`).join(' · ');
        setTimeout(() => (milestoneToast = null), 4000);
      }
    });
  });

  onDestroy(() => source?.close());

  const leaderboard = $derived(tab === 'today' ? leaderToday : leaderAllTime);
  const maxDrinkCount = $derived(topDrinks[0]?.c ?? 1);
</script>

<header class="stats-head">
  <p class="dossier-kicker">Drinks</p>
  <h1>Stats</h1>
</header>

<!-- Count strip -->
<div class="grid grid-cols-3 gap-3 mb-8">
  {#each [
    { label: 'Today', value: totalToday },
    { label: 'This week', value: totalWeek },
    { label: 'All time', value: totalAllTime }
  ] as s}
    <div class="drink-stat">
      <div class="drink-stat__value">{s.value}</div>
      <div class="drink-stat__label">{s.label}</div>
    </div>
  {/each}
</div>

<!-- Leaderboard -->
<div class="mb-8">
  <div class="flex items-center justify-between mb-3">
    <h2 class="section-label">Leaderboard</h2>
    <div class="segmented">
      <button
        onclick={() => (tab = 'today')}
        class:active={tab === 'today'}
      >Today</button>
      <button
        onclick={() => (tab = 'all_time')}
        class:active={tab === 'all_time'}
      >All time</button>
    </div>
  </div>

  {#if leaderboard.length === 0}
    <p class="text-slate-500 text-sm py-4 text-center">No orders yet.</p>
  {:else}
    <div class="space-y-2">
      {#each leaderboard as p, i (p.id)}
        <div class="leader-row">
          <div class="text-slate-500 text-sm w-5 text-center">{i + 1}</div>
          <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-slate-950"
            style="background-color:{p.color}">
            {p.name[0]}
          </div>
          <div class="flex-1 font-medium">{p.name}</div>
          {#if tab === 'today' && (p as any).bacHasData}
            {@const pct = (p as any).bac as number}
            <span class="text-xs px-2 py-0.5 rounded border tabular-nums
              {pct >= 0.08 ? 'bg-red-900/60 text-red-300 border-red-800'
              : pct >= 0.04 ? 'bg-amber-900/60 text-amber-300 border-amber-800'
              : 'bg-slate-800 text-slate-400 border-slate-700'}">
              ~{(pct * 100).toFixed(2)}%
            </span>
          {/if}
          <div class="text-lg font-bold tabular-nums">{p.c}</div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<!-- Top drinks bar chart -->
{#if topDrinks.length > 0}
  <div class="mb-6">
    <h2 class="section-label mb-3">Top items (all time)</h2>
    <div class="metric-panel space-y-3">
      {#each topDrinks as d (d.id)}
        {@const pct = Math.round((d.c / maxDrinkCount) * 100)}
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="font-medium">{d.name}</span>
            <span class="text-slate-400 tabular-nums">{d.c}</span>
          </div>
          <div class="metric-track">
            <div class="metric-bar" style="width:{pct}%"></div>
          </div>
        </div>
      {/each}
    </div>
  </div>
{/if}

<!-- Day-of-week histogram -->
{#if dowCounts.some((d) => d.count > 0)}
  {@const maxDow = Math.max(...dowCounts.map((d) => d.count), 1)}
  <div class="mb-8">
    <h2 class="section-label mb-3">Orders by day of week</h2>
    <div class="metric-panel">
      <div class="flex items-end justify-between gap-1 h-24">
        {#each dowCounts as d}
          {@const pct = d.count / maxDow}
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="text-xs text-slate-400 tabular-nums">{d.count > 0 ? d.count : ''}</div>
            <div
              class="dow-bar"
              style="height:{Math.max(pct * 72, d.count > 0 ? 4 : 2)}px"
            ></div>
            <div class="text-xs text-slate-500">{d.label}</div>
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<!-- Milestone toast -->
{#if milestoneToast}
  <div class="milestone-toast">
    {milestoneToast}
  </div>
{/if}

<style>
  .stats-head {
    margin-bottom: 1.5rem;
  }
  .stats-head h1 {
    font-size: clamp(2.25rem, 10vw, 4rem);
  }
  .drink-stat {
    border-top: 2px solid var(--color-blood-500);
    background: transparent;
    padding: 0.85rem 0 0;
    text-align: left;
  }
  .drink-stat__value {
    color: var(--color-ink-900);
    font-family: var(--font-mono);
    font-size: clamp(2rem, 9vw, 3rem);
    font-weight: 650;
    line-height: 1;
  }
  .drink-stat__label,
  .section-label {
    color: var(--color-ink-500);
    font-size: 0.72rem;
    font-weight: 800;
    letter-spacing: 0.16em;
    text-transform: uppercase;
  }
  .segmented {
    display: inline-flex;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm);
    overflow: hidden;
  }
  .segmented button {
    padding: 0.35rem 0.7rem;
    background: transparent;
    color: var(--color-ink-500);
    font-size: 0.75rem;
  }
  .segmented button.active {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }
  .leader-row,
  .metric-panel {
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    box-shadow: 0 1px 2px 0 color-mix(in oklab, var(--color-ink-900) 6%, transparent);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
  }
  .leader-row:hover,
  .metric-panel:hover {
    box-shadow: 0 4px 10px -2px color-mix(in oklab, var(--color-ink-900) 10%, transparent);
    transform: translateY(-1px);
  }
  .leader-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
  }
  .metric-panel {
    padding: 1rem;
  }
  @media (prefers-reduced-motion: reduce) {
    .leader-row,
    .metric-panel { transition: none; }
    .leader-row:hover,
    .metric-panel:hover { transform: none; }
  }
  .metric-track {
    height: 0.5rem;
    border-radius: 999px;
    background: var(--color-paper-200);
    overflow: hidden;
  }
  .metric-bar,
  .dow-bar {
    background: var(--color-blood-500);
    transition: width 0.5s ease, height 0.5s ease;
  }
  .metric-bar {
    height: 0.5rem;
    border-radius: 999px;
  }
  .dow-bar {
    width: 100%;
    border-radius: 0.35rem 0.35rem 0 0;
    min-height: 2px;
  }
  .milestone-toast {
    position: fixed;
    bottom: 1.5rem;
    left: 50%;
    transform: translateX(-50%);
    z-index: 50;
    border-radius: var(--radius);
    background: var(--color-blood-500);
    color: var(--color-paper-50);
    padding: 0.75rem 1.1rem;
    font-weight: 750;
    font-size: 0.875rem;
    box-shadow: 0 16px 42px color-mix(in oklab, var(--color-blood-600) 28%, transparent);
  }
  @media (prefers-reduced-motion: reduce) {
    .metric-bar,
    .dow-bar { transition: none; }
  }
</style>
