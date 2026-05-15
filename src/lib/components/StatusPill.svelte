<script lang="ts">
  export type StatusTone = 'ok' | 'watch' | 'attention' | 'neutral';

  interface Props {
    status?: StatusTone;
    label?: string;
    class?: string;
  }

  const labels: Record<StatusTone, string> = {
    ok: 'OK',
    watch: 'Watch',
    attention: 'Needs attention',
    neutral: 'Info'
  };

  let {
    status = 'neutral',
    label,
    class: className = ''
  }: Props = $props();

  const text = $derived(label ?? labels[status]);
</script>

<span class={`status-pill ${className}`.trim()} data-status={status}>
  <span class="status-pill__dot" aria-hidden="true"></span>
  <span>{text}</span>
</span>

<style>
  .status-pill {
    --pill-color: var(--color-ink-500);
    display: inline-flex;
    align-items: center;
    width: max-content;
    max-width: 100%;
    gap: 0.45rem;
    padding: 0.28rem 0.55rem;
    border: 1px solid color-mix(in oklab, var(--pill-color) 26%, var(--color-paper-300));
    border-radius: 999px;
    background: color-mix(in oklab, var(--pill-color) 8%, var(--color-paper-50));
    color: var(--pill-color);
    font-family: var(--font-display);
    font-feature-settings: 'zero';
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    line-height: 1;
    text-transform: uppercase;
    white-space: nowrap;
  }

  .status-pill[data-status="ok"] {
    --pill-color: var(--color-status-on);
  }

  .status-pill[data-status="watch"] {
    --pill-color: var(--color-leaf-500);
  }

  .status-pill[data-status="attention"] {
    --pill-color: var(--color-status-error);
  }

  .status-pill__dot {
    width: 0.45rem;
    height: 0.45rem;
    border-radius: 999px;
    background: currentColor;
    box-shadow: 0 0 0 0.2rem color-mix(in oklab, currentColor 16%, transparent);
    flex: 0 0 auto;
  }
</style>
