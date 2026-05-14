<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  const phrases = [
    'Playing catch',
    'Chasing a ball',
    'Eating homework',
    'Digging a hole',
    'Sniffing the breeze',
    'Chasing the mailman',
    'Burying a bone',
    'Wagging vigorously',
    'Rolling in the grass',
    'Barking at squirrels',
    'Fetching the slipper',
    'Begging for treats'
  ];

  function pickRandom(exclude?: string): string {
    if (phrases.length <= 1) return phrases[0];
    let next = phrases[Math.floor(Math.random() * phrases.length)];
    while (next === exclude) {
      next = phrases[Math.floor(Math.random() * phrases.length)];
    }
    return next;
  }

  let phrase = $state(pickRandom());
  let timer: ReturnType<typeof setInterval> | null = null;

  onMount(() => {
    timer = setInterval(() => {
      phrase = pickRandom(phrase);
    }, 2800);
  });

  onDestroy(() => {
    if (timer) clearInterval(timer);
  });
</script>

<p class="thinking" aria-live="polite">
  <span class="phrase">{phrase}</span>
  <span class="dots" aria-hidden="true">
    <span></span><span></span><span></span>
  </span>
</p>

<style>
  .thinking {
    margin: 0.35rem 0 0;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    color: var(--color-ink-700);
    font-size: 0.92rem;
    font-weight: 600;
    font-style: italic;
    line-height: 1.4;
  }

  .phrase {
    animation: phrase-fade 2.8s infinite ease-in-out;
  }

  @keyframes phrase-fade {
    0%, 100% { opacity: 1; transform: translateY(0); }
    8%       { opacity: 1; transform: translateY(0); }
    92%      { opacity: 1; transform: translateY(0); }
    96%      { opacity: 0; transform: translateY(-2px); }
    0%       { opacity: 0; transform: translateY(4px); }
  }

  .dots {
    display: inline-flex;
    gap: 0.22rem;
  }

  .dots span {
    width: 0.38rem;
    height: 0.38rem;
    border-radius: 999px;
    background: var(--color-ink-500);
    opacity: 0.45;
    animation: dot-pulse 1.2s infinite ease-in-out;
  }

  .dots span:nth-child(2) {
    animation-delay: 0.18s;
  }
  .dots span:nth-child(3) {
    animation-delay: 0.36s;
  }

  @keyframes dot-pulse {
    0%, 80%, 100% { opacity: 0.25; transform: translateY(0); }
    40%           { opacity: 0.95; transform: translateY(-2px); }
  }

  @media (prefers-reduced-motion: reduce) {
    .phrase { animation: none; }
    .dots span { animation: none; opacity: 0.6; }
  }
</style>
