<script lang="ts">
  import { onMount, tick } from 'svelte';
  import MessageBubble from './MessageBubble.svelte';
  import EmptyState from './EmptyState.svelte';
  import ScrollToBottom from './ScrollToBottom.svelte';
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
  }

  let { chat }: Props = $props();

  let scrollEl = $state<HTMLDivElement | null>(null);
  let sentinelEl = $state<HTMLDivElement | null>(null);
  let atBottom = $state(true);

  function scrollToBottom(immediate = false) {
    if (!scrollEl) return;
    if (immediate) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    } else {
      scrollEl.scrollTo({ top: scrollEl.scrollHeight, behavior: 'smooth' });
    }
  }

  async function jumpToBottom() {
    await tick();
    if (!scrollEl) return;
    scrollEl.scrollTop = scrollEl.scrollHeight;
  }

  function onUserScroll() {
    if (!scrollEl) return;
    const distFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    if (distFromBottom > 48) atBottom = false;
    else if (distFromBottom < 4) atBottom = true;
  }

  onMount(() => {
    chat.setScrollHandler(async () => {
      await tick();
      if (atBottom) scrollToBottom(chat.sending);
    });
    jumpToBottom();

    scrollEl?.addEventListener('scroll', onUserScroll, { passive: true });

    let observer: IntersectionObserver | null = null;
    if (sentinelEl) {
      observer = new IntersectionObserver(
        (entries) => {
          atBottom = entries[0].isIntersecting;
        },
        { root: scrollEl, threshold: 0.01 }
      );
      observer.observe(sentinelEl);
    }

    return () => {
      observer?.disconnect();
      scrollEl?.removeEventListener('scroll', onUserScroll);
      chat.setScrollHandler(null);
    };
  });

  $effect(() => {
    chat.selectedId;
    jumpToBottom();
  });

  function onPickPrompt(prompt: string) {
    chat.sendMessage(prompt);
  }
</script>

<div class="wrap">
  <div bind:this={scrollEl} class="scroll" aria-live="polite">
    {#if chat.loadingMessages}
      <p class="loading">Loading conversation…</p>
    {:else if chat.messages.length === 0}
      <EmptyState onPick={onPickPrompt} />
    {:else}
      <div class="thread">
        {#each chat.messages as message (message.id)}
          <MessageBubble
            {message}
            streaming={chat.sending}
            modelLabel={message.role === 'assistant' ? chat.shortLabel(message.model) : undefined}
          />
        {/each}
      </div>
    {/if}
    <div bind:this={sentinelEl} class="sentinel" aria-hidden="true"></div>
  </div>

  <ScrollToBottom visible={!atBottom && chat.messages.length > 0} onClick={scrollToBottom} />
</div>

<style>
  .wrap {
    position: relative;
    min-height: 0;
    height: 100%;
  }

  .scroll {
    height: 100%;
    overflow-y: auto;
    padding: 1rem clamp(0.6rem, 3vw, 1.2rem) 1.25rem;
  }

  .thread {
    display: grid;
    gap: 1.1rem;
    width: min(100%, 48rem);
    margin: 0 auto;
  }

  .loading {
    text-align: center;
    color: var(--color-ink-500);
    margin-top: 2rem;
    font-size: 0.9rem;
  }

  .sentinel {
    height: 1px;
  }
</style>
