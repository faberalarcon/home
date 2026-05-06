<script lang="ts">
  import { appPath } from '$lib/drinks/app-paths';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  function fmt(d: Date | null) {
    if (!d) return '—';
    return d.toLocaleString();
  }
</script>

<div class="flex items-center justify-between mb-6">
  <h1 class="text-2xl font-semibold">HA Event Log</h1>
  <form method="POST" action="?/clear" onsubmit={(e) => { if (!confirm('Clear all log entries?')) e.preventDefault(); }}>
    <button type="submit" class="text-sm px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-red-900/60 hover:text-red-300 transition">
      Clear log
    </button>
  </form>
</div>

<div class="flex gap-2 mb-4">
  {#each [['', 'All'], ['success', 'Success'], ['failure', 'Failure']] as [val, label]}
    <a
      href={`${appPath('/admin/ha-log')}${val ? `?filter=${val}` : ''}`}
      class="text-xs px-3 py-1.5 rounded-full border transition {(data.filter ?? '') === val
        ? 'bg-slate-700 border-slate-600 text-white'
        : 'border-slate-700 text-slate-400 hover:text-slate-200'}"
    >
      {label}
    </a>
  {/each}
</div>

<div class="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
  <table class="w-full text-sm">
    <thead>
      <tr class="border-b border-slate-800 text-slate-400 text-left">
        <th class="px-4 py-3 font-medium">Status</th>
        <th class="px-4 py-3 font-medium">Event type</th>
        <th class="px-4 py-3 font-medium hidden md:table-cell">Payload</th>
        <th class="px-4 py-3 font-medium hidden sm:table-cell">Error</th>
        <th class="px-4 py-3 font-medium text-right">Time</th>
      </tr>
    </thead>
    <tbody>
      {#each data.rows as row (row.id)}
        <tr class="border-b border-slate-800/50 last:border-0 hover:bg-slate-800/20">
          <td class="px-4 py-3">
            {#if row.success}
              <span class="text-emerald-400 text-xs font-medium">✓ ok</span>
            {:else}
              <span class="text-red-400 text-xs font-medium">✗ fail</span>
            {/if}
          </td>
          <td class="px-4 py-3 font-mono text-xs text-slate-300">{row.eventType}</td>
          <td class="px-4 py-3 text-xs text-slate-500 font-mono hidden md:table-cell max-w-xs truncate">{row.payload}</td>
          <td class="px-4 py-3 text-xs text-red-400 hidden sm:table-cell">{row.error ?? ''}</td>
          <td class="px-4 py-3 text-xs text-slate-500 text-right whitespace-nowrap">{fmt(row.createdAt)}</td>
        </tr>
      {/each}
      {#if data.rows.length === 0}
        <tr><td colspan="5" class="px-4 py-8 text-center text-slate-500">No log entries.</td></tr>
      {/if}
    </tbody>
  </table>
</div>

{#if data.rows.length === 50}
  <p class="text-xs text-slate-500 mt-2 text-center">Showing last 50 entries.</p>
{/if}
