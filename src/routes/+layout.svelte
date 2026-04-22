<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';

  let { children } = $props();

  const navLinks = [
    { href: '/',        numeral: 'I',   label: 'Overview' },
    { href: '/house',   numeral: 'II',  label: 'House' },
    { href: '/drinks',  numeral: 'III', label: 'Drinks' },
    { href: '/backups', numeral: 'IV',  label: 'Backups' },
    { href: '/pi',      numeral: 'V',   label: 'Pi' }
  ];

  const now = new Date();
  const buildYear = now.getFullYear();
</script>

<a href="#main-content" class="skip-to-content">Skip to content</a>

<header class="dossier-masthead">
  <div class="dossier-masthead__inner">
    <div class="dossier-masthead__brand">
      <a class="dossier-masthead__home" href="https://21bristoe.com">
        <span class="dossier-masthead__arrow" aria-hidden="true">&larr;</span>
        <span class="dossier-masthead__home-domain">21bristoe.com</span>
      </a>
      <span class="dossier-masthead__sep" aria-hidden="true">&middot;</span>
      <span class="dossier-masthead__page">Stats</span>
    </div>
    <nav class="dossier-masthead__nav" aria-label="Sections">
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

<main id="main-content" class="instruments-main">
  {@render children()}
</main>

<footer class="instruments-colophon">
  <div class="instruments-colophon__inner">
    <div class="instruments-colophon__mark" aria-hidden="true">
      <span class="instruments-colophon__mark-word">21&middot;Bristoe</span>
      <span class="instruments-colophon__mark-line"></span>
      <span class="instruments-colophon__mark-sub">21 Bristoe Stats</span>
    </div>
    <div class="instruments-colophon__foot">
      <p>&copy; {buildYear} &middot; 21 Bristoe Station Rd, Taneytown, Md.</p>
      <div class="instruments-colophon__links">
        <a href="https://21bristoe.com">21bristoe.com</a>
        <a href="https://drink-hub.21bristoe.com">Drink Hub</a>
      </div>
    </div>
  </div>
</footer>

<style>
  .instruments-main {
    max-width: var(--measure-full);
    margin: 0 auto;
    padding: 3rem 1.5rem 4rem;
  }
  @media (max-width: 640px) {
    .instruments-main { padding: 2rem 1rem 3rem; }
  }

  .instruments-colophon {
    margin-top: 4rem;
    background: var(--color-ink-900);
    color: var(--color-paper-100);
    padding: 3rem 1.5rem 2rem;
  }
  .instruments-colophon__inner { max-width: var(--measure-full); margin: 0 auto; }
  .instruments-colophon__mark {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .instruments-colophon__mark-word {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--color-paper-50);
    font-variation-settings: 'opsz' 36, 'SOFT' 30;
  }
  .instruments-colophon__mark-line {
    flex: 1;
    height: 1px;
    background: rgba(245, 239, 223, 0.15);
  }
  .instruments-colophon__mark-sub {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-paper-100);
    opacity: 0.6;
  }
  .instruments-colophon__foot {
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
  .instruments-colophon__links {
    display: flex;
    gap: 1.5rem;
  }
  .instruments-colophon__links a {
    color: var(--color-leaf-300);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: border-color 0.2s;
  }
  .instruments-colophon__links a:hover { border-bottom-color: var(--color-leaf-300); }
</style>
