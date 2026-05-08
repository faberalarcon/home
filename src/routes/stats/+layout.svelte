<script lang="ts">
  import { page } from '$app/stores';
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import StatsEnhancer from '$lib/stats/components/StatsEnhancer.svelte';
  import StatsTabShell from '$lib/stats/components/StatsTabShell.svelte';
  import { appPath, routePath } from '$lib/stats/app-paths';
  import { statsSections } from '$lib/stats/stats-sections';

  let { children, data } = $props();

  const currentPath = $derived(routePath($page.url.pathname));

  function measureHeader(node: HTMLElement) {
    const update = () => {
      document.documentElement.style.setProperty('--stats-app-header-height', `${node.offsetHeight}px`);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;

    update();
    observer?.observe(node);
    window.addEventListener('resize', update);

    return {
      destroy() {
        observer?.disconnect();
        window.removeEventListener('resize', update);
        document.documentElement.style.removeProperty('--stats-app-header-height');
      }
    };
  }
</script>

<a href="#main-content" class="skip-to-content">Skip to content</a>

<header class="app-header" use:measureHeader>
  <div class="app-header__inner">
    <div class="app-header__top">
      <SiteBrand site="stats" href={appPath('/')} />
      <SiteNav current="stats" />
    </div>
    <nav class="app-header__nav" aria-label="Stats sections">
      {#each statsSections as link}
        <a
          href={appPath(link.href)}
          aria-current={currentPath === link.href ? 'page' : undefined}
        >
          {link.label}
        </a>
      {/each}
    </nav>
  </div>
</header>

<StatsEnhancer />

<main id="main-content" class="app-main">
  <StatsTabShell>
    {@render children()}
  </StatsTabShell>
</main>

<SiteFooter visitorCount={data.visitorCount} />

<style>
  .app-main {
    max-width: var(--measure-full);
    margin: 0 auto;
    padding: calc(var(--stats-app-header-height, 5.75rem) + 1.5rem) clamp(0.875rem, 2vw, 1.5rem) 3rem;
    width: 100%;
    min-width: 0;
  }
  @media (max-width: 640px) {
    .app-main { padding: calc(var(--stats-app-header-height, 6rem) + 1rem) 0.875rem 2.5rem; }
  }

</style>
