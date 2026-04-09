<script lang="ts">
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const CATEGORIES = ['cocktail', 'beer', 'wine', 'spirit', 'non-alcoholic', 'other'];
</script>

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-3">
    <h1 class="text-2xl font-semibold">Drinks</h1>
    {#if data.inactiveCount > 0}
      <a
        href="/admin/drinks?{data.showInactive ? '' : 'inactive=1'}"
        class="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition"
      >
        {data.showInactive ? 'Hide inactive' : `+${data.inactiveCount} hidden`}
      </a>
    {/if}
  </div>
  <a href="/admin/drinks" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">+ New drink</a>
</div>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

<!-- Table -->
<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-800 text-slate-400 text-left">
        <th class="px-4 py-3 font-medium">Name</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">Category</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">HA event</th>
        <th class="px-4 py-3 font-medium text-center">Active</th>
        <th class="px-4 py-3 font-medium text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.drinks as d (d.id)}
        <tr class="border-b border-slate-800/50 last:border-0 {data.editing?.id === d.id ? 'bg-slate-800/40' : !d.active ? 'opacity-50 hover:opacity-75' : 'hover:bg-slate-800/20'} transition">
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              {#if d.imageUrl}
                <img src={d.imageUrl.replace('.webp', '-thumb.webp')} alt="" class="w-8 h-8 rounded object-cover" />
              {:else}
                <div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-base">🍸</div>
              {/if}
              <span class="font-medium">{d.name}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">{d.category}</td>
          <td class="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{d.haTriggerEvent ?? '—'}</td>
          <td class="px-4 py-3 text-center">{d.active ? '✓' : '–'}</td>
          <td class="px-4 py-3 text-right space-x-2">
            <a href="/admin/drinks?edit={d.id}{data.showInactive ? '&inactive=1' : ''}" class="text-slate-400 hover:text-white text-xs">Edit</a>
            <form method="POST" action="?/toggleActive" class="inline">
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" class="text-xs {d.active ? 'text-slate-500 hover:text-amber-400' : 'text-emerald-600 hover:text-emerald-400'}">
                {d.active ? 'Hide' : 'Show'}
              </button>
            </form>
            <form method="POST" action="?/delete" class="inline" onsubmit={(e) => { if (!confirm(`Delete ${d.name}? This cannot be undone.`)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={d.id} />
              <button type="submit" class="text-red-500 hover:text-red-400 text-xs">Delete</button>
            </form>
          </td>
        </tr>
      {/each}
      {#if data.drinks.length === 0}
        <tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">
          {data.showInactive ? 'No drinks.' : 'No active drinks.'}
        </td></tr>
      {/if}
    </tbody>
  </table>
</div>

<!-- Create / Edit form -->
<div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
  <h2 class="text-lg font-semibold mb-4">{data.editing ? `Edit — ${data.editing.name}` : 'New drink'}</h2>
  <form method="POST" action="?/save" enctype="multipart/form-data" class="space-y-4">
    {#if data.editing}
      <input type="hidden" name="id" value={data.editing.id} />
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="name">Name *</label>
        <input
          id="name" name="name" type="text" required
          value={data.editing?.name ?? ''}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="category">Category</label>
        <input
          id="category" name="category" type="text"
          list="category-list"
          value={data.editing?.category ?? 'cocktail'}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
        <datalist id="category-list">
          {#each CATEGORIES as c}
            <option value={c}></option>
          {/each}
        </datalist>
      </div>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="description">Description</label>
      <input
        id="description" name="description" type="text"
        value={data.editing?.description ?? ''}
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="haTriggerEvent">HA trigger event</label>
        <input
          id="haTriggerEvent" name="haTriggerEvent" type="text"
          list="ha-event-list"
          value={data.editing?.haTriggerEvent ?? ''}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
        <datalist id="ha-event-list">
          {#each data.existingEvents as ev}
            <option value={ev}></option>
          {/each}
        </datalist>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="sortOrder">Sort order</label>
        <input
          id="sortOrder" name="sortOrder" type="number"
          value={data.editing?.sortOrder ?? 0}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="image">
        Image {data.editing?.imageUrl ? '(leave blank to keep current, max 10 MB)' : '(optional, max 10 MB)'}
      </label>
      {#if data.editing?.imageUrl}
        <img src={data.editing.imageUrl} alt="" class="w-16 h-16 rounded-lg object-cover mb-2" />
      {/if}
      <input
        id="image" name="image" type="file"
        accept="image/*"
        class="text-sm text-slate-300 file:mr-3 file:px-3 file:py-1.5 file:rounded-lg file:border-0 file:bg-slate-700 file:text-slate-200 file:text-sm file:cursor-pointer hover:file:bg-slate-600"
      />
    </div>

    <div class="flex items-center gap-2">
      <input
        id="active" name="active" type="checkbox"
        checked={data.editing ? data.editing.active : true}
        class="rounded"
      />
      <label for="active" class="text-sm text-slate-300">Active (shown on menu)</label>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
      >
        {data.editing ? 'Save changes' : 'Create drink'}
      </button>
      {#if data.editing}
        <a href="/admin/drinks" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">
          Cancel
        </a>
      {/if}
    </div>
  </form>
</div>
