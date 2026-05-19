<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { statsSections, sectionIndexForPath } from '$lib/stats/stats-sections';
  import { afterNavigate } from '$app/navigation';
  import { appPath, routePath } from '$lib/stats/app-paths';
  import { onDestroy, onMount, tick } from 'svelte';
  import OverviewPage from '../../../routes/stats/+page.svelte';
  import BackupsPage from '../../../routes/stats/backups/+page.svelte';
  import DrinksPage from '../../../routes/stats/drinks/+page.svelte';
  import HousePage from '../../../routes/stats/house/+page.svelte';
  import PiPage from '../../../routes/stats/pi/+page.svelte';
  import VisitorsPage from '../../../routes/stats/visitors/+page.svelte';

  const CACHE_TTL_MS = 60_000;
  const MAIN_HREFS = statsSections.map((section) => section.href);
  type PageHref = '/' | '/house' | '/drinks' | '/visitors' | '/backups' | '/pi';
  type PageData = any;
  type PageComponent = any;

  const PAGE_COMPONENTS: Record<PageHref, PageComponent> = {
    '/': OverviewPage,
    '/house': HousePage,
    '/drinks': DrinksPage,
    '/visitors': VisitorsPage,
    '/backups': BackupsPage,
    '/pi': PiPage
  };

  type CacheEntry = {
    data?: PageData;
    loadedAt: number;
    promise?: Promise<PageData>;
  };
  type SwipeNavigationDetail = {
    href: string;
    scrollY: number;
    handled: boolean;
    complete?: Promise<void>;
  };

  let { children } = $props();

  let activeHref = $state<PageHref | null>(null);
  let activeData = $state<PageData | null>(null);
  let shellNavigationActive = false;
  const pageCache = new Map<string, CacheEntry>();

  const currentHref = $derived(canonicalStatsHref($page.url));
  const ActivePage = $derived(activeHref ? PAGE_COMPONENTS[activeHref] : null);

  function canonicalStatsHref(url: URL): PageHref | null {
    const pathname = routePath(url.pathname);
    if (url.search) return null;
    if (pathname === '/house') return '/house';
    if (pathname === '/drinks') return '/drinks';
    if (pathname === '/visitors') return '/visitors';
    if (pathname === '/backups') return '/backups';
    if (pathname === '/pi') return '/pi';
    if (pathname === '/') return '/';
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

  function cacheFresh(entry: CacheEntry | undefined): entry is CacheEntry & { data: PageData } {
    return Boolean(entry?.data && Date.now() - entry.loadedAt < CACHE_TTL_MS);
  }

  function seedCurrentPageData() {
    if (!currentHref || activeHref) return;
    pageCache.set(currentHref, {
      data: $page.data as PageData,
      loadedAt: Date.now()
    });
  }

  function adjacentHrefs(href: PageHref | null): PageHref[] {
    if (!href) return [];
    const currentIndex = sectionIndexForPath(href);
    if (currentIndex === -1) return [];
    return [statsSections[currentIndex - 1]?.href, statsSections[currentIndex + 1]?.href].filter(
      (item): item is PageHref => Boolean(item && isPageHref(item))
    );
  }

  async function fetchPageData(href: PageHref): Promise<PageData> {
    const response = await fetch(`${appPath('/api/page-data')}?href=${encodeURIComponent(href)}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`Failed to load ${href}`);
    const body = (await response.json()) as { data?: PageData };
    if (!body.data) throw new Error(`Missing page data for ${href}`);
    return body.data;
  }

  function preloadStatsPage(href: PageHref): Promise<PageData> {
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
    void Promise.allSettled(priority.map((item) => preloadStatsPage(item)));

    const remaining = MAIN_HREFS.filter(
      (item): item is PageHref => isPageHref(item) && item !== href && !priority.includes(item)
    );
    void (async () => {
      for (const item of remaining) {
        try {
          await preloadStatsPage(item);
        } catch {
          // Best-effort background cache fill.
        }
      }
    })();
  }

  function clampedScrollY(scrollY: number): number {
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    return Math.min(scrollY, maxScrollY);
  }

  function restoreScrollY(scrollY: number) {
    const html = document.documentElement;
    const previousScrollBehavior = html.style.scrollBehavior;
    html.style.scrollBehavior = 'auto';
    window.scrollTo({ left: window.scrollX, top: clampedScrollY(scrollY), behavior: 'auto' });
    html.style.scrollBehavior = previousScrollBehavior;
  }

  async function syncRouteUrl(href: PageHref, scrollY: number) {
    shellNavigationActive = true;
    try {
      await goto(appPath(href), { noScroll: true, keepFocus: true });
      await tick();
      restoreScrollY(scrollY);
      activeHref = null;
      activeData = null;
    } finally {
      shellNavigationActive = false;
    }
  }

  async function activateStatsPage(href: PageHref, scrollY = window.scrollY) {
    const data = await preloadStatsPage(href);
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
    detail.complete = activateStatsPage(detail.href, detail.scrollY).catch((error) => {
      activeHref = null;
      activeData = null;
      throw error;
    });
  }

  function handleDocumentClick(event: MouseEvent) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }

    const anchor = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>('.app-header__nav a[href]')
      : null;
    if (!anchor) return;

    const href = canonicalStatsHref(new URL(anchor.href));
    if (!href || href === currentHref) return;

    event.preventDefault();
    if (anchor instanceof HTMLElement) anchor.blur();
    void activateStatsPage(href).catch(() => {
      void goto(appPath(href), { noScroll: true, keepFocus: true });
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
    window.addEventListener('stats:swipe-navigate', handleSwipeNavigate as EventListener);
    document.addEventListener('click', handleDocumentClick);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener('stats:swipe-navigate', handleSwipeNavigate as EventListener);
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

{#if ActivePage && activeData}
  <ActivePage data={activeData} />
{:else}
  {@render children()}
{/if}
