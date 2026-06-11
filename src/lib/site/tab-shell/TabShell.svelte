<script lang="ts">
  import { browser } from '$app/environment';
  import { afterNavigate, goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy, onMount, tick } from 'svelte';
  import type { TabShellConfig } from './types';

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

  let { config, children }: { config: TabShellConfig; children: any } = $props();

  const MAIN_HREFS = $derived(config.sections.map((section) => section.href));

  let activeHref = $state<string | null>(null);
  let activeData = $state<any>(null);
  let shellNavigationActive = false;
  const pageCache = new Map<string, CacheEntry>();

  const currentHref = $derived(canonicalHref($page.url));
  const ActivePage = $derived(activeHref ? config.pageComponents[activeHref] : null);

  function canonicalHref(url: URL): string | null {
    if (url.search) return null;
    const pathname = config.routePath(url.pathname);
    return isPageHref(pathname) ? pathname : null;
  }

  function isPageHref(href: string): boolean {
    return href in config.pageComponents;
  }

  function canWarmup(): boolean {
    if (!browser) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connection?.saveData !== true;
  }

  function cacheFresh(entry: CacheEntry | undefined): entry is CacheEntry & { data: any } {
    return Boolean(entry?.data && Date.now() - entry.loadedAt < config.cacheTtlMs);
  }

  function seedCurrentPageData() {
    if (!currentHref || activeHref) return;
    pageCache.set(currentHref, { data: $page.data, loadedAt: Date.now() });
  }

  function adjacentHrefs(href: string | null): string[] {
    if (!href) return [];
    const currentIndex = config.sectionIndexForPath(href);
    if (currentIndex === -1) return [];
    return [config.sections[currentIndex - 1]?.href, config.sections[currentIndex + 1]?.href].filter(
      (item): item is string => Boolean(item && isPageHref(item))
    );
  }

  async function fetchPageData(href: string): Promise<any> {
    const response = await fetch(`${config.appPath('/api/page-data')}?href=${encodeURIComponent(href)}`, {
      credentials: 'same-origin'
    });
    if (!response.ok) throw new Error(`Failed to load ${href}`);
    const body = (await response.json()) as { data?: any };
    if (!body.data) throw new Error(`Missing page data for ${href}`);
    return body.data;
  }

  function preloadPage(href: string): Promise<any> {
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

  function preloadAround(href: string | null) {
    if (!href || !canWarmup()) return;
    const priority = adjacentHrefs(href);
    void Promise.allSettled(priority.map((item) => preloadPage(item)));

    const remaining = MAIN_HREFS.filter(
      (item) => isPageHref(item) && item !== href && !priority.includes(item)
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

  async function syncRouteUrl(href: string, scrollY: number) {
    shellNavigationActive = true;
    try {
      await goto(config.appPath(href), { noScroll: true, keepFocus: true });
      await tick();
      restoreScrollY(scrollY);
      activeHref = null;
      activeData = null;
    } finally {
      shellNavigationActive = false;
    }
  }

  async function activatePage(href: string, scrollY = window.scrollY) {
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
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    const anchor = event.target instanceof Element
      ? event.target.closest<HTMLAnchorElement>(`${config.navAnchorSelector} a[href]`)
      : null;
    if (!anchor) return;

    const href = canonicalHref(new URL(anchor.href));
    if (!href || href === currentHref) return;

    event.preventDefault();
    anchor.blur();
    void activatePage(href).catch(() => {
      void goto(config.appPath(href), { noScroll: true, keepFocus: true });
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
    window.addEventListener(config.navEventName, handleSwipeNavigate as EventListener);
    document.addEventListener('click', handleDocumentClick);
  });

  onDestroy(() => {
    if (!browser) return;
    window.removeEventListener(config.navEventName, handleSwipeNavigate as EventListener);
    document.removeEventListener('click', handleDocumentClick);
  });
</script>

{#if ActivePage && activeData}
  <ActivePage data={activeData} />
{:else}
  {@render children()}
{/if}
