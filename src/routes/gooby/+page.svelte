<script lang="ts">
  import { onMount, tick } from 'svelte';
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import MarkdownMessage from '$lib/gooby/MarkdownMessage.svelte';
  import type { PageData } from './$types';

  type Conversation = PageData['conversations'][number];
  type LlamaModel = PageData['llama']['models'][number];

  type ChatMessage = {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    model: string | null;
    createdAt: number;
  };

  let { data }: { data: PageData } = $props();

  function initialPageState(pageData: PageData) {
    const initialConversations = structuredClone(pageData.conversations);
    const initialModels = structuredClone(pageData.llama.models);
    return {
      conversations: initialConversations,
      models: initialModels,
      selectedId: initialConversations[0]?.id ?? null,
      selectedModel: pageData.llama.defaultModel ?? initialModels[0]?.id ?? '',
      error: pageData.llama.error
    };
  }

  // svelte-ignore state_referenced_locally
  const initial = initialPageState(data);

  let conversations = $state<Conversation[]>(initial.conversations);
  let models = $state<LlamaModel[]>(initial.models);
  let selectedId = $state<string | null>(initial.selectedId);
  let selectedModel = $state<string>(initial.selectedModel);
  let messages = $state<ChatMessage[]>([]);
  let prompt = $state('');
  let drawerOpen = $state(false);
  let modelMenuOpen = $state(false);
  let loadingMessages = $state(false);
  let sending = $state(false);
  let error = $state<string | null>(initial.error);
  let messagesEl: HTMLDivElement;

  const selectedConversation = $derived(conversations.find((conversation) => conversation.id === selectedId) ?? null);
  const loadedCount = $derived(models.filter((model) => model.status === 'loaded').length);
  const loadedModel = $derived(models.find((model) => model.status === 'loaded') ?? null);
  const selectedModelInfo = $derived(models.find((model) => model.id === selectedModel) ?? null);
  const canSend = $derived(Boolean(prompt.trim() && selectedModel && !sending));

  function formatDate(ms: number): string {
    try {
      return new Date(ms).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return 'recently';
    }
  }

  function modelDisplayLabel(model: LlamaModel): string {
    return model.displayLabel ?? model.id;
  }

  function modelShortLabel(modelId: string | null): string {
    if (!modelId) return '';
    return models.find((model) => model.id === modelId)?.shortLabel ?? modelId;
  }

  function modelStatus(model: LlamaModel): string {
    if (model.status === 'loaded') return 'Loaded';
    if (model.status === 'loading') return 'Loading';
    return model.default ? 'Default' : 'Available';
  }

  function chooseModel(modelId: string) {
    if (sending) return;
    selectedModel = modelId;
    modelMenuOpen = false;
  }

  function scrollMessages() {
    tick().then(() => {
      if (messagesEl) messagesEl.scrollTop = messagesEl.scrollHeight;
    });
  }

  async function refreshModels() {
    const res = await fetch('/gooby/api/models');
    const payload = await res.json();
    const nextModels = payload.models ?? [];
    models = nextModels;
    const available = new Set(nextModels.map((model: LlamaModel) => model.id));
    if (!selectedModel || !available.has(selectedModel)) {
      selectedModel = payload.defaultModel ?? nextModels[0]?.id ?? '';
    }
    error = payload.error ?? null;
  }

  async function refreshConversations() {
    const res = await fetch('/gooby/api/conversations');
    const payload = await res.json();
    conversations = payload.conversations ?? [];
  }

  async function loadMessages(id: string | null) {
    if (!id) {
      messages = [];
      return;
    }

    loadingMessages = true;
    error = null;

    try {
      const res = await fetch(`/gooby/api/conversations/${id}/messages`);
      if (!res.ok) throw new Error('Unable to load conversation');
      const payload = await res.json();
      messages = payload.messages ?? [];
      if (payload.conversation?.model && models.some((model) => model.id === payload.conversation.model)) {
        selectedModel = payload.conversation.model;
      } else {
        selectedModel = data.llama.defaultModel ?? models[0]?.id ?? selectedModel;
      }
      scrollMessages();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unable to load conversation';
    } finally {
      loadingMessages = false;
    }
  }

  async function newChat() {
    const res = await fetch('/gooby/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: selectedModel })
    });
    const payload = await res.json();
    if (!res.ok) {
      error = payload.error ?? 'Unable to create conversation';
      return;
    }
    conversations = [payload.conversation, ...conversations];
    selectedId = payload.conversation.id;
    messages = [];
    drawerOpen = false;
  }

  async function selectConversation(id: string) {
    selectedId = id;
    drawerOpen = false;
    await loadMessages(id);
  }

  async function renameSelected() {
    if (!selectedConversation) return;
    const nextTitle = window.prompt('Conversation title', selectedConversation.title);
    if (!nextTitle) return;

    const res = await fetch(`/gooby/api/conversations/${selectedConversation.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: nextTitle })
    });
    const payload = await res.json();
    if (!res.ok) {
      error = payload.error ?? 'Unable to rename conversation';
      return;
    }
    conversations = conversations.map((conversation) =>
      conversation.id === payload.conversation.id ? payload.conversation : conversation
    );
  }

  async function deleteSelected() {
    if (!selectedConversation) return;
    if (!window.confirm(`Delete "${selectedConversation.title}"?`)) return;

    const id = selectedConversation.id;
    await fetch(`/gooby/api/conversations/${id}`, { method: 'DELETE' });
    conversations = conversations.filter((conversation) => conversation.id !== id);
    selectedId = conversations[0]?.id ?? null;
    await loadMessages(selectedId);
  }

  function consumeSseChunk(buffer: string): { content: string; remaining: string; error: string | null } {
    let content = '';
    let streamError: string | null = null;
    const events = buffer.split('\n\n');
    const remaining = events.pop() ?? '';

    for (const event of events) {
      const dataLines = event
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim());

      for (const dataLine of dataLines) {
        if (!dataLine || dataLine === '[DONE]') continue;
        try {
          const payload = JSON.parse(dataLine);
          const delta = payload.choices?.[0]?.delta;
          if (typeof delta?.content === 'string') content += delta.content;
          if (typeof payload.error === 'string') streamError = payload.error;
          if (typeof payload.error?.message === 'string') streamError = payload.error.message;
        } catch {
          // Ignore malformed data events from upstream.
        }
      }
    }

    return { content, remaining, error: streamError };
  }

  async function sendPrompt() {
    const text = prompt.trim();
    if (!text || !selectedModel || sending) return;

    sending = true;
    error = null;
    prompt = '';

    const userMessage: ChatMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      model: selectedModel,
      createdAt: Date.now()
    };
    const assistantMessage: ChatMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      model: selectedModel,
      createdAt: Date.now()
    };
    messages = [...messages, userMessage, assistantMessage];
    scrollMessages();

    try {
      const res = await fetch('/gooby/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: selectedId,
          model: selectedModel,
          prompt: text
        })
      });

      const conversationId = res.headers.get('x-conversation-id');
      if (conversationId) selectedId = conversationId;

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let parseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parseBuffer += decoder.decode(value, { stream: true });
        const parsed = consumeSseChunk(parseBuffer);
        parseBuffer = parsed.remaining;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.content) {
          assistantMessage.content += parsed.content;
          messages = messages.map((message) =>
            message.id === assistantMessage.id ? { ...assistantMessage } : message
          );
          scrollMessages();
        }
      }

      if (!assistantMessage.content.trim()) {
        assistantMessage.content = 'No response returned.';
        messages = messages.map((message) =>
          message.id === assistantMessage.id ? { ...assistantMessage } : message
        );
      }

      await refreshConversations();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Chat request failed';
      assistantMessage.content = `Request failed: ${error}`;
      messages = messages.map((message) =>
        message.id === assistantMessage.id ? { ...assistantMessage } : message
      );
    } finally {
      sending = false;
      await refreshModels().catch(() => {});
    }
  }

  function submitPrompt(event: SubmitEvent) {
    event.preventDefault();
    sendPrompt();
  }

  function handleWindowKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      drawerOpen = false;
      modelMenuOpen = false;
    }
  }

  onMount(() => {
    loadMessages(selectedId);
  });
</script>

<svelte:window onkeydown={handleWindowKeydown} />

<svelte:head>
  <title>GoobyGPT - 21 Bristoe</title>
  <meta name="description" content="Private 21 Bristoe chat wrapper for local llama.cpp models" />
</svelte:head>

<a href="#gooby-composer" class="skip-to-content">Skip to composer</a>

<header class="app-header">
  <div class="app-header__inner">
    <div class="app-header__top">
      <SiteBrand site="gooby" href="/gooby/" />
      <SiteNav current="gooby" />
    </div>
  </div>
</header>

<main class:gooby-shell--drawer-open={drawerOpen} class="gooby-shell">
  {#if drawerOpen}
    <button
      class="gooby-drawer-backdrop"
      type="button"
      aria-label="Close GoobyGPT chat drawer"
      onclick={() => (drawerOpen = false)}
    ></button>
  {/if}

  <aside id="gooby-chat-drawer" class:gooby-sidebar--open={drawerOpen} class="gooby-sidebar" aria-label="GoobyGPT conversations">
    <div class="gooby-sidebar__top">
      <button class="gooby-command" type="button" onclick={newChat}>New chat</button>
      <form method="POST" action="/gooby/login?/logout">
        <button class="gooby-command gooby-command--quiet" type="submit">Log out</button>
      </form>
    </div>

    <div class="gooby-conversations">
      {#if conversations.length === 0}
        <p class="gooby-empty">No saved conversations yet.</p>
      {:else}
        {#each conversations as conversation (conversation.id)}
          <button
            type="button"
            class:gooby-conversation--active={conversation.id === selectedId}
            class="gooby-conversation"
            onclick={() => selectConversation(conversation.id)}
          >
            <span>{conversation.title}</span>
            <em>{formatDate(conversation.updatedAt)}</em>
          </button>
        {/each}
      {/if}
    </div>

  </aside>

  <section class="gooby-main" aria-label="GoobyGPT chat">
    <div class="gooby-toolbar">
      <div class="gooby-toolbar__title">
        <button
          id="gooby-sidebar-button"
          class="gooby-sidebar-toggle"
          type="button"
          aria-label="Open GoobyGPT chat drawer"
          aria-expanded={drawerOpen}
          aria-controls="gooby-chat-drawer"
          onclick={() => (drawerOpen = !drawerOpen)}
        >
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
          <span aria-hidden="true"></span>
        </button>
        <div class="gooby-model-picker">
          <button
            class="gooby-model-button"
            type="button"
            aria-haspopup="listbox"
            aria-expanded={modelMenuOpen}
            disabled={sending || models.length === 0}
            onclick={() => (modelMenuOpen = !modelMenuOpen)}
          >
            <span>{selectedModelInfo?.shortLabel ?? 'Model'}</span>
            <span aria-hidden="true">▾</span>
          </button>
          {#if modelMenuOpen}
            <div class="gooby-model-menu" role="listbox" aria-label="GoobyGPT model">
              {#each models as model (model.id)}
                <button
                  type="button"
                  role="option"
                  aria-selected={model.id === selectedModel}
                  class:gooby-model-option--selected={model.id === selectedModel}
                  class="gooby-model-option"
                  onclick={() => chooseModel(model.id)}
                >
                  <span>{modelDisplayLabel(model)}</span>
                  <em>{modelStatus(model)}</em>
                </button>
              {/each}
            </div>
          {/if}
          <p>Switching models can take a moment.</p>
        </div>
      </div>

      <div class="gooby-toolbar__status">
        <StatusPill status={error ? 'attention' : loadedCount > 0 ? 'ok' : 'watch'} label={error ? 'Offline' : loadedModel ? `${loadedModel.shortLabel ?? loadedModel.id} ready` : 'Loading on first use'} />
        {#if selectedConversation}
          <button type="button" onclick={renameSelected}>Rename</button>
          <button type="button" onclick={deleteSelected}>Delete</button>
        {/if}
      </div>
    </div>

    {#if error}
      <p class="gooby-alert" role="alert">{error}</p>
    {/if}

    <div class="gooby-messages" bind:this={messagesEl} aria-live="polite">
      {#if loadingMessages}
        <p class="gooby-empty">Loading conversation...</p>
      {:else if messages.length === 0}
        <div class="gooby-welcome reveal">
          <p class="gooby-kicker">Private chat</p>
          <h2>Welcome to GoobyGPT.</h2>
          <p>Ask about the house, Limón, plans, code, or anything that needs a local second brain.</p>
        </div>
      {:else}
        {#each messages as message (message.id)}
          <article class="gooby-message" data-role={message.role}>
            <div class="gooby-message__meta">
              <span>{message.role === 'user' ? 'You' : 'GoobyGPT'}</span>
              {#if message.model}<em>{modelShortLabel(message.model)}</em>{/if}
            </div>
            {#if message.role === 'assistant'}
              <MarkdownMessage content={message.content || (sending ? 'Thinking...' : '')} />
            {:else}
              <p>{message.content}</p>
            {/if}
          </article>
        {/each}
      {/if}
    </div>

    <form id="gooby-composer" class="gooby-composer" onsubmit={submitPrompt}>
      <textarea
        bind:value={prompt}
        rows="3"
        placeholder="Message GoobyGPT"
        disabled={sending || !selectedModel}
        onkeydown={(event) => {
          if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) sendPrompt();
        }}
      ></textarea>
      <button type="submit" disabled={!canSend}>{sending ? 'Sending' : 'Send'}</button>
    </form>
  </section>
</main>

<SiteFooter visitorCount={data.visitorCount} />

<style>
  :global(body) {
    background: var(--color-paper-50);
  }

  .gooby-shell {
    display: grid;
    grid-template-columns: minmax(15rem, 19rem) minmax(0, 1fr);
    gap: 1rem;
    width: min(100%, var(--measure-full));
    min-height: calc(100svh - var(--stats-app-header-height, 4.5rem));
    margin: 0 auto;
    padding: calc(var(--stats-app-header-height, 4.5rem) + 1rem) clamp(0.875rem, 2vw, 1.5rem) 1.25rem;
  }

  .gooby-drawer-backdrop {
    display: none;
  }

  .gooby-sidebar,
  .gooby-main {
    min-width: 0;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: color-mix(in oklab, var(--color-paper-100) 92%, var(--color-paper-50));
    box-shadow: 0 1rem 2.5rem -2.25rem color-mix(in oklab, var(--color-ink-900) 45%, transparent);
  }

  .gooby-sidebar {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    max-height: calc(100svh - var(--stats-app-header-height, 4.5rem) - 2.25rem);
  }

  .gooby-sidebar__top {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 0.5rem;
    padding: 0.75rem;
    border-bottom: 1px solid var(--color-paper-300);
  }

  .gooby-command,
  .gooby-toolbar__status button,
  .gooby-composer button {
    min-height: 2.5rem;
    border: 1px solid color-mix(in oklab, var(--color-blood-500) 36%, var(--color-paper-300));
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-blood-500);
    color: var(--color-paper-50);
    cursor: pointer;
    font-size: 0.72rem;
    font-weight: 850;
    letter-spacing: 0.1em;
    line-height: 1;
    padding: 0.65rem 0.8rem;
    text-transform: uppercase;
    transition: background 150ms ease, border-color 150ms ease, transform 150ms ease;
  }

  .gooby-command:hover,
  .gooby-toolbar__status button:hover,
  .gooby-composer button:hover:not(:disabled) {
    background: var(--color-blood-600);
    transform: translateY(-1px);
  }

  .gooby-command--quiet,
  .gooby-toolbar__status button {
    background: var(--color-paper-50);
    color: var(--color-ink-700);
    border-color: var(--color-paper-300);
  }

  .gooby-command--quiet:hover,
  .gooby-toolbar__status button:hover {
    background: var(--color-paper-200);
    color: var(--color-ink-900);
  }

  .gooby-conversations {
    display: grid;
    gap: 0.3rem;
    padding: 0.55rem;
    overflow-y: auto;
    min-height: 0;
  }

  .gooby-conversation {
    display: grid;
    gap: 0.28rem;
    width: 100%;
    min-height: 4rem;
    border: 1px solid transparent;
    border-radius: var(--radius-sm, 0.5rem);
    background: transparent;
    color: inherit;
    cursor: pointer;
    padding: 0.75rem;
    text-align: left;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .gooby-conversation:hover,
  .gooby-conversation--active {
    border-color: var(--color-paper-300);
    background: var(--color-paper-50);
  }

  .gooby-conversation span {
    color: var(--color-ink-900);
    font-size: 0.88rem;
    font-weight: 760;
    line-height: 1.25;
    overflow-wrap: anywhere;
  }

  .gooby-conversation em,
  .gooby-message__meta,
  .gooby-kicker {
    color: var(--color-ink-500);
    font-size: 0.68rem;
    font-style: normal;
    font-weight: 820;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .gooby-main {
    display: grid;
    grid-template-rows: auto auto minmax(0, 1fr) auto;
    overflow: hidden;
    max-height: calc(100svh - var(--stats-app-header-height, 4.5rem) - 2.25rem);
  }

  .gooby-toolbar,
  .gooby-composer {
    border-bottom: 1px solid var(--color-paper-300);
    padding: clamp(0.85rem, 2vw, 1rem);
  }

  .gooby-toolbar {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
  }

  .gooby-toolbar__title {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    min-width: 0;
  }

  .gooby-sidebar-toggle {
    display: none;
    width: 2.5rem;
    height: 2.5rem;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    gap: 0.27rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    cursor: pointer;
  }

  .gooby-sidebar-toggle span {
    display: block;
    width: 1.05rem;
    height: 2px;
    border-radius: 999px;
    background: currentColor;
  }

  .gooby-model-picker {
    position: relative;
    display: grid;
    gap: 0.28rem;
    min-width: min(17rem, 64vw);
  }

  .gooby-model-button {
    display: inline-flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.45rem;
    width: fit-content;
    min-width: 8rem;
    min-height: 2.5rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    cursor: pointer;
    font: inherit;
    font-size: 0.95rem;
    font-weight: 760;
    line-height: 1;
    padding: 0.62rem 0.75rem;
    transition: background 140ms ease, border-color 140ms ease;
  }

  .gooby-model-button:hover:not(:disabled),
  .gooby-model-button[aria-expanded="true"] {
    border-color: color-mix(in oklab, var(--color-ink-900) 22%, var(--color-paper-300));
    background: var(--color-paper-100);
  }

  .gooby-model-button:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  .gooby-model-picker p {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.78rem;
    line-height: 1.35;
  }

  .gooby-model-menu {
    position: absolute;
    top: calc(100% + 0.35rem);
    left: 0;
    z-index: 50;
    display: grid;
    width: min(20rem, calc(100vw - 2rem));
    gap: 0.18rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    box-shadow: 0 1rem 2.5rem -1.5rem color-mix(in oklab, var(--color-ink-900) 38%, transparent);
    padding: 0.35rem;
  }

  .gooby-model-option {
    display: grid;
    gap: 0.2rem;
    width: 100%;
    border: 0;
    border-radius: calc(var(--radius-sm, 0.5rem) - 0.15rem);
    background: transparent;
    color: var(--color-ink-900);
    cursor: pointer;
    padding: 0.7rem 0.75rem;
    text-align: left;
  }

  .gooby-model-option:hover,
  .gooby-model-option--selected {
    background: var(--color-paper-200);
  }

  .gooby-model-option span {
    font-size: 0.9rem;
    font-weight: 780;
  }

  .gooby-model-option em {
    color: var(--color-ink-500);
    font-size: 0.72rem;
    font-style: normal;
  }

  .gooby-toolbar__status {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .gooby-toolbar__status button {
    min-height: 2rem;
    padding: 0.5rem 0.62rem;
    font-size: 0.64rem;
  }

  .gooby-empty,
  .gooby-alert,
  .gooby-welcome p {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.86rem;
    line-height: 1.45;
  }

  .gooby-alert {
    border-bottom: 1px solid color-mix(in oklab, var(--color-status-error) 28%, var(--color-paper-300));
    background: color-mix(in oklab, var(--color-status-error) 7%, var(--color-paper-50));
    color: var(--color-status-error);
    font-weight: 760;
    padding: 0.8rem 1rem;
  }

  .gooby-messages {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    min-height: 0;
    overflow-y: auto;
    padding: clamp(1rem, 2vw, 1.25rem);
  }

  .gooby-welcome {
    align-self: center;
    width: min(100%, 38rem);
    margin: auto 0;
    text-align: center;
  }

  .gooby-welcome h2 {
    margin: 0.35rem 0 0.75rem;
    font-size: clamp(2rem, 5vw, 4rem);
  }

  .gooby-message {
    width: min(100%, 52rem);
    padding: 0.95rem 1rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
  }

  .gooby-message[data-role="user"] {
    align-self: flex-end;
    border-color: color-mix(in oklab, var(--color-blood-500) 28%, var(--color-paper-300));
    background: color-mix(in oklab, var(--color-blood-300) 11%, var(--color-paper-50));
  }

  .gooby-message[data-role="assistant"] {
    align-self: flex-start;
  }

  .gooby-message__meta {
    display: flex;
    gap: 0.55rem;
    justify-content: space-between;
    margin-bottom: 0.55rem;
  }

  .gooby-message__meta span {
    color: var(--color-ink-900);
  }

  .gooby-message > p {
    margin: 0;
    color: var(--color-ink-800);
    font-size: 0.96rem;
    line-height: 1.62;
    overflow-wrap: anywhere;
    white-space: pre-wrap;
  }

  :global(.gooby-markdown) {
    color: var(--color-ink-800);
    font-size: 0.96rem;
    line-height: 1.62;
    overflow-wrap: anywhere;
  }

  :global(.gooby-markdown > :first-child) {
    margin-top: 0;
  }

  :global(.gooby-markdown > :last-child) {
    margin-bottom: 0;
  }

  :global(.gooby-markdown p),
  :global(.gooby-markdown ul),
  :global(.gooby-markdown ol),
  :global(.gooby-markdown pre),
  :global(.gooby-markdown blockquote) {
    margin: 0.75rem 0;
  }

  :global(.gooby-markdown ul),
  :global(.gooby-markdown ol) {
    padding-left: 1.25rem;
  }

  :global(.gooby-markdown h1),
  :global(.gooby-markdown h2),
  :global(.gooby-markdown h3) {
    margin: 1rem 0 0.45rem;
    color: var(--color-ink-900);
    font-size: 1rem;
    line-height: 1.3;
  }

  :global(.gooby-markdown code) {
    border-radius: 0.3rem;
    background: var(--color-paper-200);
    color: var(--color-ink-900);
    font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    font-size: 0.88em;
    padding: 0.1rem 0.25rem;
  }

  :global(.gooby-markdown pre) {
    overflow-x: auto;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-ink-900);
    padding: 0.85rem;
  }

  :global(.gooby-markdown pre code) {
    background: transparent;
    color: var(--color-paper-50);
    padding: 0;
  }

  :global(.gooby-markdown a) {
    color: var(--color-blood-600);
    font-weight: 720;
  }

  .gooby-composer {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 0.75rem;
    border-bottom: 0;
    border-top: 1px solid var(--color-paper-300);
  }

  .gooby-composer textarea {
    width: 100%;
    min-height: 4.25rem;
    max-height: 12rem;
    resize: vertical;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    padding: 0.8rem 0.9rem;
    font: inherit;
    line-height: 1.4;
  }

  .gooby-composer button {
    min-width: 6rem;
  }

  .gooby-composer button:disabled,
  .gooby-composer textarea:disabled {
    cursor: not-allowed;
    opacity: 0.56;
  }

  @media (max-width: 900px) {
    .gooby-shell {
      grid-template-columns: 1fr;
    }

    .gooby-drawer-backdrop {
      position: fixed;
      top: var(--stats-app-header-height, 4.5rem);
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 60;
      display: block;
      border: 0;
      background: rgba(15, 23, 42, 0.36);
      cursor: pointer;
    }

    .gooby-sidebar {
      position: fixed;
      top: var(--stats-app-header-height, 4.5rem);
      bottom: 0;
      left: 0;
      z-index: 70;
      width: min(20rem, calc(100vw - 3rem));
      max-height: none;
      border-radius: 0 var(--radius-sm, 0.5rem) 0 0;
      transform: translateX(-105%);
      transition: transform 180ms ease;
    }

    .gooby-sidebar--open {
      transform: translateX(0);
    }

    .gooby-main {
      min-height: 70svh;
      max-height: none;
    }

    .gooby-sidebar-toggle {
      display: inline-flex;
    }
  }

  @media (max-width: 640px) {
    .gooby-shell {
      padding: calc(var(--stats-app-header-height, 4.5rem) + 0.75rem) 0.75rem 1rem;
    }

    .gooby-toolbar__title {
      align-items: center;
    }

    .gooby-toolbar__status {
      justify-content: flex-start;
    }

    .gooby-composer {
      grid-template-columns: 1fr;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .gooby-command,
    .gooby-toolbar__status button,
    .gooby-composer button,
    .gooby-conversation,
    .gooby-sidebar,
    .gooby-sidebar-toggle {
      transition: none;
    }

    .gooby-command:hover,
    .gooby-toolbar__status button:hover,
    .gooby-composer button:hover:not(:disabled) {
      transform: none;
    }
  }
</style>
