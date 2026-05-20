<script lang="ts">
  import { onMount } from 'svelte';

  interface Props {
    visitorCount?: number | null;
    brand?: string;
    location?: string;
    tagline?: string;
    liveVisitorHref?: string | null;
    extraClass?: string;
  }

  let {
    visitorCount = null,
    brand = '21 Bristoe',
    location = '21 Bristoe Station Rd, Taneytown, Md.',
    tagline = 'Home, drinks, and household stats.',
    liveVisitorHref = '/uploads/visitor-count.json',
    extraClass = ''
  }: Props = $props();

  const year = new Date().getFullYear();
  let fetchedVisitorCount = $state<number | null>(null);
  const displayedVisitorCount = $derived(fetchedVisitorCount ?? visitorCount);
  const formattedVisitorCount = $derived(displayedVisitorCount?.toLocaleString() ?? '');

  onMount(() => {
    if (!liveVisitorHref) return;

    fetch(liveVisitorHref, { cache: 'no-cache' })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (data && typeof data.count === 'number') {
          fetchedVisitorCount = data.count;
        }
      })
      .catch(() => {});
  });
</script>

<footer class={`site-footer ${extraClass}`}>
  <div class="site-footer__inner">
    <div class="site-footer__mark" aria-hidden="true">
      <span class="site-footer__brand">{brand}</span>
      <span class="site-footer__line"></span>
      <span class="site-footer__sub">Home / Drinks / Stats / Gallery</span>
    </div>

    <div class="site-footer__body">
      <div class="site-footer__copy">
        <p>&copy; {year} &middot; {location}</p>
        <p>{tagline}</p>
      </div>

      <nav aria-label="Footer navigation">
        <ul class="site-footer__links" role="list">
          <li><a href="/">Home</a></li>
          <li><a href="/drinks/">Drinks</a></li>
          <li><a href="/stats/">Stats</a></li>
          <li><a href="/gallery/">Gallery</a></li>
          <li><a href="/gooby/">GoobyGPT</a></li>
          <li>
            <a href="https://github.com/faberalarcon/home" target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
          </li>
        </ul>
      </nav>
    </div>

    {#if displayedVisitorCount !== null}
      <div class="site-footer__visitors">
        <span class="site-footer__count">{formattedVisitorCount}</span>
        <span>unique visitors so far</span>
      </div>
    {/if}
  </div>
</footer>

<style>
  .site-footer {
    width: 100%;
    margin-top: auto;
    background: var(--color-ink-900);
    color: var(--color-paper-100);
    padding: 3rem 1.5rem 2rem;
  }

  .site-footer__inner {
    max-width: var(--measure-full);
    margin: 0 auto;
  }

  .site-footer__mark {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 1.75rem;
  }

  .site-footer__brand {
    font-family: var(--font-display);
    font-size: 1.25rem;
    color: var(--color-paper-50);
    font-variation-settings: 'opsz' 36, 'SOFT' 30;
    white-space: nowrap;
  }

  .site-footer__line {
    flex: 1;
    height: 1px;
    background: rgba(245, 239, 223, 0.15);
  }

  .site-footer__sub {
    color: var(--color-paper-100);
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    opacity: 0.6;
    white-space: nowrap;
  }

  .site-footer__body {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .site-footer__copy {
    color: var(--color-paper-100);
    font-family: var(--font-body);
    font-size: 0.75rem;
    opacity: 0.72;
  }

  .site-footer__copy p {
    margin: 0;
    line-height: 1.55;
  }

  .site-footer__links {
    display: flex;
    align-items: center;
    gap: 1.35rem;
    flex-wrap: wrap;
    list-style: none;
    margin: 0;
    padding: 0;
    font-family: var(--font-body);
    font-size: 0.75rem;
  }

  .site-footer__links a {
    color: var(--color-blood-300);
    text-decoration: none;
    border-bottom: 1px solid transparent;
    padding-bottom: 1px;
    transition: border-color 0.2s ease, color 0.2s ease;
  }

  .site-footer__links a:hover {
    border-bottom-color: currentColor;
  }

  .site-footer__visitors {
    margin-top: 1.35rem;
    padding-top: 1.25rem;
    border-top: 1px solid rgba(245, 239, 223, 0.1);
    color: var(--color-paper-100);
    font-family: var(--font-body);
    font-size: 0.75rem;
    text-align: center;
    opacity: 0.65;
  }

  .site-footer__count {
    margin-right: 0.25em;
    color: var(--color-paper-50);
    font-family: var(--font-mono);
    font-weight: 600;
    opacity: 1;
  }

  @media (max-width: 640px) {
    .site-footer {
      padding: 2.5rem 1rem 1.75rem;
    }

    .site-footer__mark {
      align-items: flex-start;
      flex-direction: column;
      gap: 0.6rem;
    }

    .site-footer__line {
      width: 100%;
      flex: none;
    }

    .site-footer__body {
      gap: 1rem;
    }

    .site-footer__links {
      gap: 1rem;
    }
  }

  @media (prefers-color-scheme: dark) {
    .site-footer {
      background: #05080c;
    }

    .site-footer__brand,
    .site-footer__count {
      color: #f0f4f8;
    }

    .site-footer__sub,
    .site-footer__copy,
    .site-footer__visitors {
      color: #c9d2dc;
    }

    .site-footer__links a {
      color: #8bb8e0;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-footer__links a {
      transition: none;
    }
  }
</style>
