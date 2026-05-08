<script lang="ts">
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>House login</title>
</svelte:head>

<div class="min-h-screen flex flex-col bg-slate-950">
  <header class="site-login-header">
    <nav class="mx-auto flex max-w-5xl items-center justify-between gap-3" aria-label="Main navigation">
      <SiteBrand site="drinks" href="/drinks/" />
      <SiteNav current="drinks" />
    </nav>
  </header>

  <main id="main-content" class="flex flex-1 items-center justify-center px-4 py-12">
    <div class="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900/80 p-6 shadow-2xl shadow-black/30">
      <h1 class="text-2xl font-semibold text-center mb-1 text-slate-50">House Access</h1>
      <p class="text-slate-400 text-sm text-center mb-6">
        Enter the shared password to use drink-hub.
      </p>

      {#if form?.error}
        <div class="mb-4 rounded-lg border border-red-800 bg-red-950/60 px-4 py-3 text-center text-sm text-red-300">
          {form.error}
        </div>
      {/if}

      <form method="POST" action="?/login" class="space-y-4">
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
  </main>

  <SiteFooter visitorCount={data.visitorCount} />
</div>

<style>
  .site-login-header {
    width: 100%;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid rgba(241, 244, 247, 0.12);
    background:
      linear-gradient(
        180deg,
        rgba(15, 23, 42, 0.94),
        rgba(15, 23, 42, 0.9)
      );
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow: 0 1px 0 rgba(111, 168, 220, 0.28);
  }
</style>
