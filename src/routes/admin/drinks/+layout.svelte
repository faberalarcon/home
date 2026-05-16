<script lang="ts">
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { appPath, adminPath, adminRoutePath } from '$lib/drinks/app-paths';
  import type { LayoutData } from './$types';

  let { children, data }: { children: any; data: LayoutData } = $props();

  const links = [
    { href: '/', label: 'Dashboard' },
    { href: '/drinks', label: 'Items' },
    { href: '/profiles', label: 'Profiles' },
    { href: '/orders', label: 'Orders' },
    { href: '/milestones', label: 'Milestones' },
    { href: '/settings', label: 'Settings' },
    { href: '/ha-log', label: 'HA Log' }
  ];

  function active(href: string) {
    const pathname = adminRoutePath($page.url.pathname);
    if (href === '/') return pathname === '/';
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  let drawerOpen = $state(false);

  afterNavigate(() => {
    drawerOpen = false;
  });

  function onKey(e: KeyboardEvent) {
    if (e.key === 'Escape') drawerOpen = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<svelte:head>
  <title>21 Bristoe — Drinks Admin</title>
  <style>
    html, body {
      background: #0f1419;
      color: #c9d2dc;
      color-scheme: dark;
    }
  </style>
</svelte:head>

<div class="admin-shell mx-auto max-w-4xl min-h-screen flex flex-col">
  {#if data.haWarning}
    <div class="bg-red-950/50 border-b border-red-800/60 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
      <span>⚠ HA:</span>
      <span>{data.haWarning}</span>
      <a href={adminPath('/settings')} class="underline ml-1 hover:text-red-200">Fix in Settings →</a>
    </div>
  {/if}

  <header class="flex items-center gap-3 px-4 py-3 border-b border-slate-800">
    <button
      type="button"
      class="md:hidden p-2 -ml-2 rounded-lg text-slate-300 hover:bg-slate-800 hover:text-white transition"
      aria-label="Toggle navigation"
      aria-expanded={drawerOpen}
      onclick={() => (drawerOpen = !drawerOpen)}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="3" y1="6" x2="21" y2="6" />
        <line x1="3" y1="12" x2="21" y2="12" />
        <line x1="3" y1="18" x2="21" y2="18" />
      </svg>
    </button>
    <a href={appPath('/')} class="text-lg font-semibold tracking-tight">🍹 21 Bristoe drinks</a>
    <span class="text-slate-600 select-none">/</span>
    <span class="text-sm text-slate-300 font-medium">Admin</span>
  </header>

  <div class="flex flex-1 relative">
    <!-- Desktop sidebar -->
    <nav class="hidden md:flex w-40 shrink-0 border-r border-slate-800 py-4 flex-col gap-0.5 px-2">
      {#each links as link}
        <a
          href={adminPath(link.href)}
          class="px-3 py-2 rounded-lg text-sm transition {active(link.href)
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}"
        >
          {link.label}
        </a>
      {/each}
    </nav>

    <!-- Mobile drawer + backdrop -->
    {#if drawerOpen}
      <button
        type="button"
        class="md:hidden fixed inset-0 bg-black/50 z-40"
        aria-label="Close navigation"
        onclick={() => (drawerOpen = false)}
      ></button>
    {/if}
    <nav
      class="md:hidden fixed top-0 bottom-0 left-0 w-64 bg-slate-900 border-r border-slate-800 z-50 py-4 px-2 flex flex-col gap-0.5 transition-transform duration-200 {drawerOpen ? 'translate-x-0' : '-translate-x-full'}"
      aria-hidden={!drawerOpen}
    >
      <div class="px-3 pb-3 mb-2 border-b border-slate-800 flex items-center justify-between">
        <span class="text-sm font-semibold text-slate-200">Menu</span>
        <button
          type="button"
          class="p-1 rounded text-slate-400 hover:text-white"
          aria-label="Close navigation"
          onclick={() => (drawerOpen = false)}
        >✕</button>
      </div>
      {#each links as link}
        <a
          href={adminPath(link.href)}
          class="px-3 py-3 rounded-lg text-base transition {active(link.href)
            ? 'bg-slate-800 text-white'
            : 'text-slate-300 hover:text-white hover:bg-slate-800/60'}"
        >
          {link.label}
        </a>
      {/each}
    </nav>

    <main class="flex-1 p-4 md:p-6 min-w-0">
      {@render children()}
    </main>
  </div>
</div>

<style>
  /* Force a self-contained dark theme on this admin section regardless of
     system prefers-color-scheme or the global drinks.css compat layer.
     Tailwind slate utilities in pages assume a dark surface; pin local
     paper/ink tokens so the compat overrides (which remap slate->paper)
     resolve to dark values inside this shell. */
  .admin-shell {
    --color-paper-50:  #0f1419;
    --color-paper-100: #161b22;
    --color-paper-200: #1f2630;
    --color-paper-300: #30384a;
    --color-ink-900:   #f0f4f8;
    --color-ink-700:   #c9d2dc;
    --color-ink-500:   #94a3b8;
    --color-ink-300:   #64748b;
    background: #0f1419;
    color: #c9d2dc;
    color-scheme: dark;
  }

  /* Prevent iOS Safari from zooming when focusing inputs on mobile. */
  @media (max-width: 767px) {
    .admin-shell :global(input:not([type='checkbox']):not([type='radio']):not([type='color'])),
    .admin-shell :global(select),
    .admin-shell :global(textarea) {
      font-size: 16px;
    }
  }
</style>
