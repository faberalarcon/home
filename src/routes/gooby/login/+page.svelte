<script lang="ts">
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<svelte:head>
  <title>GoobyGPT login - 21 Bristoe</title>
  <meta name="description" content="Private GoobyGPT access for 21 Bristoe" />
</svelte:head>

<div class="gooby-login">
  <header class="app-header">
    <div class="app-header__inner">
      <div class="app-header__top">
        <SiteBrand site="gooby" href="/gooby/" />
        <SiteNav current="gooby" fallbackMenu />
      </div>
    </div>
  </header>

  <main id="main-content" class="gooby-login__main">
    <section class="gooby-login__panel reveal" aria-labelledby="gooby-login-heading">
      <p class="gooby-login__kicker">Private model access</p>
      <h1 id="gooby-login-heading">GoobyGPT</h1>
      <p>Enter the shared GoobyGPT password to use the local llama.cpp models.</p>

      {#if form?.error}
        <div class="gooby-login__error" role="alert">{form.error}</div>
      {:else if !data.passwordConfigured}
        <div class="gooby-login__error" role="alert">GoobyGPT password is not configured.</div>
      {/if}

      <form method="POST" action="?/login" class="gooby-login__form">
        <input type="hidden" name="next" value={form?.next ?? data.next} />
        <label>
          <span>Password</span>
          <input
            type="password"
            name="password"
            autocomplete="current-password"
            disabled={!data.passwordConfigured}
          />
        </label>
        <button type="submit" disabled={!data.passwordConfigured}>Continue</button>
      </form>
    </section>
  </main>

  <SiteFooter visitorCount={data.visitorCount} />
</div>

<style>
  .gooby-login {
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    background:
      radial-gradient(circle at 18% 18%, color-mix(in oklab, var(--color-blood-500) 12%, transparent), transparent 24rem),
      linear-gradient(135deg, var(--color-ink-900), #111827 55%, #1f2937);
  }

  .gooby-login__main {
    flex: 1;
    display: grid;
    place-items: center;
    padding: 8rem 1rem 4rem;
  }

  .gooby-login__panel {
    width: min(100%, 27rem);
    padding: clamp(1.35rem, 4vw, 2rem);
    border: 1px solid rgba(241, 244, 247, 0.16);
    border-radius: var(--radius-sm, 0.5rem);
    background: color-mix(in oklab, var(--color-paper-50) 94%, transparent);
    box-shadow: 0 2rem 5rem -3rem rgba(0, 0, 0, 0.72);
  }

  .gooby-login__kicker {
    margin: 0 0 0.75rem;
    color: var(--color-blood-500);
    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.16em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .gooby-login__panel h1 {
    margin: 0;
    font-size: clamp(2.4rem, 8vw, 4rem);
  }

  .gooby-login__panel p {
    margin: 0.85rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.95rem;
  }

  .gooby-login__error {
    margin-top: 1rem;
    padding: 0.8rem 0.9rem;
    border: 1px solid color-mix(in oklab, var(--color-status-error) 38%, var(--color-paper-300));
    border-radius: var(--radius-sm, 0.5rem);
    background: color-mix(in oklab, var(--color-status-error) 8%, var(--color-paper-50));
    color: var(--color-status-error);
    font-size: 0.86rem;
    font-weight: 700;
  }

  .gooby-login__form {
    display: grid;
    gap: 1rem;
    margin-top: 1.35rem;
  }

  .gooby-login__form label {
    display: grid;
    gap: 0.45rem;
  }

  .gooby-login__form span {
    color: var(--color-ink-700);
    font-size: 0.76rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .gooby-login__form input {
    min-height: 3rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    padding: 0.75rem 0.85rem;
    font: inherit;
  }

  .gooby-login__form button {
    min-height: 3rem;
    border: 0;
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-blood-500);
    color: var(--color-paper-50);
    cursor: pointer;
    font-size: 0.78rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    transition: background 150ms ease, transform 150ms ease;
  }

  .gooby-login__form button:hover:not(:disabled) {
    background: var(--color-blood-600);
    transform: translateY(-1px);
  }

  .gooby-login__form button:disabled,
  .gooby-login__form input:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  @media (prefers-reduced-motion: reduce) {
    .gooby-login__form button {
      transition: none;
    }

    .gooby-login__form button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
