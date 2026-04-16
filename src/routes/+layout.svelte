<script lang="ts">
  import '../app.css';

  let { children } = $props();
</script>

<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors">
  <header class="border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
      <a href="/" class="text-xl font-bold tracking-tight text-accent">
        21 Bristoe Stats
      </a>
      <div class="flex items-center gap-6">
        <a href="/" class="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-accent transition-colors">Home</a>
        <a href="/drinks" class="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-accent transition-colors">Drinks</a>
        <a href="/house" class="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-accent transition-colors">House</a>
      </div>
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>

  <footer class="border-t border-slate-200 dark:border-slate-800 mt-16 py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-slate-500 dark:text-slate-500">
      <span>21 Bristoe Station Rd &middot; Taneytown, MD</span>
      <div class="flex items-center gap-4">
        <a href="https://21bristoe.com" class="hover:text-accent transition-colors">Home</a>
        <a href="https://drink-hub.21bristoe.com" class="hover:text-accent transition-colors">Drink Hub</a>
      </div>
    </div>
  </footer>
</div>
