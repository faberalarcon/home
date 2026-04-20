<script lang="ts">
  let {
    title,
    numeral = '',
    meta = ''
  }: {
    title: string;
    numeral?: string;
    meta?: string;
  } = $props();
</script>

<div class="dossier-folio">
  {#if numeral}
    <span class="dossier-folio__numeral">{numeral}</span>
  {/if}
  <span class="dossier-folio__title">{title}</span>
  {#if meta}
    <span class="dossier-folio__meta">{meta}</span>
  {/if}
</div>
