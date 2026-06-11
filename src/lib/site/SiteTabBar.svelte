<script lang="ts">
  import { page } from '$app/stores';
  import { keyForPath, siteLinks, type SiteKey } from '$lib/site/site-links';

  const activeKey = $derived(keyForPath($page.url.pathname));

  const icons: Record<SiteKey, string> = {
    home: 'M3 11.5 12 4l9 7.5M5.5 10v9.5h13V10M10 19.5v-5h4v5',
    drinks: 'M5 4h14l-7 8.5L5 4Zm7 8.5V20m-4 0h8M8.2 7.5h7.6',
    stats: 'M4 20h16M6.5 20v-7m5.5 7V9.5m5.5 10.5v-4.5',
    gooby: 'M4.5 5.5h15v10h-8.5L7 19v-3.5H4.5v-10Z',
    gallery: 'M4.5 5h15v14h-15V5Zm2.5 10.5 3.5-4 2.5 3 2-2.5 2.5 3.5M9 9.2h.01'
  };

  function measureBar(node: HTMLElement) {
    const update = () => {
      document.documentElement.style.setProperty('--site-tab-bar-height', `${node.offsetHeight}px`);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;

    update();
    observer?.observe(node);
    window.addEventListener('resize', update);

    return {
      destroy() {
        observer?.disconnect();
        window.removeEventListener('resize', update);
        document.documentElement.style.removeProperty('--site-tab-bar-height');
      }
    };
  }
</script>

<div class="site-tab-bar-spacer" aria-hidden="true"></div>

<nav class="site-tab-bar" aria-label="21 Bristoe sites" use:measureBar>
  {#each siteLinks as link (link.key)}
    {@const active = activeKey === link.key}
    <a
      href={link.href}
      class="site-tab-bar__item"
      class:site-tab-bar__item--active={active}
      aria-current={active ? 'page' : undefined}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <path d={icons[link.key]} />
      </svg>
      <span>{link.label}</span>
    </a>
  {/each}
</nav>

<style>
  .site-tab-bar,
  .site-tab-bar-spacer {
    display: none;
  }

  @media (max-width: 760px) {
    .site-tab-bar-spacer {
      display: block;
      height: var(--site-tab-bar-height, 3.6rem);
    }

    .site-tab-bar {
      position: fixed;
      inset: auto 0 0 0;
      z-index: 70;
      display: grid;
      grid-template-columns: repeat(5, 1fr);
      padding: 0.3rem 0.25rem calc(0.3rem + env(safe-area-inset-bottom));
      border-top: 1px solid rgba(111, 168, 220, 0.28);
      background: rgba(15, 23, 42, 0.94);
      -webkit-backdrop-filter: blur(14px);
      backdrop-filter: blur(14px);
    }

    @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
      .site-tab-bar {
        background: #0f172a;
      }
    }

    .site-tab-bar__item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.18rem;
      min-height: 44px;
      border-radius: var(--radius-sm, 0.5rem);
      color: rgba(241, 244, 247, 0.68);
      font-family: var(--font-body);
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      text-decoration: none;
      transition: color 120ms ease, background 120ms ease;
    }

    .site-tab-bar__item svg {
      width: 1.35rem;
      height: 1.35rem;
    }

    .site-tab-bar__item--active {
      color: var(--color-blood-500);
    }

    .site-tab-bar__item:active {
      background: rgba(241, 244, 247, 0.08);
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-tab-bar__item {
      transition: none;
    }
  }
</style>
