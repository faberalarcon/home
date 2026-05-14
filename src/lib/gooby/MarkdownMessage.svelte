<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';
  import { tick } from 'svelte';

  interface Props {
    content: string;
  }

  let { content }: Props = $props();

  marked.use({
    gfm: true,
    breaks: true
  });

  const html = $derived(
    DOMPurify.sanitize(marked.parse(content || '', { async: false }), {
      USE_PROFILES: { html: true }
    })
  );

  let container = $state<HTMLDivElement | null>(null);

  $effect(() => {
    html;
    tick().then(() => attachCopyButtons());
  });

  function attachCopyButtons() {
    if (!container) return;
    const pres = container.querySelectorAll('pre');
    pres.forEach((pre) => {
      if ((pre as HTMLElement).dataset.copyReady === '1') return;
      (pre as HTMLElement).dataset.copyReady = '1';
      (pre as HTMLElement).style.position = 'relative';
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'gooby-copy-btn';
      button.textContent = 'Copy';
      button.setAttribute('aria-label', 'Copy code');
      button.addEventListener('click', async () => {
        const code = pre.querySelector('code');
        const text = code?.textContent ?? pre.textContent ?? '';
        try {
          await navigator.clipboard.writeText(text);
          button.textContent = 'Copied';
          window.setTimeout(() => {
            button.textContent = 'Copy';
          }, 1400);
        } catch {
          button.textContent = 'Failed';
        }
      });
      pre.appendChild(button);
    });
  }
</script>

<div bind:this={container} class="gooby-markdown">
  {@html html}
</div>

<style>
  :global(.gooby-copy-btn) {
    position: absolute;
    top: 0.4rem;
    right: 0.4rem;
    border: 0;
    border-radius: 0.4rem;
    background: rgba(255, 255, 255, 0.12);
    color: var(--color-paper-50);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    padding: 0.3rem 0.55rem;
    cursor: pointer;
    opacity: 0;
    transition: opacity 120ms ease, background 120ms ease;
  }

  :global(.gooby-markdown pre:hover .gooby-copy-btn),
  :global(.gooby-copy-btn:focus-visible) {
    opacity: 1;
  }

  :global(.gooby-copy-btn:hover) {
    background: rgba(255, 255, 255, 0.22);
  }

  @media (hover: none) {
    :global(.gooby-copy-btn) { opacity: 0.7; }
  }
</style>
