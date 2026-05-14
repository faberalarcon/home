<script lang="ts">
  interface Props {
    visible: boolean;
    onClick: () => void;
  }

  let { visible, onClick }: Props = $props();
</script>

{#if visible}
  <button class="pill" type="button" onclick={onClick} aria-label="Scroll to latest">
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
    </svg>
  </button>
{/if}

<style>
  .pill {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    bottom: 0.6rem;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.2rem;
    height: 2.2rem;
    border: 1px solid var(--color-paper-300);
    border-radius: 999px;
    background: var(--color-paper-50);
    color: var(--color-ink-700);
    box-shadow: 0 6px 18px rgb(0 0 0 / 0.14);
    cursor: pointer;
    z-index: 5;
    animation: rise 140ms ease;
  }

  .pill:hover {
    background: var(--color-paper-100);
    color: var(--color-ink-900);
  }

  @keyframes rise {
    from { opacity: 0; transform: translate(-50%, 6px); }
    to   { opacity: 1; transform: translate(-50%, 0); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill { animation: none; }
  }
</style>
