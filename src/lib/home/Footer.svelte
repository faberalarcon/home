<script lang="ts">
  import { onMount } from 'svelte';
  import type { FooterData } from './content';

  export let footer: FooterData;
  let liveVisitorCount = footer.visitorCount;

  onMount(() => {
    fetch('/uploads/visitor-count.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d.count === 'number') liveVisitorCount = d.count;
      })
      .catch(() => {});
  });
</script>

<footer class="w-full bg-warm-900 text-warm-100 py-12 px-6 mt-auto">
  <div class="max-w-5xl mx-auto">
    <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
      <div>
        <p class="text-2xl font-bold text-warm-200 mb-1 font-display">{footer.brand}</p>
        <p class="text-warm-400 text-sm">{footer.location}</p>
        <p class="text-warm-500 text-xs mt-1">{footer.tagline}</p>
      </div>

      <nav aria-label="Footer navigation">
        <ul class="flex flex-col gap-2 text-sm list-none" role="list">
          <li><a href="/drinks/" class="text-warm-300 hover:text-warm-100 transition-colors">Drink Hub →</a></li>
          <li><a href="/stats/" class="text-warm-300 hover:text-warm-100 transition-colors">Stats →</a></li>
        </ul>
      </nav>
    </div>

    {#if liveVisitorCount !== null}
      <div class="mt-8 pt-6 border-t border-warm-800 text-center">
        <p class="text-warm-300 text-sm">
          <span aria-hidden="true">👋</span>
          <span class="tabular-nums font-semibold text-warm-100">{liveVisitorCount.toLocaleString()}</span>
          <span class="text-warm-400">unique visitors so far</span>
        </p>
      </div>
    {/if}

    <div class="mt-8 pt-6 border-t border-warm-800 text-warm-500 text-xs flex flex-col sm:flex-row justify-between gap-2">
      <p>© {footer.year} 21 Bristoe. Made with love for the household.</p>
      <p>
        Built by Faber Alarcon ·
        <a
          href="https://github.com/faberalarcon/home"
          class="text-warm-400 hover:text-warm-200 transition-colors"
          target="_blank"
          rel="noopener noreferrer"
        >GitHub</a>
      </p>
    </div>
  </div>
</footer>
