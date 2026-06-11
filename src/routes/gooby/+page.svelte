<script lang="ts">
  import { onMount } from 'svelte';
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
  import ChatHeader from '$lib/gooby/components/ChatHeader.svelte';
  import ConversationDrawer from '$lib/gooby/components/ConversationDrawer.svelte';
  import MessageList from '$lib/gooby/components/MessageList.svelte';
  import TokenStrip from '$lib/gooby/components/TokenStrip.svelte';
  import Composer from '$lib/gooby/components/Composer.svelte';
  import { GoobyChat } from '$lib/gooby/useGoobyChat.svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  // svelte-ignore state_referenced_locally
  const chat = new GoobyChat(data);
  let drawerOpen = $state(false);

  onMount(() => {
    chat.loadMessages(chat.selectedId);
    chat.refreshModels().catch(() => {});

    const onVisible = () => {
      if (document.visibilityState === 'visible' && !chat.sending) {
        chat.loadMessages(chat.selectedId);
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  });

  function onWindowKey(event: KeyboardEvent) {
    if (event.key === 'Escape') drawerOpen = false;
  }
</script>

<svelte:window onkeydown={onWindowKey} />

<svelte:head>
  <title>GoobyGPT - 21 Bristoe</title>
  <meta name="description" content="Private 21 Bristoe chat wrapper for local llama.cpp models" />
</svelte:head>

<a href="#gooby-composer" class="skip-to-content">Skip to composer</a>

<header class="app-header">
  <div class="app-header__inner">
    <div class="app-header__top">
      <SiteBrand site="gooby" href="/gooby/" />
      <SiteNav current="gooby" fallbackMenu />
    </div>
  </div>
</header>

<main class="app">
  <ConversationDrawer {chat} open={drawerOpen} onClose={() => (drawerOpen = false)} />

  <section class="frame" aria-label="GoobyGPT chat">
    <ChatHeader {chat} onOpenDrawer={() => (drawerOpen = true)} />

    {#if chat.error}
      <p class="alert" role="alert">
        {chat.error}
        {#if chat.pendingOverrideModel}
          <button type="button" class="alert-action" onclick={() => chat.confirmOverrideModelSwap()}>
            Override
          </button>
          <button type="button" class="alert-action alert-action--ghost" onclick={() => chat.dismissOverridePrompt()}>
            Cancel
          </button>
        {/if}
      </p>
    {/if}

    <MessageList {chat} />
    <TokenStrip {chat} />
    <Composer {chat} />
  </section>
</main>

<style>
  :global(body) {
    background: var(--color-paper-50);
    overflow-x: hidden;
  }

  .app {
    display: flex;
    flex-direction: column;
    width: 100%;
    height: 100dvh;
    min-height: 0;
    box-sizing: border-box;
    padding-top: var(--stats-app-header-height, 4.5rem);
    overflow: hidden;
  }

  .frame {
    display: flex;
    flex-direction: column;
    flex: 1 1 0;
    min-height: 0;
    background: var(--color-paper-50);
  }

  .frame :global(.head),
  .frame :global(.composer),
  .frame :global(.strip),
  .alert {
    flex: 0 0 auto;
  }

  .frame :global(.wrap) {
    flex: 1 1 0;
    min-height: 0;
  }

  .alert {
    margin: 0;
    padding: 0.7rem 1rem;
    background: color-mix(in oklab, var(--color-danger-bg) 75%, var(--color-paper-50));
    color: var(--color-danger-text);
    font-size: 0.85rem;
    font-weight: 700;
    border-bottom: 1px solid color-mix(in oklab, var(--color-danger-text) 22%, var(--color-paper-300));
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem;
  }

  .alert-action {
    border: 1px solid currentColor;
    background: transparent;
    color: inherit;
    padding: 0.25rem 0.6rem;
    border-radius: var(--radius-sm);
    font-size: 0.78rem;
    font-weight: 800;
    cursor: pointer;
  }

  .alert-action--ghost {
    opacity: 0.7;
  }
</style>
