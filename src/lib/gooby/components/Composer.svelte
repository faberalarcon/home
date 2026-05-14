<script lang="ts">
  import { tick } from 'svelte';
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
  }

  let { chat }: Props = $props();

  let textareaEl = $state<HTMLTextAreaElement | null>(null);

  async function autosize() {
    await tick();
    if (!textareaEl) return;
    const max = 192;
    textareaEl.style.height = 'auto';
    const next = Math.min(textareaEl.scrollHeight, max);
    textareaEl.style.height = `${next}px`;
    textareaEl.style.overflowY = textareaEl.scrollHeight > max ? 'auto' : 'hidden';
  }

  $effect(() => {
    chat.prompt;
    autosize();
  });

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      if (chat.canSend) chat.sendMessage();
    }
  }

  function onSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (chat.sending) {
      chat.stop();
      return;
    }
    if (chat.canSend) chat.sendMessage();
  }
</script>

<form class="composer" onsubmit={onSubmit} id="gooby-composer">
  <div class="pill" data-state={chat.sending ? 'sending' : 'idle'}>
    <textarea
      bind:this={textareaEl}
      bind:value={chat.prompt}
      rows="1"
      placeholder="Message GoobyGPT"
      disabled={!chat.selectedModel}
      oninput={autosize}
      onkeydown={onKey}
      aria-label="Message GoobyGPT"
    ></textarea>

    {#if chat.sending}
      <button class="action stop" type="submit" aria-label="Stop generating">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" />
        </svg>
      </button>
    {:else}
      <button class="action send" type="submit" disabled={!chat.canSend} aria-label="Send message">
        <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
          <path
            d="M5 12l14-7-4 7 4 7-14-7z"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linejoin="round"
          />
        </svg>
      </button>
    {/if}
  </div>
  <p class="hint" aria-hidden="true">Enter to send · Shift+Enter for newline</p>
</form>

<style>
  .composer {
    display: grid;
    gap: 0.3rem;
    padding: 0.4rem clamp(0.7rem, 3vw, 1.1rem) max(0.5rem, env(safe-area-inset-bottom));
    background: color-mix(in oklab, var(--color-paper-50) 88%, var(--color-paper-100));
    border-top: 1px solid var(--color-paper-300);
  }

  .pill {
    position: relative;
    display: flex;
    align-items: flex-end;
    gap: 0.4rem;
    width: min(100%, 48rem);
    margin: 0 auto;
    padding: 0.3rem 0.5rem 0.3rem 1rem;
    border: 1px solid var(--color-paper-300);
    border-radius: 1.5rem;
    background: var(--color-paper-50);
    box-shadow: 0 1px 0 rgb(0 0 0 / 0.02);
    transition: border-color 140ms ease, box-shadow 140ms ease;
  }

  .pill:focus-within {
    border-color: color-mix(in oklab, var(--color-blood-500) 45%, var(--color-paper-300));
    box-shadow: 0 0 0 3px color-mix(in oklab, var(--color-blood-500) 14%, transparent);
  }

  textarea {
    flex: 1 1 auto;
    box-sizing: border-box;
    min-height: 1.4rem;
    max-height: 12rem;
    resize: none;
    border: 0;
    background: transparent;
    color: var(--color-ink-900);
    padding: 0.2rem 0.1rem;
    font: inherit;
    font-size: 0.98rem;
    line-height: 1.4;
    overflow-y: hidden;
  }

  textarea:focus {
    outline: 0;
  }

  textarea:disabled {
    opacity: 0.56;
  }

  .action {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.85rem;
    height: 1.85rem;
    border: 0;
    border-radius: 999px;
    cursor: pointer;
    transition: background 140ms ease, opacity 140ms ease;
  }

  .send {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }

  .send:hover:not(:disabled) {
    background: color-mix(in oklab, var(--color-ink-900) 85%, var(--color-blood-600));
  }

  .send:disabled {
    cursor: not-allowed;
    opacity: 0.35;
  }

  .stop {
    background: var(--color-danger-bg);
    color: var(--color-danger-text);
  }

  .stop:hover {
    background: color-mix(in oklab, var(--color-danger-bg) 70%, var(--color-danger-text));
    color: var(--color-paper-50);
  }

  .hint {
    margin: 0;
    text-align: center;
    color: var(--color-ink-500);
    font-size: 0.66rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (max-width: 640px) {
    .hint { display: none; }
    .composer { padding: 0.5rem 0.55rem max(0.55rem, env(safe-area-inset-bottom)); }
  }

  @media (prefers-reduced-motion: reduce) {
    .pill, .action { transition: none; }
  }
</style>
