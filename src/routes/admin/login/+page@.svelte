<script lang="ts">
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>Admin login</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 flex items-center justify-center px-4">
  <div class="w-full max-w-xs">
    <h1 class="text-2xl font-semibold text-center mb-1">Admin</h1>
    <p class="text-slate-400 text-sm text-center mb-6">Enter your admin password to continue.</p>

    {#if form?.error}
      <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300 text-center">
        {form.error}
      </div>
    {/if}

    {#if data.adminPasswordConfigured}
      <form method="POST" action="?/login" class="space-y-4">
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          placeholder="Admin password"
          class="w-full text-center bg-slate-900 border border-slate-700 rounded-xl px-4 py-3 focus:outline-none focus:border-slate-500"
        />
        <button
          type="submit"
          class="w-full py-3 rounded-xl bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
        >
          Unlock
        </button>
      </form>
    {:else}
      <div class="rounded-xl border border-amber-800 bg-amber-950/60 px-4 py-4 text-sm text-amber-200">
        Admin access is disabled until an admin password has been bootstrapped. Restart the server to generate a temporary password.
      </div>
    {/if}
  </div>
</div>
