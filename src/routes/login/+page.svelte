<script lang="ts">
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>House login</title>
</svelte:head>

<div class="min-h-screen bg-slate-950 flex items-center justify-center px-4">
  <div class="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
    <h1 class="text-2xl font-semibold text-center mb-1">House Access</h1>
    <p class="text-slate-400 text-sm text-center mb-6">
      Enter the shared password to use drink-hub.
    </p>

    {#if form?.error}
      <div class="mb-4 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-center text-sm text-red-300">
        {form.error}
      </div>
    {/if}

    <form method="POST" class="space-y-4">
      <input type="hidden" name="next" value={form?.next ?? data.next} />
      <label class="block space-y-2">
        <span class="text-sm text-slate-300">Shared password</span>
        <input
          type="password"
          name="password"
          autocomplete="current-password"
          class="w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 focus:outline-none focus:border-slate-500"
        />
      </label>
      <button
        type="submit"
        class="w-full rounded-xl bg-orange-500 py-3 text-sm font-semibold text-slate-950 transition hover:bg-orange-400"
      >
        Continue
      </button>
    </form>
  </div>
</div>
