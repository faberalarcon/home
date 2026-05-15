<script lang="ts">
  import MarkdownMessage from '$lib/gooby/MarkdownMessage.svelte';
  import sampleRaw from '$lib/gooby/__fixtures__/sample-response.md?raw';

  let chunkSize = $state(8);
  let intervalMs = $state(30);
  let streamedContent = $state('');
  let streaming = $state(false);
  let mode = $state<'final' | 'replay'>('final');
  let replayTimer: ReturnType<typeof setInterval> | null = null;

  function stopReplay() {
    if (replayTimer) {
      clearInterval(replayTimer);
      replayTimer = null;
    }
    streaming = false;
  }

  function replay() {
    stopReplay();
    mode = 'replay';
    streamedContent = '';
    streaming = true;
    let i = 0;
    replayTimer = setInterval(() => {
      const next = sampleRaw.slice(0, i + chunkSize);
      streamedContent = next;
      i += chunkSize;
      if (i >= sampleRaw.length) {
        streamedContent = sampleRaw;
        stopReplay();
      }
    }, intervalMs);
  }

  function showFinal() {
    stopReplay();
    mode = 'final';
    streamedContent = sampleRaw;
    streaming = false;
  }

  $effect(() => {
    showFinal();
    return () => stopReplay();
  });
</script>

<svelte:head>
  <title>Gooby markdown dev harness</title>
</svelte:head>

<main>
  <header>
    <h1>Gooby markdown dev harness</h1>
    <p>Renders the fixture <code>__fixtures__/sample-response.md</code> through the same pipeline as live chat.</p>
  </header>

  <section class="controls">
    <div class="btns">
      <button type="button" class:active={mode === 'final'} onclick={showFinal}>Final render</button>
      <button type="button" class:active={mode === 'replay'} onclick={replay}>Replay stream</button>
      <button type="button" onclick={stopReplay} disabled={!streaming}>Stop</button>
    </div>
    <label>
      Chunk size
      <input type="number" min="1" max="200" bind:value={chunkSize} />
    </label>
    <label>
      Interval (ms)
      <input type="number" min="1" max="2000" bind:value={intervalMs} />
    </label>
    <p class="status">
      mode: <strong>{mode}</strong>
      · streaming: <strong>{streaming ? 'yes' : 'no'}</strong>
      · chars: <strong>{streamedContent.length}/{sampleRaw.length}</strong>
    </p>
  </section>

  <section class="render">
    <MarkdownMessage content={streamedContent} {streaming} />
  </section>

  <section class="source">
    <h2>Source markdown</h2>
    <pre>{sampleRaw}</pre>
  </section>
</main>

<style>
  main {
    max-width: 56rem;
    margin: 0 auto;
    padding: 1.5rem 1.25rem 3rem;
    display: grid;
    gap: 1.25rem;
  }
  header h1 {
    margin: 0 0 0.25rem;
    font-size: 1.25rem;
  }
  header p {
    margin: 0;
    color: var(--color-ink-500, #777);
    font-size: 0.85rem;
  }
  .controls {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem 1rem;
    align-items: center;
    padding: 0.85rem 1rem;
    border: 1px solid var(--color-paper-300, #ddd);
    border-radius: 0.6rem;
    background: var(--color-paper-100, #fafafa);
  }
  .btns {
    display: flex;
    gap: 0.4rem;
  }
  button {
    border: 1px solid var(--color-paper-300, #ddd);
    background: var(--color-paper-50, #fff);
    border-radius: 0.4rem;
    padding: 0.35rem 0.7rem;
    font-size: 0.82rem;
    cursor: pointer;
  }
  button.active {
    background: var(--color-warm-500, #d97706);
    color: #fff;
    border-color: transparent;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  label {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    font-size: 0.8rem;
  }
  input[type='number'] {
    width: 5rem;
    padding: 0.25rem 0.4rem;
    border: 1px solid var(--color-paper-300, #ddd);
    border-radius: 0.3rem;
  }
  .status {
    margin: 0;
    font-size: 0.78rem;
    color: var(--color-ink-500, #666);
    flex-basis: 100%;
  }
  .render {
    padding: 1rem 1.1rem;
    border: 1px solid var(--color-paper-300, #ddd);
    border-radius: 0.6rem;
    background: var(--color-paper-50, #fff);
    min-height: 12rem;
  }
  .source h2 {
    margin: 0 0 0.35rem;
    font-size: 0.85rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-500, #777);
  }
  .source pre {
    margin: 0;
    padding: 0.85rem 1rem;
    background: var(--color-paper-100, #fafafa);
    border: 1px solid var(--color-paper-300, #ddd);
    border-radius: 0.5rem;
    font-size: 0.78rem;
    line-height: 1.45;
    overflow-x: auto;
    white-space: pre;
  }
</style>
