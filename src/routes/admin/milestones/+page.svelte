<script lang="ts">
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();

  const SCOPES = [
    { value: 'all_time', label: 'All time' },
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'per_drink', label: 'Per drink' },
    { value: 'per_profile', label: 'Per profile' }
  ];

  let selectedScope = $state(data.editing?.scope ?? 'all_time');
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-semibold">Milestones</h1>
  <a href="/admin/milestones" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 transition">+ New milestone</a>
</div>

<p class="text-sm text-slate-400 mb-6">
  Milestones fire HA events when an order count crosses a threshold. The evaluator runs in Phase 4 — configure them here in advance.
</p>

{#if form?.error}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.error}</div>
{/if}

{#if form?.tested}
  <div class="mb-4 px-4 py-3 rounded-lg bg-slate-800 border border-slate-700 text-sm text-slate-300">
    <span class="text-slate-400">TTS fired:</span> "{form.ttsMessage}"
  </div>
{/if}

<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden mb-8">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-800 text-slate-400 text-left">
        <th class="px-4 py-3 font-medium">Name</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">Threshold</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">Scope</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">HA event</th>
        <th class="px-4 py-3 font-medium text-center">Enabled</th>
        <th class="px-4 py-3 font-medium text-right">Actions</th>
      </tr>
    </thead>
    <tbody>
      {#each data.milestones as m (m.id)}
        <tr class="border-b border-slate-800/50 last:border-0 {data.editing?.id === m.id ? 'bg-slate-800/40' : 'hover:bg-slate-800/20'}">
          <td class="px-4 py-3 font-medium">{m.name}</td>
          <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">{m.threshold}</td>
          <td class="px-4 py-3 text-slate-400 hidden sm:table-cell">{m.scope}</td>
          <td class="px-4 py-3 text-slate-500 text-xs hidden sm:table-cell">{m.haTriggerEvent}</td>
          <td class="px-4 py-3 text-center">{m.enabled ? '✓' : '–'}</td>
          <td class="px-4 py-3 text-right space-x-3">
            <form method="POST" action="?/testTts" class="inline">
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" class="text-sky-500 hover:text-sky-400 text-xs">Test TTS</button>
            </form>
            <a href="/admin/milestones?edit={m.id}" class="text-slate-400 hover:text-white text-xs">Edit</a>
            <form method="POST" action="?/delete" class="inline" onsubmit={(e) => { if (!confirm(`Delete ${m.name}?`)) e.preventDefault(); }}>
              <input type="hidden" name="id" value={m.id} />
              <button type="submit" class="text-red-500 hover:text-red-400 text-xs">Delete</button>
            </form>
          </td>
        </tr>
      {/each}
      {#if data.milestones.length === 0}
        <tr><td colspan="6" class="px-4 py-8 text-center text-slate-500">No milestones yet.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

<div class="bg-slate-900 border border-slate-800 rounded-xl p-6">
  <h2 class="text-lg font-semibold mb-4">{data.editing ? `Edit — ${data.editing.name}` : 'New milestone'}</h2>
  <form method="POST" action="?/save" class="space-y-4">
    {#if data.editing}
      <input type="hidden" name="id" value={data.editing.id} />
    {/if}

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="ms-name">Name *</label>
        <input
          id="ms-name" name="name" type="text" required
          value={data.editing?.name ?? ''}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="threshold">Threshold *</label>
        <input
          id="threshold" name="threshold" type="number" min="1" required
          value={data.editing?.threshold ?? 10}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="scope">Scope</label>
        <select
          id="scope" name="scope"
          bind:value={selectedScope}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        >
          {#each SCOPES as s}
            <option value={s.value} selected={data.editing?.scope === s.value}>{s.label}</option>
          {/each}
        </select>
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="ms-haTriggerEvent">HA trigger event *</label>
        <input
          id="ms-haTriggerEvent" name="haTriggerEvent" type="text" required
          list="ms-ha-event-list"
          value={data.editing?.haTriggerEvent ?? ''}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
        <datalist id="ms-ha-event-list">
          {#each data.existingEvents as ev}
            <option value={ev}></option>
          {/each}
        </datalist>
      </div>
    </div>

    {#if selectedScope === 'per_drink'}
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="drinkId">Drink</label>
        <select
          id="drinkId" name="drinkId"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        >
          <option value="">— Any drink —</option>
          {#each data.allDrinks as d}
            <option value={d.id} selected={data.editing?.drinkId === d.id}>{d.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    {#if selectedScope === 'per_profile'}
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="profileId">Profile</label>
        <select
          id="profileId" name="profileId"
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        >
          <option value="">— Any profile —</option>
          {#each data.allProfiles as p}
            <option value={p.id} selected={data.editing?.profileId === p.id}>{p.name}</option>
          {/each}
        </select>
      </div>
    {/if}

    <div class="flex items-center gap-2">
      <input
        id="ms-enabled" name="enabled" type="checkbox"
        checked={data.editing ? data.editing.enabled : true}
        class="rounded"
      />
      <label for="ms-enabled" class="text-sm text-slate-300">Enabled</label>
    </div>

    <div class="flex gap-3 pt-2">
      <button
        type="submit"
        class="px-4 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
      >
        {data.editing ? 'Save changes' : 'Create milestone'}
      </button>
      {#if data.editing}
        <a href="/admin/milestones" class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition">
          Cancel
        </a>
      {/if}
    </div>
  </form>
</div>
