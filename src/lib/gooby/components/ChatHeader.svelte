<script lang="ts">
  import ModelPicker from './ModelPicker.svelte';
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
    onOpenDrawer: () => void;
  }

  let { chat, onOpenDrawer }: Props = $props();

  async function rename() {
    const conversation = chat.selectedConversation;
    if (!conversation) return;
    const next = window.prompt('Conversation title', conversation.title);
    if (!next) return;
    await chat.renameConversation(conversation.id, next);
  }

  async function remove() {
    const conversation = chat.selectedConversation;
    if (!conversation) return;
    if (!window.confirm(`Delete "${conversation.title}"?`)) return;
    await chat.deleteConversation(conversation.id);
  }

  async function startNewChat() {
    await chat.newConversation();
  }

  const title = $derived(chat.selectedConversation?.title ?? 'GoobyGPT');
</script>

<header class="head">
  <button class="ham" type="button" aria-label="Open conversations" onclick={onOpenDrawer}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
  </button>

  <button class="title" type="button" onclick={rename} title="Rename conversation">
    <span>{title}</span>
  </button>

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
    {#if chat.selectedConversation}
      <button class="icon" type="button" aria-label="Delete conversation" onclick={remove}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M5 7h14M10 7V5h4v2m-7 0v12a2 2 0 002 2h6a2 2 0 002-2V7" stroke="currentColor" stroke-width="1.8" fill="none" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </button>
    {/if}
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
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--color-ink-900);
    font-weight: 750;
    font-size: 0.98rem;
    text-align: center;
    padding: 0.35rem 0.4rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .title span {
    display: inline-block;
    max-width: 100%;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .title:hover { background: var(--color-paper-100); }

  .right {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  @media (min-width: 900px) {
    .ham { display: none; }
  }

  @media (prefers-reduced-motion: reduce) {
    .ham, .icon, .title { transition: none; }
  }
</style>
