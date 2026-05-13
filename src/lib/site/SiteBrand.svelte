<script lang="ts">
  type SiteKey = 'home' | 'drinks' | 'stats' | 'gooby';

  interface Props {
    site?: SiteKey;
    href?: string;
  }

  let { site = 'home', href = '/' }: Props = $props();

  const suffixBySite: Record<SiteKey, string> = {
    home: '',
    drinks: 'Drinks',
    stats: 'Stats',
    gooby: 'GoobyGPT'
  };

  const suffix = $derived(suffixBySite[site]);
</script>

<a class="site-brand" href={href} aria-label={suffix ? `21 Bristoe ${suffix}` : '21 Bristoe'}>
  <span>21 Bristoe</span>
  {#if suffix}
    <em>{suffix}</em>
  {/if}
</a>

<style>
  .site-brand {
    display: inline-flex;
    align-items: baseline;
    gap: 0.28em;
    min-width: 0;
    color: #fff;
    font-family: var(--font-display);
    font-size: clamp(1.05rem, 2.2vw, 1.35rem);
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1;
    text-decoration: none;
    white-space: nowrap;
    font-variation-settings: 'opsz' 48, 'SOFT' 30;
    transition: color 0.18s ease;
  }

  .site-brand:hover {
    color: var(--color-paper-200);
  }

  .site-brand em {
    color: var(--color-blood-500);
    font-style: italic;
    font-weight: 450;
  }

  @media (max-width: 520px) {
    .site-brand {
      font-size: 0.98rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .site-brand {
      transition: none;
    }
  }
</style>
