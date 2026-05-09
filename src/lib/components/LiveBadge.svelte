<script lang="ts">
  import type { StatusTone } from './StatusPill.svelte';

  interface Props {
    label?: string;
    detail?: string;
    status?: StatusTone;
    class?: string;
  }

  let {
    label = 'Live',
    detail = '',
    status = 'ok',
    class: className = ''
  }: Props = $props();
</script>

<span class={`live-badge ${className}`.trim()} data-status={status}>
  <span class="live-badge__dot" aria-hidden="true"></span>
  <span>{label}</span>
  {#if detail}
    <span class="live-badge__detail">{detail}</span>
  {/if}
</span>

<style>
  .live-badge {
    --badge-color: var(--color-status-on);
    display: inline-flex;
    align-items: center;
    width: max-content;
    max-width: 100%;
    gap: 0.45rem;
    padding: 0.4rem 0.65rem;
    border: 1px solid color-mix(in oklab, var(--badge-color) 28%, var(--color-paper-300));
    border-radius: 999px;
    background: color-mix(in oklab, var(--badge-color) 8%, var(--color-paper-50));
    color: var(--badge-color);
    font-family: var(--font-body);
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.08em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .live-badge[data-status="watch"] {
    --badge-color: var(--color-leaf-500);
  }

  .live-badge[data-status="attention"] {
    --badge-color: var(--color-status-error);
  }

  .live-badge[data-status="neutral"] {
    --badge-color: var(--color-ink-500);
  }

  .live-badge__dot {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 0 0.2rem color-mix(in oklab, currentColor 16%, transparent);
  }

  .live-badge[data-status="ok"] .live-badge__dot {
    animation: live-pulse 2.4s ease-in-out infinite;
  }

  .live-badge__detail {
    color: inherit;
    font-weight: 650;
    letter-spacing: 0.04em;
    opacity: 0.72;
    text-transform: none;
  }

  @keyframes live-pulse {
    0%, 100% { box-shadow: 0 0 0 0.2rem color-mix(in oklab, currentColor 22%, transparent); }
    50% { box-shadow: 0 0 0 0.45rem color-mix(in oklab, currentColor 4%, transparent); }
  }

  @media (prefers-reduced-motion: reduce) {
    .live-badge__dot {
      animation: none !important;
    }
  }
</style>
