<script lang="ts">
  import '../app.css';
  import { browser } from '$app/environment';
  import { page } from '$app/stores';

  let { children } = $props();

  // Dark mode toggle — persists in localStorage, falls back to system preference
  let dark = $state(false);

  if (browser) {
    dark =
      localStorage.getItem('theme') === 'dark' ||
      (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);
  }

  function toggleTheme() {
    dark = !dark;
    if (browser) {
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }
  }

  const navLinks = [
    { href: '/', label: 'Home', icon: '🏠' },
    { href: '/drinks', label: 'Drinks', icon: '🍻' },
    { href: '/house', label: 'House', icon: '📡' }
  ];
</script>

<div class="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 transition-colors duration-200">
  <header class="border-b border-slate-200 dark:border-slate-800 bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm sticky top-0 z-50">
    <nav class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
      <div class="flex items-center gap-3 min-w-0">
        <a
          href="https://21bristoe.com"
          class="hidden sm:inline-flex items-center gap-1 text-sm text-slate-500 dark:text-slate-400 hover:text-sky-500 dark:hover:text-sky-400 transition-colors"
          aria-label="Back to 21bristoe.com"
        >
          <span aria-hidden="true">←</span> 21bristoe.com
        </a>
        <span class="hidden sm:inline text-slate-300 dark:text-slate-700" aria-hidden="true">/</span>
        <a href="/" class="text-xl font-bold tracking-tight text-accent hover:opacity-80 transition-opacity truncate">
          21 Bristoe <span class="text-slate-500 dark:text-slate-400 font-medium">Stats</span>
        </a>
      </div>

      <div class="flex items-center gap-1 sm:gap-2">
        {#each navLinks as link}
          <a
            href={link.href}
            class="px-3 py-1.5 text-sm font-medium rounded-lg transition-colors {$page.url.pathname === link.href
              ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300'
              : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'}"
          >
            <span class="hidden sm:inline">{link.label}</span>
            <span class="sm:hidden">{link.icon}</span>
          </a>
        {/each}

        <!-- Dark mode toggle -->
        <button
          onclick={toggleTheme}
          aria-label="Toggle dark mode"
          class="ml-2 p-2 rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
        >
          {#if dark}
            ☀️
          {:else}
            🌙
          {/if}
        </button>
      </div>
    </nav>
  </header>

  <main class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    {@render children()}
  </main>

  <footer class="border-t border-slate-200 dark:border-slate-800 mt-16 py-6">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-500">
      <span>21 Bristoe Station Rd &middot; Taneytown, MD</span>
      <div class="flex items-center gap-4">
        <a href="https://21bristoe.com" class="hover:text-sky-400 transition-colors">21bristoe.com</a>
        <a href="https://drink-hub.21bristoe.com" class="hover:text-sky-400 transition-colors">Drink Hub</a>
      </div>
    </div>
  </footer>
</div>
