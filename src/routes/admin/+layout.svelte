<script lang="ts">
  import { page } from '$app/stores';
  import type { LayoutData } from './$types';

  let { children, data }: { children: any; data: LayoutData } = $props();

  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/drinks', label: 'Drinks' },
    { href: '/admin/profiles', label: 'Profiles' },
    { href: '/admin/milestones', label: 'Milestones' },
    { href: '/admin/settings', label: 'Settings' },
    { href: '/admin/ha-log', label: 'HA Log' }
  ];

  function active(href: string) {
    if (href === '/admin') return $page.url.pathname === '/admin';
    return $page.url.pathname.startsWith(href);
  }
</script>

<div class="mx-auto max-w-4xl min-h-screen flex flex-col">
  <div class="bg-amber-950/50 border-b border-amber-800/60 px-4 py-2 text-xs text-amber-300">
    ⚠ Admin panel uses a separate PIN gate. Keep nginx auth, HTTPS, and env-backed secrets enabled before exposing it publicly.
  </div>

  {#if data.haWarning}
    <div class="bg-red-950/50 border-b border-red-800/60 px-4 py-2 text-xs text-red-300 flex items-center gap-2">
      <span>⚠ HA:</span>
      <span>{data.haWarning}</span>
      <a href="/admin/settings" class="underline ml-1 hover:text-red-200">Fix in Settings →</a>
    </div>
  {/if}

  <header class="flex items-center gap-4 px-4 py-3 border-b border-slate-800">
    <a href="/" class="text-lg font-semibold tracking-tight">🍹 drink-hub</a>
    <span class="text-slate-600 select-none">/</span>
    <span class="text-sm text-slate-300 font-medium">Admin</span>
  </header>

  <div class="flex flex-1">
    <nav class="w-40 shrink-0 border-r border-slate-800 py-4 flex flex-col gap-0.5 px-2">
      {#each links as link}
        <a
          href={link.href}
          class="px-3 py-2 rounded-lg text-sm transition {active(link.href)
            ? 'bg-slate-800 text-white'
            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}"
        >
          {link.label}
        </a>
      {/each}
    </nav>

    <main class="flex-1 p-6 min-w-0">
      {@render children()}
    </main>
  </div>
</div>
