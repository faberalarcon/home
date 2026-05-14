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
  const showThinking = $derived(isAssistant && streaming && !message.content.trim());
</script>

<article class="row" data-role={message.role}>
  {#if isAssistant}
    <span class="avatar" aria-hidden="true">G</span>
  {/if}

  <div class="body">
    {#if isAssistant}
      {#if showThinking}
        <ThinkingIndicator />
      {:else}
        <MarkdownMessage content={message.content} />
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

</style>
