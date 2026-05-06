<script lang="ts">
  export let current: 'home' | 'drinks' | 'stats' = 'home';

  const links = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'drinks', label: 'Drinks', href: '/drinks/' },
    { key: 'stats', label: 'Stats', href: '/stats/' }
  ] as const;
</script>

<div class="hidden sm:flex items-center gap-1" aria-label="Site areas">
  {#each links as link}
    <a
      href={link.href}
      class={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
        current === link.key
          ? 'bg-warm-500 text-white hover:bg-warm-600'
          : 'border border-warm-300 text-warm-700 hover:bg-warm-100 hover:text-warm-900'
      }`}
      aria-current={current === link.key ? 'page' : undefined}
    >
      {link.label}
    </a>
  {/each}
</div>
