<script lang="ts">
  import '../app.css';
  import { selectedProfile } from '$lib/profile';
  import { page } from '$app/stores';
  import { pageTitle } from '$lib/stores/title';

  let { children, data } = $props();
</script>

<svelte:head>
  <title>{$pageTitle}</title>
</svelte:head>

{#if $page.url.pathname === '/login'}
  {@render children()}
{:else}
  <div class="mx-auto max-w-2xl min-h-screen flex flex-col">
    <header class="flex items-center justify-between px-4 py-3 border-b border-slate-800">
      <a href="/menu" class="text-lg font-semibold tracking-tight">🍹 drink-hub</a>
      <nav class="flex gap-3 text-sm text-slate-300 items-center">
        <a href="/menu" class:text-white={$page.url.pathname === '/menu'}>Menu</a>
        <a href="/recent" class:text-white={$page.url.pathname === '/recent'}>Recent</a>
        <a href="/stats" class:text-white={$page.url.pathname === '/stats'}>Stats</a>
        <a href="/admin" class:text-white={$page.url.pathname.startsWith('/admin')} class="text-slate-500 hover:text-slate-300">Admin</a>
        {#if $selectedProfile}
          <button
            class="px-2 py-0.5 rounded-full text-xs font-medium"
            style="background-color: {$selectedProfile.color}; color: #0f172a"
            onclick={() => selectedProfile.set(null)}
            title="Switch profile"
          >
            {$selectedProfile.name}
          </button>
        {:else}
          <a href="/">Pick profile</a>
        {/if}
        {#if data.sitePasswordEnabled && data.siteAuthenticated}
          <form method="POST" action="/login?/logout">
            <button type="submit" class="text-slate-500 hover:text-slate-300 text-xs">Sign out</button>
          </form>
        {/if}
      </nav>
    </header>
    <main class="flex-1 p-4">
      {@render children()}
    </main>
    <footer class="text-center text-xs text-slate-600 py-4 border-t border-slate-800">
      Created by <span class="text-slate-500">faberalarcon</span> &mdash;
      <a href="https://github.com/faberalarcon/drink-hub" target="_blank" rel="noopener noreferrer" class="text-slate-500 hover:text-slate-300">GitHub</a>
    </footer>
  </div>
{/if}
