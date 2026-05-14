<script lang="ts">
  import { page } from '$app/stores';

  type SiteKey = 'home' | 'drinks' | 'stats' | 'gooby' | 'gallery';

  interface Props {
    current?: SiteKey;
  }

  let { current }: Props = $props();
  let menuOpen = $state(false);
  let navRoot: HTMLElement;

  const links: Array<{ key: SiteKey; label: string; href: string }> = [
    { key: 'home', label: 'Home', href: '/' },
    { key: 'drinks', label: 'Drinks', href: '/drinks/' },
    { key: 'stats', label: 'Stats', href: '/stats/' },
    { key: 'gooby', label: 'GoobyGPT', href: '/gooby/' },
    { key: 'gallery', label: 'Gallery', href: '/gallery/' }
  ];

  function keyForPath(pathname: string): SiteKey {
    if (pathname === '/drinks' || pathname.startsWith('/drinks/')) return 'drinks';
    if (pathname === '/stats' || pathname.startsWith('/stats/')) return 'stats';
    if (pathname === '/gooby' || pathname.startsWith('/gooby/')) return 'gooby';
    if (pathname === '/gallery' || pathname.startsWith('/gallery/')) return 'gallery';
    return 'home';
  }

  const activeKey = $derived(current ?? keyForPath($page.url.pathname));
  const menuId = $derived(`site-nav-menu-${current ?? activeKey}`);

  function closeMenu() {
    menuOpen = false;
  }

  function handleWindowClick(event: MouseEvent) {
    if (!menuOpen || !navRoot || event.target instanceof Node && navRoot.contains(event.target)) return;
    closeMenu();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') closeMenu();
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleWindowKeydown} />

<nav class="site-nav" aria-label="21 Bristoe sites" bind:this={navRoot}>
  <button
    id="site-nav-menu-button"
    class="site-nav__toggle"
    type="button"
    aria-label="Open site navigation"
    aria-expanded={menuOpen}
    aria-controls={menuId}
    onclick={() => (menuOpen = !menuOpen)}
  >
    <span aria-hidden="true"></span>
    <span aria-hidden="true"></span>
    <span aria-hidden="true"></span>
  </button>

  <ul id={menuId} class:site-nav__list--open={menuOpen} class="site-nav__list" role="list">
    {#each links as link (link.key)}
      {@const active = activeKey === link.key}
      <li>
        <a
          href={link.href}
          class:site-nav__pill--active={active}
          class="site-nav__pill"
          aria-current={active ? 'page' : undefined}
          onclick={closeMenu}
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
    position: relative;
  }

  .site-nav__toggle {
    display: none;
    width: 2.55rem;
    height: 2.55rem;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.28rem;
    border: 1px solid rgba(241, 244, 247, 0.22);
    border-radius: var(--radius-sm, 0.5rem);
    background: rgba(15, 23, 42, 0.62);
    color: #fff;
    cursor: pointer;
  }

  .site-nav__toggle span {
    display: block;
    width: 1.1rem;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .site-nav__toggle:hover {
    border-color: rgba(241, 244, 247, 0.38);
    background: rgba(241, 244, 247, 0.08);
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
    border: 1px solid rgba(241, 244, 247, 0.22);
    border-radius: var(--radius-sm, 0.5rem);
    background: transparent;
    color: rgba(241, 244, 247, 0.78);
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
    border-color: rgba(241, 244, 247, 0.38);
    background: rgba(241, 244, 247, 0.08);
    color: #fff;
  }

  .site-nav__pill--active,
  .site-nav__pill--active:hover {
    border-color: var(--color-blood-500);
    background: var(--color-blood-500);
    color: #fff;
  }

  @media (max-width: 760px) {
    .site-nav {
      flex: 0 0 auto;
    }

    .site-nav__toggle {
      display: inline-flex;
    }

    .site-nav__list {
      position: absolute;
      top: calc(100% + 0.5rem);
      right: 0;
      z-index: 120;
      display: grid;
      width: max-content;
      max-width: calc(100vw - 2rem);
      gap: 0.25rem;
      padding: 0.5rem;
      border: 1px solid rgba(241, 244, 247, 0.16);
      border-radius: var(--radius-sm, 0.5rem);
      background: rgba(15, 23, 42, 0.98);
      box-shadow: 0 1.5rem 3rem -2rem rgba(0, 0, 0, 0.8);
      opacity: 0;
      pointer-events: none;
      transform: translateY(-0.25rem);
      transition: opacity 140ms ease, transform 140ms ease;
    }

    .site-nav__list--open {
      opacity: 1;
      pointer-events: auto;
      transform: translateY(0);
    }

    .site-nav__pill {
      min-height: 2.6rem;
      justify-content: flex-start;
      padding: 0.65rem 0.85rem;
      font-size: 0.72rem;
      letter-spacing: 0.08em;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-nav__pill,
    .site-nav__list {
      transition: none;
    }
  }
</style>
