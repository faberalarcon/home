<script lang="ts">
  import DOMPurify from 'dompurify';
  import { marked } from 'marked';

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
</script>

<div class="gooby-markdown">
  {@html html}
</div>
