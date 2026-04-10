<script lang="ts">
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
    href="/admin/orders/export?format=csv"
    class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition"
    download
  >Export CSV</a>
</div>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-6">
  <div class="overflow-x-auto">
    <table class="w-full text-sm min-w-[36rem]">
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

<div class="flex gap-3">
  {#if data.before}
    <a href="/admin/orders" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">← Newer</a>
  {/if}
  {#if data.hasMore && data.nextBefore}
    <a href="/admin/orders?before={data.nextBefore}" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">Older →</a>
  {/if}
</div>
