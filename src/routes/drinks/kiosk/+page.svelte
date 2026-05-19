<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { appPath } from '$lib/drinks/app-paths';
  import VoiceOrderButton from '$lib/drinks/components/VoiceOrderButton.svelte';
  import type { PageData } from './$types';

  let kioskToast = $state<string | null>(null);

  function showKioskToast(message: string, ms = 3000) {
    kioskToast = message;
    setTimeout(() => {
      if (kioskToast === message) kioskToast = null;
    }, ms);
  }

  let { data }: { data: PageData } = $props();

  type OrderEntry = typeof data.recentOrders[number];

  let clock = $state('');
  // svelte-ignore state_referenced_locally
  let recentOrders = $state<OrderEntry[]>(data.recentOrders);
  // svelte-ignore state_referenced_locally
  let todayTotal = $state(data.todayTotal);
  // svelte-ignore state_referenced_locally
  let leaderToday = $state(data.leaderToday);
  // svelte-ignore state_referenced_locally
  let topDrinkToday = $state(data.topDrinkToday);
  let newOrderPulse = $state(false);

  // Keep local state in sync if SvelteKit re-runs load (e.g. client-side nav).
  // SSE mutations between loads are still preserved — the load fires only when
  // the route re-enters, at which point a fresh snapshot is the right state.
  $effect(() => {
    recentOrders = data.recentOrders;
    todayTotal = data.todayTotal;
    leaderToday = data.leaderToday;
    topDrinkToday = data.topDrinkToday;
  });

  // Burn-in prevention: slowly drift background position
  let bgOffset = $state(0);

  let source: EventSource | null = null;
  let clockTimer: ReturnType<typeof setInterval>;
  let burnTimer: ReturnType<typeof setInterval>;

  function updateClock() {
    clock = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function timeAgo(d: Date | null) {
    if (!d) return '';
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    return `${Math.floor(s / 3600)}h ago`;
  }

  onMount(() => {
    updateClock();
    clockTimer = setInterval(updateClock, 10_000);
    burnTimer = setInterval(() => { bgOffset = (bgOffset + 1) % 20; }, 30_000);

    source = new EventSource(appPath('/api/stream'));
    source.addEventListener('order', (e) => {
      const ev = JSON.parse(e.data);
      todayTotal = ev.counts.today;

      const newEntry: OrderEntry = {
        id: ev.order.id,
        createdAt: new Date(ev.order.createdAt),
        profileName: ev.order.profileName,
        profileColor: ev.order.profileColor,
        drinkName: ev.order.drinkName,
        drinkCategory: ev.order.drinkCategory ?? ''
      };

      recentOrders = [newEntry, ...recentOrders].slice(0, 10);

      // Refresh leaderboard entry
      const pid = ev.order.profileId ?? ev.order.profile_id;
      const existing = leaderToday.find((p) => p.id === pid);
      if (existing) {
        leaderToday = leaderToday
          .map((p) => p.id === pid ? { ...p, c: p.c + 1 } : p)
          .sort((a, b) => b.c - a.c)
          .slice(0, 3);
      } else {
        leaderToday = [
          ...leaderToday,
          { id: pid, name: ev.order.profileName, color: ev.order.profileColor, c: 1, bac: 0, bacHasData: false }
        ].sort((a, b) => b.c - a.c).slice(0, 3);
      }

      newOrderPulse = true;
      setTimeout(() => (newOrderPulse = false), 1000);
    });

    source.addEventListener('order.deleted', (e) => {
      const ev = JSON.parse(e.data);
      if (typeof ev.counts?.today === 'number') todayTotal = ev.counts.today;
      recentOrders = recentOrders.filter((o) => o.id !== ev.orderId);
      if (typeof ev.profileId === 'number') {
        leaderToday = leaderToday
          .map((p) => (p.id === ev.profileId ? { ...p, c: Math.max(0, p.c - 1) } : p))
          .filter((p) => p.c > 0)
          .sort((a, b) => b.c - a.c)
          .slice(0, 3);
      }
    });
  });

  onDestroy(() => {
    source?.close();
    clearInterval(clockTimer);
    clearInterval(burnTimer);
  });
</script>

<svelte:head>
  <title>21 Bristoe — Kiosk</title>
</svelte:head>

<!-- Full-screen kiosk, no scroll -->
<div
  class="fixed inset-0 bg-slate-950 text-slate-100 flex flex-col overflow-hidden select-none"
  style="background-position: {bgOffset}px {bgOffset}px"
>
  <!-- Header bar -->
  <header class="flex items-center justify-between px-8 py-4 border-b border-slate-800/60 shrink-0">
    <div class="text-2xl font-bold tracking-tight">🍹 drink-hub</div>
    <div class="text-5xl font-mono font-light tabular-nums text-slate-300">{clock}</div>
    <div class="text-right">
      <div class="text-sm text-slate-500">today</div>
      <div class="text-3xl font-bold tabular-nums text-orange-400">{todayTotal}</div>
    </div>
  </header>

  <!-- Body -->
  <div class="flex flex-1 min-h-0">

    <!-- Left: recent orders ticker -->
    <div class="flex-1 flex flex-col p-8 min-w-0">
      <div class="text-xs uppercase tracking-widest text-slate-500 mb-4">Recent orders</div>

      {#if recentOrders.length === 0}
        <div class="flex-1 flex items-center justify-center text-slate-600 text-xl">No orders yet today</div>
      {:else}
        <!-- Big card for most recent -->
        <div
          class="rounded-2xl p-6 mb-4 border transition-all duration-500 {newOrderPulse
            ? 'border-orange-500/70 bg-orange-500/10'
            : 'border-slate-700 bg-slate-900/60'}"
        >
          <div class="flex items-center gap-4">
            <div
              class="w-14 h-14 rounded-full flex items-center justify-center text-2xl font-bold text-slate-950 shrink-0"
              style="background-color:{recentOrders[0].profileColor}"
            >
              {recentOrders[0].profileName[0]}
            </div>
            <div class="min-w-0">
              <div class="text-2xl font-semibold truncate">{recentOrders[0].drinkName}</div>
              <div class="text-slate-400 text-lg">{recentOrders[0].profileName}</div>
            </div>
            <div class="ml-auto text-slate-500 text-sm shrink-0">{timeAgo(recentOrders[0].createdAt)}</div>
          </div>
        </div>

        <!-- Older orders fading out -->
        <div class="flex flex-col gap-2 overflow-hidden">
          {#each recentOrders.slice(1) as o, i (o.id)}
            <div
              class="flex items-center gap-3 px-4 py-2 rounded-xl bg-slate-900/40"
              style="opacity: {Math.max(0.15, 0.7 - i * 0.1)}"
            >
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-slate-950 shrink-0"
                style="background-color:{o.profileColor}"
              >
                {o.profileName[0]}
              </div>
              <span class="text-sm flex-1 truncate">{o.profileName} — {o.drinkName}</span>
              <span class="text-xs text-slate-600 shrink-0">{timeAgo(o.createdAt)}</span>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Right: leaderboard -->
    <div class="w-72 shrink-0 flex flex-col p-8 border-l border-slate-800/60">
      <div class="text-xs uppercase tracking-widest text-slate-500 mb-4">Today's leaderboard</div>
      <div class="flex flex-col gap-3 flex-1">
        {#each leaderToday as p, i (p.id)}
          <div class="flex items-center gap-3 rounded-xl bg-slate-900/60 px-4 py-3">
            <div class="text-slate-600 font-bold w-4">{i + 1}</div>
            <div
              class="w-9 h-9 rounded-full flex items-center justify-center font-bold text-slate-950"
              style="background-color:{p.color}"
            >
              {p.name[0]}
            </div>
            <div class="flex-1 min-w-0">
              <div class="font-medium truncate">{p.name}</div>
              {#if p.bacHasData}
                <div class="text-xs tabular-nums {p.bac >= 0.08 ? 'text-red-400' : p.bac >= 0.05 ? 'text-yellow-400' : 'text-slate-500'}">
                  BAC ~{p.bac.toFixed(3)}%
                </div>
              {/if}
            </div>
            <div class="text-xl font-bold tabular-nums text-orange-400">{p.c}</div>
          </div>
        {/each}
        {#if leaderToday.length === 0}
          <div class="text-slate-600 text-sm flex-1 flex items-center justify-center">No orders yet</div>
        {/if}
      </div>

      {#if topDrinkToday}
        <div class="mt-6 pt-6 border-t border-slate-800/60">
          <div class="text-xs uppercase tracking-widest text-slate-500 mb-2">Most popular today</div>
          <div class="text-lg font-semibold">{topDrinkToday.name}</div>
          <div class="text-sm text-slate-400">{topDrinkToday.c} order{topDrinkToday.c === 1 ? '' : 's'}</div>
        </div>
      {/if}
    </div>
  </div>
</div>

<VoiceOrderButton
  onSubmitted={(summary) => showKioskToast(`Voice order: ${summary}`, 4000)}
  onError={(message) => showKioskToast(message, 3000)}
/>

{#if kioskToast}
  <div class="kiosk-toast">{kioskToast}</div>
{/if}

<style>
  .kiosk-toast {
    position: fixed;
    left: 50%;
    bottom: 1.25rem;
    transform: translateX(-50%);
    z-index: 70;
    padding: 0.55rem 1.1rem;
    border-radius: 999px;
    background: rgba(15, 23, 42, 0.92);
    color: #fef3c7;
    font-weight: 600;
    font-size: 0.95rem;
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }
</style>
