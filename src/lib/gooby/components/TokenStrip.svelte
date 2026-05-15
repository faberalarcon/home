<script lang="ts">
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
  }

  let { chat }: Props = $props();

  function fmt(n: number): string {
    return n.toLocaleString();
  }
</script>

<div class="strip" aria-live="polite">
  <span class="model">{chat.selectedModelInfo?.shortLabel ?? '—'}</span>
  <span class="sep" aria-hidden="true">·</span>
  <span class="tokens">
    {fmt(chat.tokensUsed)} / {chat.contextLimit != null ? fmt(chat.contextLimit) : '?'}
    <span class="unit">tokens</span>
  </span>
  <span class="sep" aria-hidden="true">·</span>
  <span class="speed">
    {chat.tokensPerSecondAvg != null ? `${chat.tokensPerSecondAvg.toFixed(1)} tok/s` : '— tok/s'}
  </span>
</div>

<style>
  .strip {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: center;
    gap: 0.4rem;
    padding: 0.25rem 0.7rem 0;
    color: var(--color-ink-500);
    font-size: 0.7rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    font-variant-numeric: tabular-nums;
    background: color-mix(in oklab, var(--color-paper-50) 88%, var(--color-paper-100));
  }

  .sep {
    opacity: 0.6;
  }

  .unit {
    opacity: 0.7;
    margin-left: 0.15rem;
  }
</style>
