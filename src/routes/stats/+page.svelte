<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
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
    source = new EventSource('/api/stream');
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

<h1 class="text-2xl font-semibold mb-6">Stats</h1>

<!-- Count strip -->
<div class="grid grid-cols-3 gap-3 mb-8">
  {#each [
    { label: 'Today', value: totalToday },
    { label: 'This week', value: totalWeek },
    { label: 'All time', value: totalAllTime }
  ] as s}
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 text-center">
      <div class="text-3xl font-bold tabular-nums">{s.value}</div>
      <div class="text-xs text-slate-400 mt-1">{s.label}</div>
    </div>
  {/each}
</div>

<!-- Leaderboard -->
<div class="mb-8">
  <div class="flex items-center justify-between mb-3">
    <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-400">Leaderboard</h2>
    <div class="flex gap-1 text-xs">
      <button
        onclick={() => (tab = 'today')}
        class="px-3 py-1 rounded-full transition {tab === 'today' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}"
      >Today</button>
      <button
        onclick={() => (tab = 'all_time')}
        class="px-3 py-1 rounded-full transition {tab === 'all_time' ? 'bg-slate-700 text-white' : 'text-slate-500 hover:text-slate-300'}"
      >All time</button>
    </div>
  </div>

  {#if leaderboard.length === 0}
    <p class="text-slate-500 text-sm py-4 text-center">No orders yet.</p>
  {:else}
    <div class="space-y-2">
      {#each leaderboard as p, i (p.id)}
        <div class="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
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
    <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">Top items (all time)</h2>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4 space-y-3">
      {#each topDrinks as d (d.id)}
        {@const pct = Math.round((d.c / maxDrinkCount) * 100)}
        <div>
          <div class="flex justify-between text-sm mb-1">
            <span class="font-medium">{d.name}</span>
            <span class="text-slate-400 tabular-nums">{d.c}</span>
          </div>
          <div class="h-2 bg-slate-800 rounded-full overflow-hidden">
            <div class="h-2 rounded-full bg-orange-500 transition-all duration-500" style="width:{pct}%"></div>
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
    <h2 class="text-sm font-semibold uppercase tracking-widest text-slate-400 mb-3">Orders by day of week</h2>
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div class="flex items-end justify-between gap-1 h-24">
        {#each dowCounts as d}
          {@const pct = d.count / maxDow}
          <div class="flex-1 flex flex-col items-center gap-1">
            <div class="text-xs text-slate-400 tabular-nums">{d.count > 0 ? d.count : ''}</div>
            <div
              class="w-full rounded-t bg-orange-500/80 transition-all duration-500 min-h-[2px]"
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
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-orange-500 text-slate-950 font-semibold px-5 py-3 rounded-full shadow-xl text-sm z-50">
    {milestoneToast}
  </div>
{/if}
