<script lang="ts">
  let { title, icon = '' }: { title: string; icon?: string } = $props();
</script>

<div class="flex items-center gap-2 mb-4 pb-2 border-b border-slate-200/60 dark:border-slate-800/60 relative">
  {#if icon}
    <span class="text-xl">{icon}</span>
  {/if}
  <h2 class="text-lg font-semibold text-slate-800 dark:text-slate-200">{title}</h2>
  <span class="section-rule" aria-hidden="true"></span>
</div>

<style>
  .section-rule {
    position: absolute;
    left: 0;
    bottom: -1px;
    height: 2px;
    width: clamp(60px, 18%, 160px);
    background: linear-gradient(to right, rgb(56 189 248 / 0.7), transparent);
    border-radius: 1px;
  }
</style>
