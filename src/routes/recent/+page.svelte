<script lang="ts">
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function timeAgo(d: Date) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }
</script>

<h1 class="text-2xl font-semibold mb-4">Recent orders</h1>

{#if data.recent.length === 0}
  <p class="text-slate-400 text-sm">No orders yet. Go order something!</p>
{:else}
  <ul class="space-y-2">
    {#each data.recent as o (o.id)}
      <li class="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3">
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-950"
          style="background-color: {o.profileColor}"
        >
          {o.profileName[0]}
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-sm">
            <span class="font-medium">{o.profileName}</span>
            <span class="text-slate-400"> ordered </span>
            <span class="font-medium">{o.drinkName}</span>
          </div>
          <div class="text-xs text-slate-500">{timeAgo(o.createdAt)}</div>
        </div>
      </li>
    {/each}
  </ul>
{/if}
