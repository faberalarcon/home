<script lang="ts">
  interface Props {
    href: string;
    title: string;
    description: string;
    icon?: string;
    eyebrow?: string;
    external?: boolean;
    class?: string;
  }

  let {
    href,
    title,
    description,
    icon = '↗',
    eyebrow = '',
    external,
    class: className = ''
  }: Props = $props();

  const opensExternal = $derived(external ?? (/^https?:\/\//.test(href) && !href.startsWith('https://21bristoe.com')));
  const classes = $derived(`action-card ${className}`.trim());
</script>

<a
  class={classes}
  href={href}
  target={opensExternal ? '_blank' : undefined}
  rel={opensExternal ? 'noopener noreferrer' : undefined}
  aria-label={opensExternal ? `${title} (opens in new tab)` : title}
>
  <span class="action-card__icon" aria-hidden="true">{icon}</span>
  <span class="action-card__body">
    {#if eyebrow}
      <span class="action-card__eyebrow">{eyebrow}</span>
    {/if}
    <span class="action-card__title">{title}</span>
    <span class="action-card__description">{description}</span>
  </span>
  <span class="action-card__arrow" aria-hidden="true">→</span>
</a>

<style>
  .action-card {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 1rem;
    min-width: 0;
    min-height: 8.75rem;
    padding: 1rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--color-paper-100) 92%, white), var(--color-paper-50)),
      var(--color-paper-100);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 1rem 2.2rem -2rem color-mix(in oklab, var(--color-ink-900) 34%, transparent);
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .action-card:hover {
    color: inherit;
    text-decoration: none;
    transform: translateY(-2px);
    border-color: color-mix(in oklab, var(--color-blood-500) 42%, var(--color-paper-300));
    box-shadow: 0 1.2rem 2.6rem -2rem color-mix(in oklab, var(--color-ink-900) 42%, transparent);
  }

  .action-card__icon {
    display: inline-grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    border-radius: var(--radius-sm, 0.5rem);
    background: color-mix(in oklab, var(--color-blood-500) 12%, var(--color-paper-50));
    font-size: 1.55rem;
    flex: 0 0 auto;
  }

  .action-card__body {
    display: flex;
    flex-direction: column;
    min-width: 0;
    gap: 0.25rem;
  }

  .action-card__eyebrow {
    color: var(--color-ink-500);
    font-family: var(--font-body);
    font-size: 0.64rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .action-card__title {
    color: var(--color-ink-900);
    font-family: var(--font-display);
    font-size: clamp(1.25rem, 2vw, 1.55rem);
    font-weight: 650;
    letter-spacing: 0;
    line-height: 1.05;
  }

  .action-card__description {
    color: var(--color-ink-500);
    font-size: 0.88rem;
    line-height: 1.4;
  }

  .action-card__arrow {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    color: var(--color-blood-500);
    background: color-mix(in oklab, var(--color-blood-500) 10%, transparent);
    font-size: 1.1rem;
    transition: translate 160ms ease;
  }

  .action-card:hover .action-card__arrow {
    translate: 2px 0;
  }

  @media (max-width: 520px) {
    .action-card {
      grid-template-columns: auto minmax(0, 1fr);
      min-height: 0;
    }

    .action-card__arrow {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .action-card,
    .action-card__arrow {
      transition: none;
    }

    .action-card:hover {
      transform: none;
    }

    .action-card:hover .action-card__arrow {
      translate: 0 0;
    }
  }
</style>
