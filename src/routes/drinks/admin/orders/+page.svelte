<script lang="ts">
  import { appPath } from '$lib/drinks/app-paths';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  function formatDate(d: Date | null) {
    if (!d) return '—';
    return new Date(d).toLocaleString();
  }

  let reassignId = $state<number | null>(null);
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-semibold">Orders</h1>
  <a
    href={`${appPath('/admin/orders/export')}?format=csv`}
    class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
    download
  >Export CSV</a>
</div>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

<!-- Desktop table -->
<div class="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 text-left">
          <th class="px-4 py-3 font-medium">Time</th>
          <th class="px-4 py-3 font-medium">Profile</th>
          <th class="px-4 py-3 font-medium">Drink</th>
          <th class="px-4 py-3 font-medium text-right">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.items as o (o.id)}
          <tr class="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
            <td class="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">{formatDate(o.createdAt)}</td>
            <td class="px-4 py-3">
              <span class="inline-block w-2 h-2 rounded-full mr-1.5" style="background-color:{o.profileColor}"></span>
              {o.profileName}
            </td>
            <td class="px-4 py-3">{o.drinkName}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-3">
                <button
                  class="text-xs text-slate-400 hover:text-white"
                  onclick={() => (reassignId = reassignId === o.id ? null : o.id)}
                >Reassign</button>
                <form method="POST" action="?/delete" class="contents"
                  onsubmit={(e) => { if (!confirm('Delete this order?')) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={o.id} />
                  <button type="submit" class="text-xs text-red-500 hover:text-red-400">Delete</button>
                </form>
              </div>

              {#if reassignId === o.id}
                <form method="POST" action="?/reassign" class="mt-2 flex gap-2 justify-end">
                  <input type="hidden" name="id" value={o.id} />
                  <input
                    name="profileId" type="number"
                    placeholder="Profile ID"
                    class="w-24 bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs"
                  />
                  <button type="submit" class="text-xs px-2 py-1 rounded bg-orange-500 text-slate-950 font-semibold">Save</button>
                </form>
              {/if}
            </td>
          </tr>
        {/each}
        {#if data.items.length === 0}
          <tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">No orders.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- Mobile card list -->
<div class="md:hidden flex flex-col gap-3 mb-6">
  {#each data.items as o (o.id)}
    <div class="bg-slate-900 border border-slate-800 rounded-xl p-4">
      <div class="flex items-center justify-between gap-3 mb-2">
        <div class="flex items-center gap-2 min-w-0">
          <span class="inline-block w-2.5 h-2.5 rounded-full shrink-0" style="background-color:{o.profileColor}"></span>
          <span class="font-medium truncate">{o.profileName}</span>
        </div>
        <span class="text-xs text-slate-500 whitespace-nowrap">{formatDate(o.createdAt)}</span>
      </div>
      <div class="text-slate-200 mb-3">{o.drinkName}</div>
      <div class="flex flex-wrap gap-2">
        <button
          class="text-sm px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
          onclick={() => (reassignId = reassignId === o.id ? null : o.id)}
        >Reassign</button>
        <form method="POST" action="?/delete" class="contents"
          onsubmit={(e) => { if (!confirm('Delete this order?')) e.preventDefault(); }}>
          <input type="hidden" name="id" value={o.id} />
          <button type="submit" class="text-sm px-3 py-2 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900/60">Delete</button>
        </form>
      </div>
      {#if reassignId === o.id}
        <form method="POST" action="?/reassign" class="mt-3 flex gap-2">
          <input type="hidden" name="id" value={o.id} />
          <input
            name="profileId" type="number"
            placeholder="Profile ID"
            class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-base"
          />
          <button type="submit" class="text-sm px-3 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold">Save</button>
        </form>
      {/if}
    </div>
  {/each}
  {#if data.items.length === 0}
    <div class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-8 text-center text-slate-500">No orders.</div>
  {/if}
</div>

<div class="flex gap-3">
  {#if data.before}
    <a href={appPath('/admin/orders')} class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">← Newer</a>
  {/if}
  {#if data.hasMore && data.nextBefore}
    <a href={`${appPath('/admin/orders')}?before=${data.nextBefore}`} class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">Older →</a>
  {/if}
</div>
