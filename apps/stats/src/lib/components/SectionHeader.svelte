<script lang="ts">
  let {
    title,
    meta = ''
  }: {
    title: string;
    meta?: string;
  } = $props();
</script>

<div class="section-header">
  <h2 class="section-header__title">{title}</h2>
  {#if meta}
    <p class="section-header__meta">{meta}</p>
  {/if}
</div>

<style>
  .section-header {
    display: flex;
    align-items: end;
    justify-content: space-between;
    gap: 0.75rem 1rem;
    flex-wrap: wrap;
    margin-bottom: 1rem;
    padding-bottom: 0.65rem;
    border-bottom: 1px solid var(--color-paper-300);
  }
  .section-header__title {
    font-family: var(--font-body);
    font-size: 0.8rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-900);
    margin: 0;
    line-height: 1.2;
  }
  .section-header__meta {
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-500);
    margin: 0;
    line-height: 1.2;
  }
</style>
