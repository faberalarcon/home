<script lang="ts">
  import '../app.css';
  import HubNav from '$lib/components/HubNav.svelte';
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
  <div class="drink-shell">
    <header class="drink-shell__masthead">
      <a href="/menu" class="drink-shell__brand">
        <span aria-hidden="true">21&middot;</span>Bristoe <em>Drink Hub</em>
      </a>
      <HubNav current="drinks" />
      <nav class="drink-shell__nav" aria-label="Drink Hub">
        <a href="/menu" aria-current={$page.url.pathname === '/menu' ? 'page' : undefined}>Menu</a>
        <a href="/recent" aria-current={$page.url.pathname === '/recent' ? 'page' : undefined}>Recent</a>
        <a href="/stats" aria-current={$page.url.pathname === '/stats' ? 'page' : undefined}>Stats</a>
        <a href="/admin" aria-current={$page.url.pathname.startsWith('/admin') ? 'page' : undefined}>Admin</a>
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
          <a href="/">Pick profile</a>
        {/if}
        {#if data.sitePasswordEnabled && data.siteAuthenticated}
          <form method="POST" action="/login?/logout">
            <button type="submit" class="drink-shell__signout">Sign out</button>
          </form>
        {/if}
      </nav>
    </header>
    <main class="drink-shell__main">
      {@render children()}
    </main>
    <footer class="drink-shell__footer">
      <span>21 Bristoe Station Rd, Taneytown, Md.</span>
      <a href="https://21bristoe.com">Home</a>
      <a href="https://stats.21bristoe.com">Stats</a>
    </footer>
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
    position: sticky;
    top: 0;
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
    padding: 0.8rem 1rem;
    border-bottom: 1px solid color-mix(in oklab, var(--color-paper-300) 80%, transparent);
    background: color-mix(in oklab, var(--color-paper-50) 92%, transparent);
    backdrop-filter: blur(14px);
  }
  .drink-shell__brand {
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 2.2vw, 1.35rem);
    font-weight: 650;
    color: var(--color-ink-900);
    text-decoration: none;
    white-space: nowrap;
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
    justify-content: flex-end;
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
  }
  .drink-shell__nav a:hover,
  .drink-shell__nav a[aria-current="page"],
  .drink-shell__signout:hover {
    color: var(--color-blood-500);
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
    padding: 1.25rem 1rem 2.5rem;
  }
  .drink-shell__footer {
    display: flex;
    justify-content: center;
    flex-wrap: wrap;
    gap: 0.5rem 1rem;
    padding: 1.25rem 1rem;
    border-top: 1px solid var(--color-paper-300);
    color: var(--color-ink-500);
    font-size: 0.75rem;
  }
  .drink-shell__footer a {
    color: var(--color-blood-500);
    text-decoration: none;
  }
  @media (max-width: 520px) {
    .drink-shell__masthead {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.55rem;
    }
    .drink-shell__nav {
      justify-content: flex-start;
      gap: 0.6rem;
    }
  }
</style>
