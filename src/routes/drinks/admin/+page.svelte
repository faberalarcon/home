<script lang="ts">
  import { appPath } from '$lib/drinks/app-paths';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const haLabel = {
    ok: '✓ Connected',
    error: '✗ Unreachable',
    unconfigured: '— Not configured'
  };
  const haClass = {
    ok: 'text-emerald-400',
    error: 'text-red-400',
    unconfigured: 'text-slate-500'
  };
</script>

<h1 class="text-2xl font-semibold mb-6">Dashboard</h1>

<div class="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div class="text-3xl font-bold">{data.totalOrders}</div>
    <div class="text-sm text-slate-400 mt-1">Total orders</div>
  </div>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div class="text-3xl font-bold">{data.activeDrinks}</div>
    <div class="text-sm text-slate-400 mt-1">Active items</div>
  </div>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div class="text-3xl font-bold">{data.activeProfiles}</div>
    <div class="text-sm text-slate-400 mt-1">Active profiles</div>
  </div>
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
    <div class="text-sm font-medium mb-1">Home Assistant</div>
    <div class="text-sm font-semibold {haClass[data.haStatus]}">{haLabel[data.haStatus]}</div>
    {#if data.failedEvents > 0}
      <a href={`${appPath('/admin/ha-log')}?filter=failure`} class="text-xs text-amber-400 hover:underline mt-1 block">
        {data.failedEvents} failed event{data.failedEvents === 1 ? '' : 's'}
      </a>
    {/if}
  </div>
</div>

{#if form?.cleared}
  <div class="mb-6 px-4 py-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-sm text-emerald-300">Stats cleared — counts now start from this moment.</div>
{/if}

<div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
  {#each [
    { href: '/admin/drinks', label: 'Manage items', desc: 'Add, edit, or remove items from the menu' },
    { href: '/admin/profiles', label: 'Manage profiles', desc: 'Household members and guests' },
    { href: '/admin/milestones', label: 'Milestones', desc: 'Configure HA trigger thresholds' },
    { href: '/admin/settings', label: 'Settings', desc: 'HA connection, site name' },
    { href: '/admin/ha-log', label: 'HA event log', desc: 'Recent event dispatch history' },
  ] as card}
    <a
      href={appPath(card.href)}
      class="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 transition"
    >
      <div class="font-medium mb-1">{card.label}</div>
      <div class="text-xs text-slate-400">{card.desc}</div>
    </a>
  {/each}
</div>

<div class="mt-8 border border-red-900/40 rounded-xl p-5">
  <h2 class="text-sm font-semibold text-red-400 mb-3">Danger zone</h2>
  <form method="POST" action="?/clearStats"
    onsubmit={(e) => { if (!confirm('Reset stats? Order history is preserved — counts restart from this moment.')) e.preventDefault(); }}>
    <button
      type="submit"
      class="px-4 py-2 rounded-lg bg-red-950 border border-red-800 text-red-300 text-sm hover:bg-red-900 transition"
    >Clear stats</button>
    <p class="text-xs text-slate-500 mt-2">Orders are not deleted. Stats will only count orders placed after this point.</p>
  </form>
</div>
