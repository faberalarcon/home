<script lang="ts">
  let {
    label,
    active = false,
    activeText = 'On',
    inactiveText = 'Off'
  }: {
    label: string;
    active: boolean;
    activeText?: string;
    inactiveText?: string;
  } = $props();
</script>

<span class="badge" class:badge--active={active}>
  <span class="badge__dot" aria-hidden="true"></span>
  <span class="badge__label">{label}</span>
  <span class="badge__state">&middot; {active ? activeText : inactiveText}</span>
</span>

<style>
  .badge {
    display: inline-flex;
    align-items: center;
    gap: 0.55rem;
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    padding: 0.45rem 0.85rem;
    border: 1px solid var(--color-paper-300);
    color: var(--color-ink-500);
    background: transparent;
  }
  .badge--active {
    border-color: var(--color-status-on);
    color: var(--color-status-on);
  }
  .badge__dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: currentColor;
    box-shadow: 0 0 0 3px color-mix(in oklab, currentColor 18%, transparent);
  }
  .badge--active .badge__dot {
    animation: badge-pulse 2.2s ease-in-out infinite;
  }
  @keyframes badge-pulse {
    0%, 100% { box-shadow: 0 0 0 3px color-mix(in oklab, currentColor 25%, transparent); }
    50%      { box-shadow: 0 0 0 6px color-mix(in oklab, currentColor 5%, transparent); }
  }
  .badge__state {
    font-weight: 500;
    letter-spacing: 0.1em;
    color: inherit;
    opacity: 0.75;
  }
</style>
