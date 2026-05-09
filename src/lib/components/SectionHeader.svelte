<script lang="ts">
  interface Props {
    id?: string;
    eyebrow?: string;
    title: string;
    description?: string;
    meta?: string;
    actionHref?: string;
    actionLabel?: string;
    compact?: boolean;
    class?: string;
  }

  let {
    id = '',
    eyebrow = '',
    title,
    description = '',
    meta = '',
    actionHref = '',
    actionLabel = '',
    compact = false,
    class: className = ''
  }: Props = $props();

  const kicker = $derived(eyebrow || meta);
  const classes = $derived(`section-heading ${className}`.trim());
</script>

<div class={classes} data-compact={compact}>
  <div class="section-heading__copy">
    {#if kicker}
      <p class="section-heading__eyebrow">{kicker}</p>
    {/if}
    <h2 id={id || undefined} class="section-heading__title">{title}</h2>
    {#if description}
      <p class="section-heading__description">{description}</p>
    {/if}
  </div>

  {#if actionHref && actionLabel}
    <a class="section-heading__action" href={actionHref}>{actionLabel}</a>
  {/if}
</div>

<style>
  .section-heading {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: clamp(1.1rem, 2vw, 1.5rem);
  }

  .section-heading__copy {
    min-width: 0;
    max-width: 44rem;
  }

  .section-heading__eyebrow {
    margin: 0 0 0.35rem;
    color: var(--color-blood-500);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.14em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .section-heading__title {
    margin: 0;
    color: var(--color-ink-900);
    font-family: var(--font-display);
    font-size: clamp(2rem, 4vw, 3.35rem);
    font-weight: 620;
    letter-spacing: 0;
    line-height: 1.02;
    font-variation-settings: 'opsz' 96, 'SOFT' 40;
  }

  .section-heading__description {
    margin: 0.65rem 0 0;
    color: var(--color-ink-500);
    font-size: clamp(0.98rem, 1.4vw, 1.1rem);
    line-height: 1.55;
  }

  .section-heading__action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 2.4rem;
    padding: 0.55rem 0.85rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    color: var(--color-blood-500);
    font-size: 0.8rem;
    font-weight: 800;
    text-decoration: none;
    white-space: nowrap;
  }

  .section-heading__action:hover {
    border-color: var(--color-blood-500);
    text-decoration: none;
  }

  .section-heading[data-compact="true"] {
    margin-bottom: 0.9rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--color-paper-300);
  }

  .section-heading[data-compact="true"] .section-heading__eyebrow {
    color: var(--color-ink-500);
    font-family: var(--font-mono);
    font-size: 0.68rem;
    letter-spacing: 0.1em;
  }

  .section-heading[data-compact="true"] .section-heading__title {
    font-family: var(--font-body);
    font-size: 0.8rem;
    font-weight: 850;
    letter-spacing: 0.14em;
    text-transform: uppercase;
  }

  .section-heading[data-compact="true"] .section-heading__description {
    font-size: 0.82rem;
  }

  @media (max-width: 640px) {
    .section-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .section-heading__action {
      width: max-content;
      max-width: 100%;
    }
  }
</style>
