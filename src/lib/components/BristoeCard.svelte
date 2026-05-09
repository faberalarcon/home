<script lang="ts">
  import type { Snippet } from 'svelte';

  type Variant = 'default' | 'soft' | 'feature' | 'warning' | 'success' | 'attention';

  interface Props {
    variant?: Variant;
    href?: string | null;
    target?: string | null;
    rel?: string | null;
    ariaLabel?: string | null;
    class?: string;
    header?: Snippet;
    footer?: Snippet;
    children?: Snippet;
  }

  let {
    variant = 'default',
    href = null,
    target = null,
    rel = null,
    ariaLabel = null,
    class: className = '',
    header,
    footer,
    children
  }: Props = $props();

  const classes = $derived(`bristoe-card ${className}`.trim());
</script>

{#if href}
  <a
    class={classes}
    data-variant={variant}
    href={href}
    target={target ?? undefined}
    rel={rel ?? undefined}
    aria-label={ariaLabel ?? undefined}
  >
    {#if header}
      <div class="bristoe-card__header">
        {@render header()}
      </div>
    {/if}

    {@render children?.()}

    {#if footer}
      <div class="bristoe-card__footer">
        {@render footer()}
      </div>
    {/if}
  </a>
{:else}
  <article class={classes} data-variant={variant} aria-label={ariaLabel ?? undefined}>
    {#if header}
      <div class="bristoe-card__header">
        {@render header()}
      </div>
    {/if}

    {@render children?.()}

    {#if footer}
      <div class="bristoe-card__footer">
        {@render footer()}
      </div>
    {/if}
  </article>
{/if}

<style>
  .bristoe-card {
    --card-accent: var(--color-blood-500);
    display: block;
    min-width: 0;
    height: 100%;
    padding: var(--bristoe-card-padding, clamp(1rem, 2vw, 1.25rem));
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-100);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 1rem 2.25rem -2rem color-mix(in oklab, var(--color-ink-900) 36%, transparent);
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease, background 160ms ease;
  }

  .bristoe-card[data-variant="soft"] {
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--color-paper-100) 92%, white), var(--color-paper-50)),
      var(--color-paper-100);
  }

  .bristoe-card[data-variant="feature"] {
    --card-accent: var(--color-blood-500);
    border-color: color-mix(in oklab, var(--color-blood-500) 34%, var(--color-paper-300));
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--color-blood-300) 18%, var(--color-paper-100)), var(--color-paper-50)),
      var(--color-paper-100);
  }

  .bristoe-card[data-variant="success"] {
    --card-accent: var(--color-status-on);
    border-color: color-mix(in oklab, var(--color-status-on) 28%, var(--color-paper-300));
  }

  .bristoe-card[data-variant="warning"] {
    --card-accent: var(--color-leaf-500);
    border-color: color-mix(in oklab, var(--color-leaf-500) 36%, var(--color-paper-300));
  }

  .bristoe-card[data-variant="attention"] {
    --card-accent: var(--color-status-error);
    border-color: color-mix(in oklab, var(--color-status-error) 34%, var(--color-paper-300));
  }

  a.bristoe-card:hover {
    color: inherit;
    text-decoration: none;
    transform: translateY(-2px);
    border-color: color-mix(in oklab, var(--card-accent) 48%, var(--color-paper-300));
    box-shadow: 0 1.25rem 2.75rem -2rem color-mix(in oklab, var(--color-ink-900) 42%, transparent);
  }

  .bristoe-card__header {
    margin-bottom: 1rem;
  }

  .bristoe-card__footer {
    margin-top: 1rem;
    padding-top: 1rem;
    border-top: 1px solid var(--color-paper-300);
  }

  @media (prefers-reduced-motion: reduce) {
    .bristoe-card {
      transition: none;
    }

    a.bristoe-card:hover {
      transform: none;
    }
  }
</style>
