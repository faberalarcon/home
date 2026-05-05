<script lang="ts">
  import { afterNavigate } from '$app/navigation';
  import { appPath, assetPath, thumbPath } from '$lib/app-paths';
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const CATEGORIES = ['cocktail', 'beer', 'wine', 'spirit', 'non-alcoholic', 'food', 'snack', 'dessert', 'other'];

  let search = $state('');
  const visibleDrinks = $derived(
    search.trim()
      ? data.drinks.filter((d) =>
          d.name.toLowerCase().includes(search.toLowerCase()) ||
          d.category.toLowerCase().includes(search.toLowerCase())
        )
      : data.drinks
  );

  // Scroll the edit form into view whenever we navigate to ?edit=<id>
  afterNavigate(() => {
    if (data.editing) {
      const el = document.getElementById('edit-form');
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
</script>

<div class="flex items-center justify-between mb-6">
  <div class="flex items-center gap-3">
    <h1 class="text-2xl font-semibold">Menu Items</h1>
    {#if data.inactiveCount > 0}
      <a
        href={`${appPath('/admin/drinks')}${data.showInactive ? '' : '?inactive=1'}`}
        class="text-xs px-2 py-1 rounded bg-slate-800 text-slate-400 hover:text-slate-200 transition"
      >
        {data.showInactive ? 'Hide inactive' : `+${data.inactiveCount} hidden`}
      </a>
    {/if}
  </div>
  <a href={appPath('/admin/drinks')} class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">+ New item</a>
</div>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

<input
  type="search"
  bind:value={search}
  placeholder="Filter items…"
  class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-slate-600"
/>

<!-- Drink list table (desktop) -->
<div class="hidden md:block bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-slate-800 text-slate-400 text-left">
          <th class="px-4 py-3 font-medium">Name</th>
          <th class="px-4 py-3 font-medium">Category</th>
          <th class="px-4 py-3 font-medium">HA event</th>
          <th class="px-4 py-3 font-medium text-center w-16">Active</th>
          <th class="px-4 py-3 font-medium text-right w-36">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each visibleDrinks as d (d.id)}
          <tr class="border-b border-slate-800/50 last:border-0 {data.editing?.id === d.id ? 'bg-slate-800/40' : !d.active ? 'opacity-50 hover:opacity-75' : 'hover:bg-slate-800/20'} transition">
            <td class="px-4 py-3">
              <div class="flex items-center gap-2">
                {#if d.imageUrl}
                  <img src={thumbPath(d.imageUrl)} alt="" class="w-8 h-8 rounded object-cover shrink-0" />
                {:else}
                  <div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-base shrink-0">🍽️</div>
                {/if}
                <span class="font-medium">{d.name}</span>
              </div>
            </td>
            <td class="px-4 py-3 text-slate-400">{d.category}</td>
            <td class="px-4 py-3 text-slate-500 text-xs">{d.haTriggerEvent ?? '—'}</td>
            <td class="px-4 py-3 text-center">{d.active ? '✓' : '–'}</td>
            <td class="px-4 py-3 text-right">
              <div class="flex items-center justify-end gap-3">
                <a
                  href={`${appPath('/admin/drinks')}?edit=${d.id}${data.showInactive ? '&inactive=1' : ''}`}
                  class="text-slate-400 hover:text-white text-xs"
                >Edit</a>
                <form method="POST" action="?/toggleActive" class="contents">
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" class="text-xs {d.active ? 'text-slate-500 hover:text-amber-400' : 'text-emerald-600 hover:text-emerald-400'}">
                    {d.active ? 'Hide' : 'Show'}
                  </button>
                </form>
                <form method="POST" action="?/delete" class="contents" onsubmit={(e) => { if (!confirm(`Delete ${d.name}? This cannot be undone.`)) e.preventDefault(); }}>
                  <input type="hidden" name="id" value={d.id} />
                  <button type="submit" class="text-red-500 hover:text-red-400 text-xs">Delete</button>
                </form>
              </div>
            </td>
          </tr>
        {/each}
        {#if data.drinks.length === 0}
          <tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">
            {data.showInactive ? 'No items.' : 'No active items.'}
          </td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>

<!-- Mobile card list -->
<div class="md:hidden flex flex-col gap-3 mb-8">
  {#each visibleDrinks as d (d.id)}
    <div class="bg-slate-900 border rounded-xl p-4 {data.editing?.id === d.id ? 'border-orange-700/60 bg-slate-800/40' : !d.active ? 'opacity-60 border-slate-800' : 'border-slate-800'}">
      <div class="flex items-start gap-3 mb-3">
        {#if d.imageUrl}
          <img src={thumbPath(d.imageUrl)} alt="" class="w-12 h-12 rounded object-cover shrink-0" />
        {:else}
          <div class="w-12 h-12 rounded bg-slate-800 flex items-center justify-center text-xl shrink-0">🍽️</div>
        {/if}
        <div class="min-w-0 flex-1">
          <div class="font-medium truncate">{d.name}</div>
          <div class="text-xs text-slate-400">{d.category}{d.active ? '' : ' · hidden'}</div>
        </div>
      </div>
      {#if d.haTriggerEvent}
        <div class="text-xs text-slate-500 font-mono mb-3 break-all">{d.haTriggerEvent}</div>
      {/if}
      <div class="flex flex-wrap gap-2">
        <a
          href={`${appPath('/admin/drinks')}?edit=${d.id}${data.showInactive ? '&inactive=1' : ''}`}
          class="text-sm px-3 py-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700"
        >Edit</a>
        <form method="POST" action="?/toggleActive" class="contents">
          <input type="hidden" name="id" value={d.id} />
          <button type="submit" class="text-sm px-3 py-2 rounded-lg bg-slate-800 {d.active ? 'text-amber-400' : 'text-emerald-400'} hover:bg-slate-700">
            {d.active ? 'Hide' : 'Show'}
          </button>
        </form>
        <form method="POST" action="?/delete" class="contents" onsubmit={(e) => { if (!confirm(`Delete ${d.name}? This cannot be undone.`)) e.preventDefault(); }}>
          <input type="hidden" name="id" value={d.id} />
          <button type="submit" class="text-sm px-3 py-2 rounded-lg bg-red-950/60 border border-red-800 text-red-300 hover:bg-red-900/60">Delete</button>
        </form>
      </div>
    </div>
  {/each}
  {#if data.drinks.length === 0}
    <div class="bg-slate-900 border border-slate-800 rounded-xl px-4 py-8 text-center text-slate-500">
      {data.showInactive ? 'No items.' : 'No active items.'}
    </div>
  {/if}
</div>

<!-- Create / Edit form -->
<div
  id="edit-form"
  class="bg-slate-900 border rounded-xl p-6 scroll-mt-4 transition-colors duration-300
    {data.editing ? 'border-orange-700/60' : 'border-slate-800'}"
>
  <h2 class="text-lg font-semibold mb-4">
    {data.editing ? `Editing — ${data.editing.name}` : 'New item'}
  </h2>

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

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="abv">ABV % <span class="text-slate-600">(alcohol by volume)</span></label>
        <input
          id="abv" name="abv" type="number" min="0" max="100" step="0.1"
          value={data.editing?.abv ?? ''}
          placeholder="e.g. 5.0"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="volume_ml">Serving size (mL)</label>
        <input
          id="volume_ml" name="volume_ml" type="number" min="0" step="1"
          value={data.editing?.volumeMl ?? ''}
          placeholder="e.g. 355 for a can"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
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

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="notes">Notes / recipe <span class="text-slate-600">(shown on menu when tapped)</span></label>
      <textarea
        id="notes" name="notes" rows="3"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500 resize-y"
      >{data.editing?.notes ?? ''}</textarea>
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
        <img src={assetPath(data.editing.imageUrl)} alt="" class="w-16 h-16 rounded-lg object-cover mb-2" />
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
        {data.editing ? 'Save changes' : 'Create item'}
      </button>
      {#if data.editing}
        <a href={appPath('/admin/drinks')} class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">
          Cancel
        </a>
      {/if}
    </div>
  </form>
</div>
