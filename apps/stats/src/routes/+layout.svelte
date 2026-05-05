<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import HubNav from '$lib/components/HubNav.svelte';
  import StatsEnhancer from '$lib/components/StatsEnhancer.svelte';
  import StatsTabShell from '$lib/components/StatsTabShell.svelte';
  import { appPath, routePath } from '$lib/app-paths';
  import { statsSections } from '$lib/stats-sections';

  let { children, data } = $props();

  const now = new Date();
  const buildYear = now.getFullYear();
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
      <a class="app-header__brand" href="https://21bristoe.com">
        21 Bristoe <em>Stats</em>
      </a>
      <HubNav current="stats" />
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

<footer class="app-footer">
  <div class="app-footer__inner">
    <div class="app-footer__mark" aria-hidden="true">
      <span class="app-footer__mark-word">21 Bristoe</span>
      <span class="app-footer__mark-line"></span>
      <span class="app-footer__mark-sub">Stats</span>
    </div>
    <div class="app-footer__foot">
      <p>&copy; {buildYear} &middot; 21 Bristoe Station Rd, Taneytown, Md.</p>
      <div class="app-footer__links">
        <a href="https://21bristoe.com">21bristoe.com</a>
        <a href="https://21bristoe.com/drinks/">Drink Hub</a>
        <a href="https://github.com/faberalarcon/home" target="_blank" rel="noopener noreferrer">GitHub</a>
      </div>
    </div>
    {#if data.visitorCount !== null}
      <div class="app-footer__visitors">
        <span class="app-footer__count">{(data.visitorCount as number).toLocaleString()}</span>
        <span>unique visitors so far</span>
      </div>
    {/if}
  </div>
</footer>

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

  .app-footer {
    margin-top: 4rem;
    background: var(--color-ink-900);
    color: var(--color-paper-100);
    padding: 3rem 1.5rem 2rem;
  }
  .app-footer__inner { max-width: var(--measure-full); margin: 0 auto; }
  .app-footer__mark {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .app-footer__mark-word {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--color-paper-50);
    font-variation-settings: 'opsz' 36, 'SOFT' 30;
  }
  .app-footer__mark-line {
    flex: 1;
    height: 1px;
    background: rgba(245, 239, 223, 0.15);
  }
  .app-footer__mark-sub {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-paper-100);
    opacity: 0.6;
  }
  .app-footer__foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--color-paper-100);
    opacity: 0.7;
  }
  .app-footer__links {
    display: flex;
    gap: 1.5rem;
  }
  .app-footer__links a {
    color: var(--color-blood-300);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: border-color 0.2s;
  }
  .app-footer__links a:hover { border-bottom-color: var(--color-blood-300); }
  /* Footer is always dark — pin bg + text so dark-mode token inversion doesn't flip it white */
  @media (prefers-color-scheme: dark) {
    .app-footer { background: #05080c; }
    .app-footer__mark-word { color: #f0f4f8; }
    .app-footer__mark-sub { color: #c9d2dc; }
    .app-footer__foot { color: #c9d2dc; }
    .app-footer__links a { color: #8bb8e0; }
    .app-footer__visitors { color: #c9d2dc; }
    .app-footer__count { color: #f0f4f8; }
  }
  .app-footer__visitors {
    margin-top: 1.25rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(245, 239, 223, 0.1);
    text-align: center;
    font-family: var(--font-body);
    font-size: 0.75rem;
    color: var(--color-paper-100);
    opacity: 0.6;
  }
  .app-footer__count {
    font-family: var(--font-mono);
    font-weight: 600;
    color: var(--color-paper-50);
    opacity: 1;
    margin-right: 0.25em;
  }
</style>
