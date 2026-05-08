<script lang="ts">
  import { page } from '$app/stores';

  type SiteKey = 'home' | 'drinks' | 'stats';

  interface Props {
    current?: SiteKey;
  }

  let { current }: Props = $props();

  const links: Array<{ key: SiteKey; label: string; href: string }> = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'drinks', label: 'Drinks', href: '/drinks/' },
    { key: 'stats', label: 'Stats', href: '/stats/' }
  ];

  function keyForPath(pathname: string): SiteKey {
    if (pathname === '/drinks' || pathname.startsWith('/drinks/')) return 'drinks';
    if (pathname === '/stats' || pathname.startsWith('/stats/')) return 'stats';
    return 'home';
  }

  const activeKey = $derived(current ?? keyForPath($page.url.pathname));
</script>

<nav class="site-nav" aria-label="21 Bristoe sites">
  <ul class="site-nav__list" role="list">
    {#each links as link (link.key)}
      {@const active = activeKey === link.key}
      <li>
        <a
          href={link.href}
          class:site-nav__pill--active={active}
          class="site-nav__pill"
          aria-current={active ? 'page' : undefined}
        >
          {link.label}
        </a>
      </li>
    {/each}
  </ul>
</nav>

<style>
  .site-nav {
    max-width: 100%;
    min-width: 0;
  }

  .site-nav__list {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: nowrap;
    gap: 0.4rem;
    list-style: none;
    margin: 0;
    padding: 0;
    max-width: 100%;
  }

  .site-nav__pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2rem;
    padding: 0.28rem 0.68rem;
    border: 1px solid color-mix(in oklab, var(--color-paper-300) 80%, transparent);
    border-radius: var(--radius-sm, 0.5rem);
    background: transparent;
    color: var(--color-ink-700);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
    text-decoration: none;
    transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
  }

  .site-nav__pill:hover {
    background: var(--color-paper-100);
    color: var(--color-ink-900);
  }

  .site-nav__pill--active,
  .site-nav__pill--active:hover {
    border-color: var(--color-blood-500);
    background: var(--color-blood-500);
    color: #fff;
  }

  @media (max-width: 520px) {
    .site-nav__list {
      gap: 0.18rem;
    }

    .site-nav__pill {
      min-height: 1.9rem;
      padding: 0.24rem 0.4rem;
      font-size: 0.64rem;
      letter-spacing: 0.04em;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-nav__pill {
      transition: none;
    }
  }
</style>
