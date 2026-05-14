<script lang="ts">
  interface Props {
    onPick: (prompt: string) => void;
  }

  let { onPick }: Props = $props();

  const chips = [
    { label: 'Plan a weekend project', prompt: 'Help me plan a fun weekend project I can do around the house.' },
    { label: 'Explain something', prompt: 'Explain how SSE streaming works in simple terms.' },
    { label: 'Brainstorm ideas', prompt: 'Brainstorm 5 dinner ideas using what is usually in our pantry.' },
    { label: 'Limón tips', prompt: 'Give me 3 ideas for keeping Limón entertained on a rainy day.' }
  ];
</script>

<section class="empty">
  <div class="halo" aria-hidden="true">G</div>
  <h2>What can I help with?</h2>
  <p>Local, private chat against your llama.cpp server. No cloud, no logging.</p>
  <div class="chips">
    {#each chips as chip}
      <button type="button" onclick={() => onPick(chip.prompt)}>
        <span>{chip.label}</span>
      </button>
    {/each}
  </div>
</section>

<style>
  .empty {
    display: grid;
    justify-items: center;
    align-content: center;
    gap: 0.55rem;
    width: 100%;
    max-width: 32rem;
    margin: auto;
    padding: 2rem 1rem;
    text-align: center;
  }

  .halo {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 3.25rem;
    height: 3.25rem;
    border-radius: 999px;
    background: var(--color-warm-400);
    color: var(--color-paper-50);
    font-size: 1.35rem;
    font-weight: 800;
    margin-bottom: 0.4rem;
  }

  h2 {
    margin: 0;
    font-size: clamp(1.6rem, 6vw, 2.1rem);
    color: var(--color-ink-900);
    font-weight: 720;
  }

  p {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.92rem;
    line-height: 1.45;
  }

  .chips {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.5rem;
    width: 100%;
    margin-top: 1rem;
  }

  .chips button {
    display: block;
    width: 100%;
    text-align: left;
    border: 1px solid var(--color-paper-300);
    border-radius: 0.9rem;
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    padding: 0.7rem 0.85rem;
    font-size: 0.88rem;
    font-weight: 600;
    line-height: 1.3;
    cursor: pointer;
    transition: background 120ms ease, border-color 120ms ease, transform 120ms ease;
  }

  .chips button:hover {
    background: var(--color-paper-100);
    border-color: color-mix(in oklab, var(--color-ink-900) 18%, var(--color-paper-300));
    transform: translateY(-1px);
  }

  @media (max-width: 480px) {
    .chips { grid-template-columns: 1fr; }
  }

  @media (prefers-reduced-motion: reduce) {
    .chips button { transition: none; }
    .chips button:hover { transform: none; }
  }
</style>
