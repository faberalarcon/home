<script lang="ts">
  import { onMount } from 'svelte';
  import { renderMarkdown } from './markdown-stream';
  import { ensureHighlighter, onReady } from './highlighter';
  import 'katex/dist/katex.min.css';
  import './markdown.css';

  interface Props {
    content: string;
    streaming?: boolean;
  }

  let { content, streaming = false }: Props = $props();

  let highlighterReady = $state(false);
  let rafScheduled = false;
  let pendingContent = $state('');

  onMount(() => {
    pendingContent = content;
    ensureHighlighter().then(() => {
      highlighterReady = true;
    });
    return onReady(() => {
      highlighterReady = true;
    });
  });

  $effect(() => {
    const next = content;
    if (!streaming) {
      pendingContent = next;
      return;
    }
    if (rafScheduled) return;
    rafScheduled = true;
    requestAnimationFrame(() => {
      rafScheduled = false;
      pendingContent = next;
    });
  });

  const html = $derived(
    (() => {
      // Touch highlighterReady so the derived re-runs once Shiki finishes loading.
      void highlighterReady;
      return renderMarkdown(pendingContent, { streaming });
    })()
  );

  let container = $state<HTMLDivElement | null>(null);

  function handleClick(event: MouseEvent) {
    const target = event.target as HTMLElement | null;
    const btn = target?.closest?.('.gooby-copy-btn') as HTMLButtonElement | null;
    if (!btn || !container?.contains(btn)) return;
    const code = btn.dataset.code ?? '';
    navigator.clipboard
      .writeText(code)
      .then(() => {
        const original = btn.textContent;
        btn.textContent = 'Copied';
        window.setTimeout(() => {
          btn.textContent = original ?? 'Copy';
        }, 1400);
      })
      .catch(() => {
        btn.textContent = 'Failed';
      });
  }
</script>

<div
  bind:this={container}
  class="gooby-markdown"
  onclick={handleClick}
  role="presentation"
>
  {@html html}
</div>
