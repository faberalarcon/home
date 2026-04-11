<script lang="ts">
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  let search = $state('');
  const visibleProfiles = $derived(
    search.trim()
      ? data.profiles.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()))
      : data.profiles
  );
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-semibold">Profiles</h1>
  <a href="/admin/profiles" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">+ New profile</a>
</div>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

<input
  type="search"
  bind:value={search}
  placeholder="Filter profiles…"
  class="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-sm mb-4 focus:outline-none focus:border-slate-600"
/>

<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-800 text-slate-400 text-left">
        <th class="px-4 py-3 font-medium">Name</th>
        <th class="px-4 py-3 font-medium">Color</th>
        <th class="px-4 py-3 font-medium text-center">Active</th>
        <th class="px-4 py-3 font-medium text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each visibleProfiles as p (p.id)}
        <tr class="border-b border-slate-800/50 last:border-0 {data.editing?.id === p.id ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'}">
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              {#if p.avatarUrl}
                <img src={p.avatarUrl.replace('.webp', '-thumb.webp')} alt="" class="w-8 h-8 rounded-full object-cover" />
              {:else}
                <div class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-slate-950" style="background-color:{p.color}">
                  {p.name[0]}
                </div>
              {/if}
              <span class="font-medium">{p.name}</span>
            </div>
          </td>
          <td class="px-4 py-3">
            <div class="flex items-center gap-2">
              <div class="w-4 h-4 rounded" style="background-color:{p.color}"></div>
              <span class="text-slate-400 text-xs">{p.color}</span>
            </div>
          </td>
          <td class="px-4 py-3 text-center">{p.active ? '✓' : '–'}</td>
          <td class="px-4 py-3 text-right">
            <a href="/admin/profiles?edit={p.id}" class="text-slate-400 hover:text-white text-xs mr-3">Edit</a>
            <form method="POST" action="?/delete" class="inline" onsubmit={(e) => { if (!confirm(`Delete ${p.name}?`)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={p.id} />
              <button type="submit" class="text-red-500 hover:text-red-400 text-xs">Delete</button>
            </form>
          </td>
        </tr>
      {/each}
      {#if visibleProfiles.length === 0}
        <tr><td colspan="4" class="px-4 py-8 text-center text-slate-500">No profiles yet.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
  <h2 class="text-lg font-semibold mb-4">{data.editing ? `Edit — ${data.editing.name}` : 'New profile'}</h2>
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
        <label class="block text-sm text-slate-400 mb-1" for="color">Color</label>
        <div class="flex gap-2">
          <input
            id="color" name="color" type="color"
            value={data.editing?.color ?? '#f97316'}
            class="h-9 w-14 rounded-lg border border-slate-700 bg-slate-800 cursor-pointer p-1"
          />
          <input
            type="text"
            value={data.editing?.color ?? '#f97316'}
            oninput={(e) => { const c = document.getElementById('color') as HTMLInputElement; c.value = (e.target as HTMLInputElement).value; }}
            class="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
          />
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="weight_kg">
          Weight (kg) <span class="text-slate-600">(for BAC estimation)</span>
        </label>
        <input
          id="weight_kg" name="weight_kg" type="number" min="1" max="500" step="0.1"
          value={data.editing?.weightKg ?? ''}
          placeholder="optional"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="biological_sex">
          Biological sex <span class="text-slate-600">(for BAC estimation)</span>
        </label>
        <select
          id="biological_sex" name="biological_sex"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        >
          <option value="">— not set —</option>
          <option value="male" selected={data.editing?.biologicalSex === 'male'}>Male</option>
          <option value="female" selected={data.editing?.biologicalSex === 'female'}>Female</option>
        </select>
      </div>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="avatar">
        Avatar {data.editing?.avatarUrl ? '(leave blank to keep current)' : '(optional)'}
      </label>
      {#if data.editing?.avatarUrl}
        <img src={data.editing.avatarUrl} alt="" class="w-16 h-16 rounded-full object-cover mb-2" />
      {/if}
      <input
        id="avatar" name="avatar" type="file"
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
      <label for="active" class="text-sm text-slate-300">Active (shown on profile picker)</label>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
      >
        {data.editing ? 'Save changes' : 'Create profile'}
      </button>
      {#if data.editing}
        <a href="/admin/profiles" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">
          Cancel
        </a>
      {/if}
    </div>
  </form>
</div>
