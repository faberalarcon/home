<script lang="ts">
  import MarkdownMessage from '../MarkdownMessage.svelte';
  import ThinkingIndicator from './ThinkingIndicator.svelte';
  import type { GoobyMessage } from '../useGoobyChat.svelte';

  interface Props {
    message: GoobyMessage;
    streaming: boolean;
    modelLabel?: string;
  }

  let { message, streaming, modelLabel }: Props = $props();

  const isAssistant = $derived(message.role === 'assistant');
  const hasReasoning = $derived(isAssistant && !!message.reasoning?.trim());
  const contentEmpty = $derived(!message.content.trim());
  const showThinking = $derived(isAssistant && streaming && contentEmpty && !hasReasoning);
  const reasoningStreaming = $derived(streaming && contentEmpty);
</script>

<article class="row" data-role={message.role}>
  {#if isAssistant}
    <span class="avatar" aria-hidden="true">G</span>
  {/if}

  <div class="body">
    {#if isAssistant}
      {#if hasReasoning}
        <details class="gooby-reasoning">
          <summary>Reasoning</summary>
          <div class="gooby-reasoning-body">
            <MarkdownMessage content={message.reasoning ?? ''} streaming={reasoningStreaming} />
          </div>
        </details>
      {/if}
      {#if showThinking}
        <ThinkingIndicator />
      {:else if !contentEmpty}
        <MarkdownMessage content={message.content} {streaming} />
      {/if}
      {#if modelLabel}<p class="meta">{modelLabel}</p>{/if}
    {:else}
      <p class="bubble">{message.content}</p>
    {/if}
  </div>
</article>

<style>
  .row {
    display: grid;
    gap: 0.6rem;
    width: 100%;
  }

  .row[data-role='assistant'] {
    grid-template-columns: 28px minmax(0, 1fr);
    align-items: flex-start;
  }

  .row[data-role='user'] {
    grid-template-columns: minmax(0, 1fr);
  }

  .row[data-role='user'] .body {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }

  .avatar {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: var(--color-warm-400);
    color: var(--color-paper-50);
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.02em;
    margin-top: 0.2rem;
  }

  .body {
    min-width: 0;
    max-width: 100%;
  }

  .bubble {
    margin: 0;
    max-width: min(82%, 36rem);
    width: fit-content;
    padding: 0.65rem 0.95rem;
    border-radius: 1.15rem 1.15rem 0.3rem 1.15rem;
    background: var(--color-sage-100);
    color: var(--color-ink-900);
    font-size: 0.95rem;
    line-height: 1.5;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  .meta {
    margin: 0.35rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.68rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  :global(.gooby-reasoning) {
    margin: 0 0 0.5rem;
    border-left: 2px solid var(--color-paper-300);
    padding-left: 0.7rem;
  }
  :global(.gooby-reasoning > summary) {
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    list-style: none;
    padding: 0.15rem 0;
    user-select: none;
  }
  :global(.gooby-reasoning > summary::-webkit-details-marker) {
    display: none;
  }
  :global(.gooby-reasoning > summary::before) {
    content: '▸ ';
    display: inline-block;
  }
  :global(.gooby-reasoning[open] > summary::before) {
    content: '▾ ';
  }
  :global(.gooby-reasoning-body) {
    margin-top: 0.4rem;
    color: var(--color-ink-700);
    font-size: 0.9em;
  }
</style>
