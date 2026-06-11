<script lang="ts">
  import '../app.css';
  import { page } from '$app/stores';
  import SiteTabBar from '$lib/site/SiteTabBar.svelte';

  let { children } = $props();

  const TAB_BAR_EXCLUDED = ['/gooby', '/admin', '/drinks/login', '/drinks/kiosk'];

  const showTabBar = $derived(
    !TAB_BAR_EXCLUDED.some(
      (prefix) => $page.url.pathname === prefix || $page.url.pathname.startsWith(`${prefix}/`)
    )
  );
</script>

{@render children()}

{#if showTabBar}
  <SiteTabBar />
{/if}
