<script lang="ts">
  import DrinkSwipeEnhancer from '$lib/drinks/components/DrinkSwipeEnhancer.svelte';
  import DrinkTabShell from '$lib/drinks/components/DrinkTabShell.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import { selectedProfile } from '$lib/drinks/profile';
  import { page } from '$app/stores';
  import { pageTitle } from '$lib/drinks/stores/title';
  import { appAction, appPath, routePath } from '$lib/drinks/app-paths';

  let { children, data } = $props();
  const currentPath = $derived(routePath($page.url.pathname));

  function measureMasthead(node: HTMLElement) {
    const update = () => {
      document.documentElement.style.setProperty('--drink-shell-masthead-height', `${node.offsetHeight}px`);
    };
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;

    update();
    observer?.observe(node);
    window.addEventListener('resize', update);

    return {
      destroy() {
        observer?.disconnect();
        window.removeEventListener('resize', update);
        document.documentElement.style.removeProperty('--drink-shell-masthead-height');
      }
    };
  }
</script>

<svelte:head>
  <title>{$pageTitle}</title>
</svelte:head>

{#if currentPath === '/login'}
  {@render children()}
{:else}
  <DrinkSwipeEnhancer />
  <div class="drink-shell">
    <header class="drink-shell__masthead" use:measureMasthead>
      <div class="drink-shell__top">
        <a href={appPath('/menu')} class="drink-shell__brand">
          <span aria-hidden="true">21&middot;</span>Bristoe <em>Drinks</em>
        </a>
        <SiteNav current="drinks" />
      </div>
      <nav class="drink-shell__nav" aria-label="Drink Hub">
        <a href={appPath('/menu')} aria-current={currentPath === '/menu' ? 'page' : undefined}>Menu</a>
        <a href={appPath('/recent')} aria-current={currentPath === '/recent' ? 'page' : undefined}>Recent</a>
        <a href={appPath('/stats')} aria-current={currentPath === '/stats' ? 'page' : undefined}>Leaderboard</a>
        <a href={appPath('/admin')} aria-current={currentPath.startsWith('/admin') ? 'page' : undefined}>Admin</a>
        {#if $selectedProfile}
          <button
            class="drink-shell__profile"
            style="--profile-color: {$selectedProfile.color}"
            onclick={() => selectedProfile.set(null)}
            title="Switch profile"
          >
            {$selectedProfile.name}
          </button>
        {:else}
          <a href={appPath('/')}>Pick profile</a>
        {/if}
        {#if data.sitePasswordEnabled && data.siteAuthenticated}
          <form method="POST" action={appAction('/login', 'logout')}>
            <button type="submit" class="drink-shell__signout">Sign out</button>
          </form>
        {/if}
      </nav>
    </header>
    <main class="drink-shell__main">
      <DrinkTabShell>
        {@render children()}
      </DrinkTabShell>
    </main>
    <SiteFooter visitorCount={data.visitorCount} />
  </div>
{/if}

<style>
  .drink-shell {
    min-height: 100svh;
    max-width: 50rem;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    background:
      linear-gradient(180deg, color-mix(in oklab, var(--color-paper-100) 50%, transparent), transparent 16rem),
      var(--color-paper-50);
  }
  .drink-shell__masthead {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    z-index: 80;
    width: 100%;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
    padding: 0.65rem max(1rem, calc((100vw - 50rem) / 2 + 1rem)) 0.5rem;
    border-bottom: 1px solid color-mix(in oklab, var(--color-paper-300) 80%, transparent);
    background:
      linear-gradient(
        180deg,
        color-mix(in oklab, var(--color-paper-50) 88%, transparent),
        color-mix(in oklab, var(--color-paper-50) 74%, transparent)
      );
    -webkit-backdrop-filter: blur(14px);
    backdrop-filter: blur(14px);
    box-shadow: 0 1px 0 color-mix(in oklab, var(--color-blood-500) 12%, transparent);
  }
  @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
    .drink-shell__masthead {
      background: color-mix(in oklab, var(--color-paper-50) 96%, transparent);
    }
  }
  .drink-shell__top {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }
  .drink-shell__brand {
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 2.2vw, 1.35rem);
    font-weight: 650;
    color: var(--color-ink-900);
    text-decoration: none;
    white-space: nowrap;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .drink-shell__brand em {
    color: var(--color-blood-500);
    font-style: italic;
    font-weight: 450;
  }
  .drink-shell__nav {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
    justify-content: flex-start;
  }
  .drink-shell__nav a,
  .drink-shell__signout {
    border: 0;
    background: transparent;
    color: var(--color-ink-500);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    text-decoration: none;
    cursor: pointer;
    border-radius: var(--radius-sm);
    padding: 0.22rem 0.35rem;
    box-shadow: inset 0 0 0 1px transparent;
    transition: color 0.18s ease, background 0.18s ease, box-shadow 0.18s ease;
  }
  .drink-shell__nav a:hover,
  .drink-shell__nav a[aria-current="page"],
  .drink-shell__signout:hover {
    color: var(--color-blood-500);
  }
  .drink-shell__nav a:hover,
  .drink-shell__nav a[aria-current="page"] {
    background: color-mix(in oklab, var(--color-paper-100) 78%, transparent);
    box-shadow: inset 0 -2px 0 color-mix(in oklab, var(--color-blood-500) 72%, transparent);
  }
  .drink-shell__profile {
    border: 1px solid color-mix(in oklab, var(--profile-color) 70%, var(--color-paper-300));
    background: color-mix(in oklab, var(--profile-color) 22%, var(--color-paper-50));
    color: var(--color-ink-900);
    border-radius: var(--radius-sm);
    padding: 0.25rem 0.45rem;
    font-size: 0.72rem;
    font-weight: 750;
  }
  .drink-shell__main {
    flex: 1;
    padding: calc(var(--drink-shell-masthead-height, 5.5rem) + 1.25rem) 1rem 2.5rem;
  }
  @media (max-width: 520px) {
    .drink-shell__top {
      gap: 0.5rem;
    }
    .drink-shell__brand {
      font-size: 0.98rem;
    }
    .drink-shell__nav {
      gap: 0.6rem;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .drink-shell__nav a,
    .drink-shell__signout {
      transition: none;
    }
  }
</style>
