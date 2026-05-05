<script lang="ts">
  import { appPath } from '$lib/app-paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  type Row = PageData['recent'][number];

  // Local reactive copy so we can optimistically remove items
  // svelte-ignore state_referenced_locally
  let rows = $state<Row[]>(data.recent);
  let undoItem = $state<Row | null>(null);
  let undoTimer: ReturnType<typeof setTimeout> | null = null;

  // Re-sync when SvelteKit re-runs load (client-side nav back to this page).
  $effect(() => {
    rows = data.recent;
  });

  function timeAgo(d: Date) {
    const s = Math.floor((Date.now() - d.getTime()) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.floor(s / 60)}m ago`;
    if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
    return `${Math.floor(s / 86400)}d ago`;
  }

  async function deleteOrder(row: Row) {
    // Optimistic remove
    rows = rows.filter((r) => r.id !== row.id);
    undoItem = row;

    if (undoTimer) clearTimeout(undoTimer);
    undoTimer = setTimeout(() => {
      undoItem = null;
    }, 30_000);

    try {
      await fetch(appPath(`/api/orders/${row.id}`), { method: 'DELETE' });
    } catch {
      // Revert on failure
      rows = [row, ...rows].sort((a, b) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      );
      undoItem = null;
    }
  }

  async function undoDelete() {
    if (!undoItem) return;
    const item = undoItem;
    undoItem = null;
    if (undoTimer) clearTimeout(undoTimer);

    try {
      await fetch(appPath(`/api/orders/${item.id}`), { method: 'PUT' });
      rows = [item, ...rows].sort((a, b) =>
        (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0)
      );
    } catch {
      // silently fail — order stays deleted
    }
  }
</script>

<h1 class="text-2xl font-semibold mb-4">Recent orders</h1>

{#if rows.length === 0}
  <p class="text-slate-400 text-sm">No orders yet. Go order something!</p>
{:else}
  <ul class="space-y-2">
    {#each rows as o (o.id)}
      <li class="flex items-center gap-3 bg-slate-900 border border-slate-800 rounded-xl p-3 group">
        <div
          class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-slate-950 shrink-0"
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
        <button
          onclick={() => deleteOrder(o)}
          class="opacity-0 group-hover:opacity-100 focus:opacity-100 text-slate-600 hover:text-red-400 transition text-sm px-2 py-1 rounded"
          aria-label="Remove order"
          title="Remove order"
        >
          ✕
        </button>
      </li>
    {/each}
  </ul>
{/if}

{#if undoItem}
  <div class="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-slate-800 border border-slate-700 px-4 py-2.5 rounded-full text-sm shadow-lg z-50">
    <span class="text-slate-300">Order removed</span>
    <button
      onclick={undoDelete}
      class="text-orange-400 font-semibold hover:text-orange-300 transition"
    >
      Undo
    </button>
  </div>
{/if}
