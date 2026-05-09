<script lang="ts">
  import StatusPill, { type StatusTone } from './StatusPill.svelte';

  interface Props {
    label: string;
    value: string | number;
    detail?: string;
    icon?: string;
    status?: StatusTone;
    href?: string | null;
    target?: string | null;
    rel?: string | null;
    class?: string;
  }

  let {
    label,
    value,
    detail = '',
    icon = '',
    status = 'neutral',
    href = null,
    target = null,
    rel = null,
    class: className = ''
  }: Props = $props();

  const classes = $derived(`metric-tile ${className}`.trim());
</script>

{#snippet tileContent()}
  <div class="metric-tile__top">
    <span class="metric-tile__label">{label}</span>
    {#if icon}
      <span class="metric-tile__icon" aria-hidden="true">{icon}</span>
    {/if}
  </div>
  <div class="metric-tile__value">{value}</div>
  <div class="metric-tile__footer">
    {#if detail}
      <p>{detail}</p>
    {/if}
    {#if status !== 'neutral'}
      <StatusPill {status} />
    {/if}
  </div>
{/snippet}

{#if href}
  <a class={classes} data-status={status} href={href} target={target ?? undefined} rel={rel ?? undefined}>
    {@render tileContent()}
  </a>
{:else}
  <article class={classes} data-status={status}>
    {@render tileContent()}
  </article>
{/if}

<style>
  .metric-tile {
    --tile-accent: var(--color-blood-500);
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
    min-height: 9.25rem;
    padding: 1rem;
    border: 1px solid var(--color-paper-300);
    border-top: 3px solid var(--tile-accent);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-100);
    color: inherit;
    text-decoration: none;
    box-shadow: 0 0.9rem 2rem -1.9rem color-mix(in oklab, var(--color-ink-900) 36%, transparent);
    transition: transform 160ms ease, border-color 160ms ease, box-shadow 160ms ease;
  }

  .metric-tile[data-status="ok"] {
    --tile-accent: var(--color-status-on);
  }

  .metric-tile[data-status="watch"] {
    --tile-accent: var(--color-leaf-500);
  }

  .metric-tile[data-status="attention"] {
    --tile-accent: var(--color-status-error);
  }

  a.metric-tile:hover {
    color: inherit;
    text-decoration: none;
    transform: translateY(-2px);
    border-color: color-mix(in oklab, var(--tile-accent) 42%, var(--color-paper-300));
    box-shadow: 0 1.15rem 2.4rem -1.9rem color-mix(in oklab, var(--color-ink-900) 42%, transparent);
  }

  .metric-tile__top,
  .metric-tile__footer {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 0.75rem;
    min-width: 0;
  }

  .metric-tile__label {
    color: var(--color-ink-500);
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .metric-tile__icon {
    display: inline-grid;
    place-items: center;
    width: 2rem;
    height: 2rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--tile-accent) 12%, var(--color-paper-50));
    font-size: 1.15rem;
    flex: 0 0 auto;
  }

  .metric-tile__value {
    color: var(--color-ink-900);
    font-family: var(--font-mono);
    font-size: clamp(1.65rem, 3vw, 2.4rem);
    font-weight: 600;
    letter-spacing: 0;
    line-height: 1;
    overflow-wrap: anywhere;
  }

  .metric-tile__footer {
    align-items: end;
  }

  .metric-tile__footer p {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.82rem;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }

  @media (max-width: 520px) {
    .metric-tile {
      min-height: 8.5rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .metric-tile {
      transition: none;
    }

    a.metric-tile:hover {
      transform: none;
    }
  }
</style>
