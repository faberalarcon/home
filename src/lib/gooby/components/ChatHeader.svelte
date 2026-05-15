<script lang="ts">
  import ModelPicker from './ModelPicker.svelte';
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
    onOpenDrawer: () => void;
  }

  let { chat, onOpenDrawer }: Props = $props();

  async function startNewChat() {
    await chat.newConversation();
  }
</script>

<header class="head">
  <button class="ham" type="button" aria-label="Open conversations" onclick={onOpenDrawer}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>

  <h1 class="title">GoobyGPT</h1>

  <div class="right">
    <button class="icon" type="button" aria-label="New chat" onclick={startNewChat}>
      <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
        <path
          d="M16 4l4 4-9.5 9.5L6 19l1.5-4.5L16 4z"
          fill="none"
          stroke="currentColor"
          stroke-width="1.8"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </button>
    <ModelPicker {chat} />
  </div>
</header>

<style>
  .head {
    display: grid;
    grid-template-columns: auto 1fr auto;
    align-items: center;
    gap: 0.5rem;
    padding: 0.55rem 0.7rem;
    border-bottom: 1px solid var(--color-paper-300);
    background: var(--color-paper-50);
  }

  .ham, .icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    border-radius: 999px;
    background: transparent;
    color: var(--color-ink-700);
    cursor: pointer;
    transition: background 120ms ease;
  }

  .ham:hover, .icon:hover { background: var(--color-paper-100); }

  .title {
    margin: 0;
    min-width: 0;
    color: var(--color-ink-900);
    font-weight: 750;
    font-size: 0.98rem;
    text-align: center;
    padding: 0.35rem 0.4rem;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .right {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  @media (min-width: 900px) {
    .ham { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ham, .icon { transition: none; }
  }
</style>
