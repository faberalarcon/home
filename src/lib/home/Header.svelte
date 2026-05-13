<script lang="ts">
  import SiteBrand from '$lib/site/SiteBrand.svelte';
  import SiteNav from '$lib/site/SiteNav.svelte';
</script>

<header class="w-full py-3 sm:py-4 px-4 sm:px-6 bg-slate-950/92 backdrop-blur-md border-b border-white/10 sticky top-0 z-50 shadow-[0_1px_0_rgba(111,168,220,0.28)]">
  <div class="max-w-5xl mx-auto flex items-center justify-between gap-3 min-w-0">
    <SiteBrand />
    <SiteNav />
  </div>
</header>
