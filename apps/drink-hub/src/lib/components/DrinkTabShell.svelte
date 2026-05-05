<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { afterNavigate } from '$app/navigation';
  import { drinkSections, sectionIndexForPath } from '$lib/drink-sections';
  import { onDestroy, onMount, tick } from 'svelte';
  import ProfilesPage from '../../routes/+page.svelte';
  import MenuPage from '../../routes/menu/+page.svelte';
  import RecentPage from '../../routes/recent/+page.svelte';
  import StatsPage from '../../routes/stats/+page.svelte';

  const CACHE_TTL_MS = 30_000;
  const MAIN_HREFS = drinkSections.map((section) => section.href);

  type PageHref = '/' | '/menu' | '/recent' | '/stats';
  type CacheEntry = {
    data?: any;
    loadedAt: number;
    promise?: Promise<any>;
  };
  type SwipeNavigationDetail = {
    href: string;
    scrollY: number;
    handled: boolean;
    complete?: Promise<void>;
  };

  const PAGE_COMPONENTS: Record<PageHref, any> = {
    '/': ProfilesPage,
    '/menu': MenuPage,
    '/recent': RecentPage,
    '/stats': StatsPage
  };

  let { children } = $props();

  let activeHref = $state<PageHref | null>(null);
  let activeData = $state<any>(null);
  let shellNavigationActive = false;
  const pageCache = new Map<string, CacheEntry>();

  const currentHref = $derived(canonicalDrinkHref($page.url));
  const ActivePage = $derived(activeHref ? PAGE_COMPONENTS[activeHref] : null);

  function canonicalDrinkHref(url: URL): PageHref | null {
    if (url.search) return null;
    if (url.pathname === '/') return '/';
    if (url.pathname === '/menu') return '/menu';
    if (url.pathname === '/recent') return '/recent';
    if (url.pathname === '/stats') return '/stats';
    return null;
  }

  function isPageHref(href: string): href is PageHref {
    return href in PAGE_COMPONENTS;
  }

  function canWarmup(): boolean {
    if (!browser) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connection?.saveData !== true;
  }

  function cacheFresh(entry: CacheEntry | undefined): entry is CacheEntry & { data: any } {
    return Boolean(entry?.data && Date.now() - entry.loadedAt < CACHE_TTL_MS);
  }

  function seedCurrentPageData() {
    if (!currentHref || activeHref) return;
    pageCache.set(currentHref, { data: $page.data, loadedAt: Date.now() });
  }

  function adjacentHrefs(href: PageHref | null): PageHref[] {
    if (!href) return [];
    const currentIndex = sectionIndexForPath(href);
    if (currentIndex === -1) return [];
    return [drinkSections[currentIndex - 1]?.href, drinkSections[currentIndex + 1]?.href].filter(
      (item): item is PageHref => Boolean(item && isPageHref(item))
    );
  }

  async function fetchPageData(href: PageHref): Promise<any> {
    const response = await fetch(`/api/page-data?href=${encodeURIComponent(href)}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`Failed to load ${href}`);
    const body = await response.json() as { data?: any };
    if (!body.data) throw new Error(`Missing page data for ${href}`);
    return body.data;
  }

  function preloadPage(href: PageHref): Promise<any> {
    const cached = pageCache.get(href);
    if (cacheFresh(cached)) return Promise.resolve(cached.data);
    if (cached?.promise) return cached.promise;

    const promise = fetchPageData(href)
      .then((data) => {
        pageCache.set(href, { data, loadedAt: Date.now() });
        return data;
      })
      .catch((error) => {
        pageCache.delete(href);
        throw error;
      });
    pageCache.set(href, { loadedAt: 0, promise });
    return promise;
  }

  function preloadAround(href: PageHref | null) {
    if (!href || !canWarmup()) return;
    const priority = adjacentHrefs(href);
    void Promise.allSettled(priority.map((item) => preloadPage(item)));

    const remaining = MAIN_HREFS.filter(
      (item): item is PageHref => isPageHref(item) && item !== href && !priority.includes(item)
    );
    void (async () => {
      for (const item of remaining) {
        try {
          await preloadPage(item);
        } catch {
          // Background-only cache fill.
        }
      }
    })();
  }

  function restoreScrollY(scrollY: number) {
    const html = document.documentElement;
    const previousScrollBehavior = html.style.scrollBehavior;
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    html.style.scrollBehavior = 'auto';
    window.scrollTo({ left: window.scrollX, top: Math.min(scrollY, maxScrollY), behavior: 'auto' });
    html.style.scrollBehavior = previousScrollBehavior;
  }

  async function syncRouteUrl(href: PageHref, scrollY: number) {
    shellNavigationActive = true;
    try {
      await goto(href, { noScroll: true, keepFocus: true });
      await tick();
      restoreScrollY(scrollY);
      activeHref = null;
      activeData = null;
    } finally {
      shellNavigationActive = false;
    }
  }

  async function activatePage(href: PageHref, scrollY = window.scrollY) {
    const data = await preloadPage(href);
    activeHref = href;
    activeData = data;
    await tick();
    restoreScrollY(scrollY);
    preloadAround(href);
    void syncRouteUrl(href, scrollY).catch(() => {
      activeHref = null;
      activeData = null;
    });
  }

  function handleSwipeNavigate(event: Event) {
    const detail = (event as CustomEvent<SwipeNavigationDetail>).detail;
    if (!detail || !isPageHref(detail.href) || !browser) return;
    detail.handled = true;
    detail.complete = activatePage(detail.href, detail.scrollY).catch((error) => {
      activeHref = null;
      activeData = null;
      throw error;
    });
  }

  function handleDocumentClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const anchor = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('.drink-shell__nav a[href]')
      : null;
    if (!anchor) return;

    const href = canonicalDrinkHref(new URL(anchor.href));
    if (!href || href === currentHref) return;

    event.preventDefault();
    void activatePage(href).catch(() => {
      void goto(href, { noScroll: true, keepFocus: true });
    });
  }

  $effect(() => {
    seedCurrentPageData();
    preloadAround(currentHref);
  });

  afterNavigate(() => {
    if (shellNavigationActive) {
      shellNavigationActive = false;
      return;
    }
    activeHref = null;
    activeData = null;
    seedCurrentPageData();
    preloadAround(currentHref);
  });

  onMount(() => {
    seedCurrentPageData();
    preloadAround(currentHref);
    window.addEventListener('drink:swipe-navigate', handleSwipeNavigate as EventListener);
    document.addEventListener('click', handleDocumentClick);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('drink:swipe-navigate', handleSwipeNavigate as EventListener);
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

{#if ActivePage && activeData}
  <ActivePage data={activeData} />
{:else}
  {@render children()}
{/if}
