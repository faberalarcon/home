<script lang="ts">
  import Header from '$lib/home/Header.svelte';
  import SiteFooter from '$lib/site/SiteFooter.svelte';
</script>

<Header />
<main id="main-content" class="min-h-[70vh] flex items-center justify-center px-6 py-20 bg-warm-50">
  <div class="text-center max-w-lg">
    <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-3">404</p>
    <h1 class="text-5xl font-bold text-warm-800 mb-4 font-display">Page not found</h1>
    <p class="text-xl text-warm-700 mb-3 font-medium">This page is not part of 21 Bristoe.</p>
    <p class="text-gray-500 mb-8">Head back home or use one of the site links in the header.</p>
    <a href="/" class="inline-flex items-center gap-2 bg-warm-500 text-white px-8 py-3 rounded-xl font-semibold hover:bg-warm-600 transition-colors shadow-md">
      Back home
    </a>
  </div>
</main>
<SiteFooter />
