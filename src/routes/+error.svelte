<script lang="ts">
  import { page } from '$app/stores';
</script>

<svelte:head>
  <title>Error — 21 Bristoe Stats</title>
</svelte:head>

<article class="errata">
  <p class="dashboard-kicker">Error</p>
  <p class="errata__numeral">{$page.status}</p>
  <hr class="dashboard-rule" />
  <h1 class="errata__head">
    {$page.status === 404 ? 'Page not found.' : 'Something went wrong.'}
  </h1>
  <p class="errata__body">{$page.error?.message ?? 'An unexpected error occurred.'}</p>
  <a href="/" class="dashboard-button dashboard-button--accent">Return to Overview</a>
</article>

<style>
  .errata {
    max-width: 48ch;
    margin: 4rem auto;
    text-align: center;
  }
  .errata__numeral {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 500;
    font-size: clamp(5rem, 14vw, 9rem);
    line-height: 0.9;
    color: var(--color-ink-900);
    margin: 1rem 0 0;
    font-variation-settings: 'opsz' 144, 'SOFT' 100;
  }
  .errata__head {
    font-family: var(--font-display);
    font-size: clamp(1.5rem, 2.5vw + 1rem, 2.25rem);
    font-weight: 500;
    color: var(--color-ink-900);
    margin: 1rem 0;
    font-variation-settings: 'opsz' 48, 'SOFT' 30;
  }
  .errata__body {
    font-family: var(--font-body);
    font-size: 1rem;
    color: var(--color-ink-700);
    margin: 0 auto 2rem;
    max-width: 40ch;
  }
</style>
