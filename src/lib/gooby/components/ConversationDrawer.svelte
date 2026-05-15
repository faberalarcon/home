<script lang="ts">
  import { groupConversations } from '../groupConversations';
  import type { GoobyChat, GoobyConversation } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
    open: boolean;
    onClose: () => void;
  }

  let { chat, open, onClose }: Props = $props();

  const groups = $derived(groupConversations(chat.conversations));

  async function openConversation(id: string) {
    await chat.openConversation(id);
    onClose();
  }

  async function startNewChat() {
    await chat.newConversation();
    onClose();
  }

  async function renameConv(conversation: GoobyConversation, event: MouseEvent) {
    event.stopPropagation();
    const next = window.prompt('Conversation title', conversation.title);
    if (!next) return;
    await chat.renameConversation(conversation.id, next);
  }

  async function deleteConv(conversation: GoobyConversation, event: MouseEvent) {
    event.stopPropagation();
    if (!window.confirm(`Delete "${conversation.title}"?`)) return;
    await chat.deleteConversation(conversation.id);
  }
</script>

{#if open}
  <button class="scrim" type="button" aria-label="Close drawer" onclick={onClose}></button>
{/if}

<aside id="gooby-drawer" class="drawer" class:open aria-label="Conversations" aria-hidden={!open}>
  <div class="drawer-head">
    <button class="new" type="button" onclick={startNewChat}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
        <path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
      <span>New chat</span>
    </button>
    <button class="close" type="button" aria-label="Close" onclick={onClose}>
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
      </svg>
    </button>
  </div>

  <div class="list">
    {#if chat.conversations.length === 0}
      <p class="empty">No conversations yet.</p>
    {:else}
      {#each groups as group (group.key)}
        <section class="group">
          <h3>{group.label}</h3>
          {#each group.items as conversation (conversation.id)}
            <div class="row" class:active={conversation.id === chat.selectedId}>
              <button
                type="button"
                class="open"
                onclick={() => openConversation(conversation.id)}
              >
                <span class="title">{conversation.title}</span>
              </button>
              <div class="actions">
                <button
                  type="button"
                  class="row-action"
                  aria-label="Rename conversation"
                  title="Rename"
                  onclick={(event) => renameConv(conversation, event)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M4 20h4l10-10-4-4L4 16v4zM14 6l4 4"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
                <button
                  type="button"
                  class="row-action"
                  aria-label="Delete conversation"
                  title="Delete"
                  onclick={(event) => deleteConv(conversation, event)}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M5 7h14M10 7V5h4v2m-7 0v12a2 2 0 002 2h6a2 2 0 002-2V7"
                      fill="none"
                      stroke="currentColor"
                      stroke-width="1.8"
                      stroke-linecap="round"
                      stroke-linejoin="round"
                    />
                  </svg>
                </button>
              </div>
            </div>
          {/each}
        </section>
      {/each}
    {/if}
  </div>

  <div class="drawer-foot">
    <form method="POST" action="/gooby/login?/logout">
      <button class="logout" type="submit">Log out</button>
    </form>
  </div>
</aside>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    background: rgba(15, 23, 42, 0.42);
    cursor: pointer;
    animation: fade-in 160ms ease;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  .drawer {
    position: fixed;
    z-index: 70;
    top: 0;
    bottom: 0;
    left: 0;
    width: min(86vw, 320px);
    display: grid;
    grid-template-rows: auto minmax(0, 1fr) auto;
    background: var(--color-paper-100);
    box-shadow: 0 12px 32px rgb(0 0 0 / 0.18);
    transform: translateX(-105%);
    transition: transform 200ms ease;
  }

  .drawer.open {
    transform: translateX(0);
  }

  .drawer-head {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.85rem 0.7rem;
    border-bottom: 1px solid var(--color-paper-300);
  }

  .new {
    flex: 1 1 auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.45rem;
    height: 2.25rem;
    border: 1px solid var(--color-paper-300);
    border-radius: 0.8rem;
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    font-size: 0.88rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .new:hover { background: var(--color-paper-200); }

  .close {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2.25rem;
    height: 2.25rem;
    border: 0;
    background: transparent;
    color: var(--color-ink-700);
    border-radius: 999px;
    cursor: pointer;
  }

  .close:hover { background: var(--color-paper-200); }

  .list {
    overflow: hidden;
    padding: 0.45rem 0.45rem 0.85rem;
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.2rem;
    align-content: start;
    min-width: 0;
  }

  .empty {
    margin: 1.5rem 0.75rem;
    color: var(--color-ink-500);
    font-size: 0.88rem;
  }

  .group {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 0.25rem;
    min-width: 0;
  }

  .group h3 {
    margin: 0.35rem 0.5rem 0.2rem;
    color: var(--color-ink-500);
    font-size: 0.66rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }

  .row {
    position: relative;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: stretch;
    min-width: 0;
    border: 1px solid var(--color-paper-300);
    background: var(--color-paper-50);
    border-radius: 0.6rem;
    overflow: hidden;
    transition: background 120ms ease, border-color 120ms ease;
  }

  .row:hover {
    background: var(--color-paper-200);
    border-color: color-mix(in oklab, var(--color-paper-300) 60%, var(--color-ink-500));
  }

  .row.active {
    background: color-mix(in oklab, var(--color-sage-100) 70%, var(--color-paper-200));
    border-color: color-mix(in oklab, var(--color-sage-300) 80%, var(--color-paper-300));
  }

  .row .open {
    min-width: 0;
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--color-ink-900);
    padding: 0.45rem 0.3rem 0.45rem 0.7rem;
    font-size: 0.88rem;
    font-weight: 500;
    line-height: 1.25;
    cursor: pointer;
  }

  .title {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .actions {
    display: inline-flex;
    align-items: center;
    gap: 0.1rem;
    padding-right: 0.25rem;
    opacity: 0;
    transition: opacity 120ms ease;
  }

  .row:hover .actions,
  .row:focus-within .actions,
  .row.active .actions {
    opacity: 1;
  }

  .row-action {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.7rem;
    height: 1.7rem;
    border: 0;
    background: transparent;
    color: var(--color-ink-500);
    border-radius: 999px;
    cursor: pointer;
    transition: background 120ms ease, color 120ms ease;
  }

  .row-action:hover {
    background: var(--color-paper-100);
    color: var(--color-ink-900);
  }

  @media (hover: none) {
    .actions { opacity: 1; }
  }

  .drawer-foot {
    border-top: 1px solid var(--color-paper-300);
    padding: 0.7rem;
  }

  .logout {
    width: 100%;
    border: 1px solid var(--color-paper-300);
    border-radius: 0.7rem;
    background: var(--color-paper-50);
    color: var(--color-ink-700);
    padding: 0.5rem;
    font-size: 0.78rem;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    cursor: pointer;
  }

  .logout:hover { background: var(--color-paper-200); color: var(--color-ink-900); }

  @media (prefers-reduced-motion: reduce) {
    .drawer { transition: none; }
    .scrim { animation: none; }
  }
</style>
