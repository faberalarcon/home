<script lang="ts">
  import type { LlamaModel } from '../llama';
  import type { GoobyChat } from '../useGoobyChat.svelte';

  interface Props {
    chat: GoobyChat;
  }

  let { chat }: Props = $props();
  let open = $state(false);

  function statusKind(model: LlamaModel | null): 'ok' | 'loading' | 'fail' | 'idle' {
    if (!model) return 'idle';
    if (model.failed) return 'fail';
    if (model.status === 'loaded') return 'ok';
    if (model.status === 'loading') return 'loading';
    return 'idle';
  }

  function statusText(model: LlamaModel | null): string {
    if (!model) return 'idle';
    if (model.failed) return 'failed';
    if (model.status === 'loaded') return 'ready';
    if (model.status === 'loading') return 'loading';
    return 'sleeping';
  }

  function pick(modelId: string) {
    chat.selectModel(modelId);
    open = false;
  }

  function close() {
    open = false;
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape') open = false;
  }
</script>

<svelte:window onkeydown={onKey} />

<div class="picker">
  <button
    class="trigger"
    type="button"
    aria-haspopup="dialog"
    aria-expanded={open}
    disabled={chat.sending || chat.models.length === 0}
    onclick={() => (open = !open)}
  >
    <span class="dot" data-state={statusKind(chat.selectedModelInfo)} aria-hidden="true"></span>
    <span class="label">{chat.selectedModelInfo?.shortLabel ?? 'Model'}</span>
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" />
    </svg>
  </button>
</div>

{#if open}
  <button class="scrim" type="button" aria-label="Close model picker" onclick={close}></button>
  <div class="sheet" role="dialog" aria-label="Choose model">
    <div class="sheet-head">
      <h2>Model</h2>
      <button class="close" type="button" aria-label="Close" onclick={close}>
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <path d="M6 6l12 12M18 6L6 18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
        </svg>
      </button>
    </div>
    <ul class="options">
      {#each chat.models as model (model.id)}
        <li>
          <button
            type="button"
            class:active={model.id === chat.selectedModel}
            onclick={() => pick(model.id)}
          >
            <span class="row">
              <span class="dot" data-state={statusKind(model)} aria-hidden="true"></span>
              <span class="name">{model.displayLabel ?? model.id}</span>
              {#if model.id === chat.selectedModel}
                <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                  <path d="M5 12l5 5L20 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" />
                </svg>
              {/if}
            </span>
            <span class="status">{statusText(model)}</span>
          </button>
        </li>
      {/each}
    </ul>
  </div>
{/if}

<style>
  .picker {
    position: relative;
    display: inline-flex;
    min-width: 0;
  }

  .trigger {
    display: inline-flex;
    align-items: center;
    gap: 0.4rem;
    max-width: 11rem;
    height: 2.1rem;
    padding: 0 0.65rem;
    border: 1px solid var(--color-paper-300);
    border-radius: 999px;
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    font-size: 0.82rem;
    font-weight: 700;
    cursor: pointer;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .trigger:hover:not(:disabled) {
    background: var(--color-paper-100);
    border-color: var(--color-paper-300);
  }

  .trigger:disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  .label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .dot {
    flex: 0 0 auto;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 999px;
    background: var(--color-ink-300);
  }

  .dot[data-state='ok'] { background: var(--color-success-text); }
  .dot[data-state='loading'] {
    background: var(--color-leaf-500);
    animation: blink 1.2s infinite ease-in-out;
  }
  .dot[data-state='fail'] { background: var(--color-danger-text); }

  @keyframes blink {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.45; }
  }

  .scrim {
    position: fixed;
    inset: 0;
    z-index: 80;
    border: 0;
    background: rgba(15, 23, 42, 0.36);
    cursor: pointer;
  }

  .sheet {
    position: fixed;
    z-index: 81;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 30rem);
    max-height: 70vh;
    overflow-y: auto;
    border-radius: 1.1rem 1.1rem 0 0;
    background: var(--color-paper-50);
    box-shadow: 0 -12px 36px rgb(0 0 0 / 0.22);
    padding: 0.85rem 0.85rem max(1rem, env(safe-area-inset-bottom));
    animation: rise 180ms ease;
  }

  @keyframes rise {
    from { transform: translate(-50%, 100%); opacity: 0.4; }
    to   { transform: translate(-50%, 0); opacity: 1; }
  }

  @media (min-width: 720px) {
    .sheet {
      left: auto;
      right: 1rem;
      bottom: auto;
      top: 4.5rem;
      transform: none;
      max-height: 26rem;
      border-radius: 1rem;
      animation: drop 160ms ease;
    }
    @keyframes drop {
      from { transform: translateY(-6px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  }

  .sheet-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0.25rem 0.4rem 0.65rem;
  }

  .sheet-head h2 {
    margin: 0;
    font-size: 1rem;
    font-weight: 800;
    color: var(--color-ink-900);
  }

  .close {
    border: 0;
    background: transparent;
    color: var(--color-ink-700);
    padding: 0.35rem;
    border-radius: 999px;
    cursor: pointer;
  }

  .close:hover {
    background: var(--color-paper-100);
  }

  .options {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.15rem;
  }

  .options button {
    display: grid;
    gap: 0.15rem;
    width: 100%;
    text-align: left;
    border: 0;
    background: transparent;
    color: var(--color-ink-900);
    padding: 0.7rem 0.75rem;
    border-radius: 0.7rem;
    cursor: pointer;
    transition: background 120ms ease;
  }

  .options button:hover {
    background: var(--color-paper-100);
  }

  .options button.active {
    background: color-mix(in oklab, var(--color-sage-100) 65%, var(--color-paper-100));
  }

  .row {
    display: flex;
    align-items: center;
    gap: 0.55rem;
  }

  .name {
    flex: 1 1 auto;
    font-size: 0.95rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .status {
    margin-left: 1.1rem;
    color: var(--color-ink-500);
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  @media (prefers-reduced-motion: reduce) {
    .sheet { animation: none; }
    .dot[data-state='loading'] { animation: none; }
  }
</style>
