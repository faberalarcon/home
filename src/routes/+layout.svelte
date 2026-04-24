<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import HubNav from '$lib/components/HubNav.svelte';

  let { children } = $props();

  const navLinks = [
    { href: '/',        label: 'Overview' },
    { href: '/house',   label: 'House' },
    { href: '/drinks',  label: 'Drinks' },
    { href: '/backups', label: 'Backups' },
    { href: '/pi',      label: 'Pi' }
  ];

  const now = new Date();
  const buildYear = now.getFullYear();
</script>

<a href="#main-content" class="skip-to-content">Skip to content</a>

<header class="app-header">
  <div class="app-header__inner">
    <div class="app-header__top">
      <a class="app-header__brand" href="https://21bristoe.com">
        21 Bristoe <em>Stats</em>
      </a>
      <HubNav current="stats" />
    </div>
    <nav class="app-header__nav" aria-label="Stats sections">
      {#each navLinks as link}
        <a
          href={link.href}
          aria-current={$page.url.pathname === link.href ? 'page' : undefined}
        >
          {link.label}
        </a>
      {/each}
    </nav>
  </div>
</header>

<main id="main-content" class="app-main">
  {@render children()}
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
        <a href="https://drink-hub.21bristoe.com">Drink Hub</a>
      </div>
    </div>
  </div>
</footer>

<style>
  .app-main {
    max-width: var(--measure-full);
    margin: 0 auto;
    padding: 1.5rem clamp(0.875rem, 2vw, 1.5rem) 3rem;
    width: 100%;
    min-width: 0;
  }
  @media (max-width: 640px) {
    .app-main { padding: 1rem 0.875rem 2.5rem; }
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
</style>
