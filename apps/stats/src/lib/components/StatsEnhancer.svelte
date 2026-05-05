<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import {
    defaultStatsPreloadHrefs,
    houseRangeHrefs,
    piRangeHrefs,
    sectionIndexForPath,
    statsSections
  } from '$lib/stats-sections';
  import { onDestroy, onMount, tick } from 'svelte';

  const WARMUP_BATCH_SIZE = 40;
  const PREVIEW_CACHE_LIMIT = 6;
  const SWIPE_PAGE_OVERLAP_PX = 2;
  const SWIPE_MIN_X = 70;
  const SWIPE_RATIO = 1.5;
  const SWIPE_DEDUP_MS = 500;
  const INTERACTIVE_SELECTOR = [
    'a',
    'button',
    'input',
    'select',
    'textarea',
    'label',
    'summary',
    '[role="button"]',
    '[contenteditable="true"]',
    '.filters',
    '.tab-row',
    '.house__range-tabs',
    '.pi__range-tabs',
    '.app-header__nav',
    '.hubnav'
  ].join(',');

  type IdleDeadline = { didTimeout: boolean; timeRemaining: () => number };
  type IdleWindow = Window & {
    requestIdleCallback?: (callback: (deadline: IdleDeadline) => void, options?: { timeout: number }) => number;
    cancelIdleCallback?: (handle: number) => void;
  };
  type Point = { x: number; y: number };
  type SwipeOverlay = {
    root: HTMLDivElement;
    current: HTMLDivElement;
    next: HTMLDivElement;
    width: number;
  };
  type SwipeNavigationDetail = {
    href: string;
    scrollY: number;
    handled: boolean;
    complete?: Promise<void>;
  };

  let pendingIdle: number | null = null;
  let pendingTimeout: ReturnType<typeof setTimeout> | null = null;
  let activePointer: { id: number; start: Point } | null = null;
  let activeTouch: { id: number; start: Point } | null = null;
  let lastSwipeAt = 0;
  let activeOverlay: SwipeOverlay | null = null;
  let activeTargetHref: string | null = null;
  let activeDirection: -1 | 1 = -1;
  const previewCache = new Map<string, string>();
  const previewRequests = new Map<string, Promise<string | null>>();
  const sentWarmups = new Set<string>();

  function localDate(date: Date): string {
    const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
    return shifted.toISOString().slice(0, 10);
  }

  function hrefWithParams(pathname: string, entries: Array<[string, string | number]>): string {
    const params = new URLSearchParams();
    for (const [key, value] of entries) params.set(key, String(value));
    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  function currentVariantHref(url: URL): string {
    if (url.pathname === '/house') {
      return `/house?range=${url.searchParams.get('range') ?? '7d'}`;
    }
    if (url.pathname === '/pi') {
      return `/pi?range=${url.searchParams.get('range') ?? '1d'}`;
    }
    return `${url.pathname}${url.search}`;
  }

  function datePresetHrefs(): string[] {
    const now = new Date();
    const today = localDate(now);

    const monday = new Date(now);
    const day = monday.getDay();
    monday.setDate(monday.getDate() - (day === 0 ? 6 : day - 1));

    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const ninetyDaysAgo = new Date(now);
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 89);

    return [
      hrefWithParams('/drinks', [['from', today], ['to', today]]),
      hrefWithParams('/drinks', [['from', localDate(monday)], ['to', today]]),
      hrefWithParams('/drinks', [['from', localDate(monthStart)], ['to', today]]),
      hrefWithParams('/drinks', [['from', localDate(ninetyDaysAgo)], ['to', today]])
    ];
  }

  function buildDrinkWarmups(data: Record<string, unknown>): string[] {
    const stats = data.stats as
      | {
          profiles?: Array<{ id: number }>;
          drinks?: Array<{ id: number; category: string }>;
        }
      | null
      | undefined;

    const hrefs: string[] = [];
    for (const profile of stats?.profiles ?? []) {
      hrefs.push(hrefWithParams('/drinks', [['profile_id', profile.id]]));
    }
    for (const drink of stats?.drinks ?? []) {
      hrefs.push(hrefWithParams('/drinks', [['drink_id', drink.id]]));
    }

    const categories = new Set((stats?.drinks ?? []).map((drink) => drink.category).filter(Boolean));
    for (const category of categories) {
      hrefs.push(hrefWithParams('/drinks', [['category', category]]));
    }

    hrefs.push(...datePresetHrefs());
    return hrefs;
  }

  function buildWarmupHrefs(url: URL, data: Record<string, unknown>): string[] {
    let hrefs: string[] = [];
    if (url.pathname === '/') hrefs = defaultStatsPreloadHrefs;
    else if (url.pathname === '/house') hrefs = houseRangeHrefs;
    else if (url.pathname === '/pi') hrefs = piRangeHrefs;
    else if (url.pathname === '/drinks') hrefs = buildDrinkWarmups(data);

    const current = currentVariantHref(url);
    return [...new Set(hrefs)]
      .filter((href) => href !== current && href !== `${url.pathname}${url.search}`);
  }

  function canWarmup(): boolean {
    if (!browser) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connection?.saveData !== true;
  }

  async function postWarmup(hrefs: string[]) {
    if (!hrefs.length || !canWarmup()) return;
    for (let i = 0; i < hrefs.length; i += WARMUP_BATCH_SIZE) {
      await fetch('/api/preload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hrefs: hrefs.slice(i, i + WARMUP_BATCH_SIZE) })
      }).catch(() => undefined);
    }
  }

  function scheduleWarmup(hrefs: string[]) {
    if (!browser || !hrefs.length || !canWarmup()) return;

    const idleWindow = window as IdleWindow;
    if (idleWindow.requestIdleCallback) {
      pendingIdle = idleWindow.requestIdleCallback(() => void postWarmup(hrefs), { timeout: 1800 });
      return;
    }

    pendingTimeout = setTimeout(() => void postWarmup(hrefs), 250);
  }

  function runPreviewPrewarm(hrefs: string[]) {
    void Promise.all(hrefs.map((href) => loadPreviewHtml(href)));
  }

  function prewarmAdjacentPreviews() {
    const hrefs = adjacentSectionHrefs();
    if (!browser || !hrefs.length || !canWarmup()) return;

    const pendingHrefs = [...new Set(hrefs)].filter((href) => !previewCache.has(href));
    if (!pendingHrefs.length) return;
    runPreviewPrewarm(pendingHrefs);
  }

  function isMobileSwipeTarget(): boolean {
    return browser && window.innerWidth <= 900 && window.matchMedia('(pointer: coarse), (hover: none)').matches;
  }

  function prefersReducedMotion(): boolean {
    return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
  }

  function fixedHeaderHeight(): number {
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue('--stats-app-header-height')
      .trim();
    const cssPixels = Number.parseFloat(cssValue);
    if (Number.isFinite(cssPixels) && cssPixels > 0) return cssPixels;

    const header = document.querySelector('.app-header');
    return header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  }

  function handlePointerDown(event: PointerEvent) {
    if (!isMobileSwipeTarget() || !event.isPrimary || event.pointerType === 'mouse') return;
    if (isInteractiveTarget(event.target)) return;
    activePointer = { id: event.pointerId, start: { x: event.clientX, y: event.clientY } };
    prewarmAdjacentPreviews();
  }

  function targetForDx(dx: number): string | null {
    const currentIndex = sectionIndexForPath($page.url.pathname);
    if (currentIndex === -1) return null;
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    return statsSections[nextIndex]?.href ?? null;
  }

  function adjacentSectionHrefs(): string[] {
    const currentIndex = sectionIndexForPath($page.url.pathname);
    if (currentIndex === -1) return [];
    return [statsSections[currentIndex - 1]?.href, statsSections[currentIndex + 1]?.href].filter(
      (href): href is string => Boolean(href)
    );
  }

  function readMainPreview(html: string): string | null {
    try {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const main = parsed.querySelector('#main-content');
      if (!main) return null;
      main.removeAttribute('id');
      return main.outerHTML;
    } catch {
      return null;
    }
  }

  async function loadPreviewHtml(href: string): Promise<string | null> {
    if (previewCache.has(href)) return previewCache.get(href) ?? null;
    const pending = previewRequests.get(href);
    if (pending) return pending;

    const request = (async () => {
      const response = await fetch(href, { credentials: 'same-origin' });
      if (!response.ok) return null;
      const preview = readMainPreview(await response.text());
      if (preview) {
        previewCache.set(href, preview);
        while (previewCache.size > PREVIEW_CACHE_LIMIT) {
          const oldest = previewCache.keys().next().value;
          if (!oldest) break;
          previewCache.delete(oldest);
        }
      }
      return preview;
    })()
      .catch(() => null)
      .finally(() => {
        previewRequests.delete(href);
      });

    previewRequests.set(href, request);
    try {
      return await request;
    } catch {
      return null;
    }
  }

  function destroyOverlay() {
    activeOverlay?.root.remove();
    activeOverlay = null;
    activeTargetHref = null;
    document.body.classList.remove('swipe-dragging');
  }

  function createSwipeContent(contentOffsetY: number): HTMLDivElement {
    const content = document.createElement('div');
    content.className = 'swipe-page__content';
    content.style.transform = `translate3d(0, ${Math.round(contentOffsetY)}px, 0)`;
    return content;
  }

  function createOverlay(targetHref: string): SwipeOverlay | null {
    const main = document.getElementById('main-content');
    if (!main) return null;

    const targetPreview = previewCache.get(targetHref);
    if (!targetPreview) {
      void loadPreviewHtml(targetHref);
      return null;
    }

    const rect = main.getBoundingClientRect();
    const overlayTop = fixedHeaderHeight();
    const contentOffsetY = rect.top - overlayTop;
    const root = document.createElement('div');
    root.className = 'swipe-overlay';
    root.style.left = `${Math.round(rect.left)}px`;
    root.style.top = `${Math.round(overlayTop)}px`;
    root.style.width = `${Math.round(rect.width)}px`;
    root.style.height = `${Math.round(Math.max(1, window.innerHeight - overlayTop))}px`;

    const current = document.createElement('div');
    current.className = 'swipe-page swipe-page--current';
    const currentMain = main.cloneNode(true) as HTMLElement;
    currentMain.removeAttribute('id');
    const currentContent = createSwipeContent(contentOffsetY);
    currentContent.append(currentMain);
    current.append(currentContent);

    const next = document.createElement('div');
    next.className = 'swipe-page swipe-page--next';
    const nextContent = createSwipeContent(contentOffsetY);
    nextContent.innerHTML = targetPreview;
    next.append(nextContent);

    root.append(current, next);
    document.body.append(root);

    return { root, current, next, width: rect.width };
  }

  function dragOverlay(dx: number) {
    if (!activeOverlay) return;
    const width = Math.max(activeOverlay.width, 1);
    const direction = dx < 0 ? -1 : 1;
    const nextStart = direction < 0 ? width : -width;
    const nextOffset = nextStart + dx + direction * SWIPE_PAGE_OVERLAP_PX;
    const fade = Math.max(0.74, 1 - Math.min(1, Math.abs(dx) / width) * 0.2);

    activeOverlay.current.style.transform = `translate3d(${dx}px, 0, 0)`;
    activeOverlay.current.style.opacity = `${fade}`;
    activeOverlay.next.style.transform = `translate3d(${nextOffset}px, 0, 0)`;
  }

  function animateOverlayCommit(dx: number): Promise<void> {
    if (!activeOverlay) return Promise.resolve();
    const width = Math.max(activeOverlay.width, 1);
    const currentEnd = dx < 0 ? -width - SWIPE_PAGE_OVERLAP_PX : width + SWIPE_PAGE_OVERLAP_PX;

    activeOverlay.current.style.transition = 'transform 200ms ease-out, opacity 200ms ease-out';
    activeOverlay.next.style.transition = 'transform 200ms ease-out';
    activeOverlay.current.style.transform = `translate3d(${currentEnd}px, 0, 0)`;
    activeOverlay.current.style.opacity = '0.8';
    activeOverlay.next.style.transform = 'translate3d(0, 0, 0)';

    return new Promise((resolve) => setTimeout(resolve, 210));
  }

  function animateOverlayCancel(): Promise<void> {
    if (!activeOverlay) return Promise.resolve();

    activeOverlay.current.style.transition = 'transform 170ms ease-out, opacity 170ms ease-out';
    activeOverlay.next.style.transition = 'transform 170ms ease-out';
    activeOverlay.current.style.transform = 'translate3d(0, 0, 0)';
    activeOverlay.current.style.opacity = '1';
    const offscreen = activeDirection < 0 ? '100%' : '-100%';
    activeOverlay.next.style.transform = `translate3d(${offscreen}, 0, 0)`;
    return new Promise((resolve) => setTimeout(resolve, 180));
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

  function requestShellNavigation(href: string, scrollY: number): Promise<void> | null {
    const detail: SwipeNavigationDetail = {
      href,
      scrollY,
      handled: false
    };
    window.dispatchEvent(new CustomEvent<SwipeNavigationDetail>('stats:swipe-navigate', { detail }));
    return detail.handled && detail.complete ? detail.complete : null;
  }

  function handleSwipeMove(end: Point, start: Point): boolean {
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.05) return false;

    const targetHref = targetForDx(dx);
    if (!targetHref) return false;

    if (prefersReducedMotion()) {
      activeTargetHref = targetHref;
      activeDirection = dx < 0 ? -1 : 1;
      return true;
    }

    if (!activeOverlay || activeTargetHref !== targetHref) {
      destroyOverlay();
      activeTargetHref = targetHref;
      activeDirection = dx < 0 ? -1 : 1;
      activeOverlay = createOverlay(targetHref);
      if (!activeOverlay) return true;
      document.body.classList.add('swipe-dragging');
      activeOverlay.next.style.transform = dx < 0 ? 'translate3d(100%, 0, 0)' : 'translate3d(-100%, 0, 0)';
    }

    dragOverlay(dx);
    return true;
  }

  async function finishSwipe(start: Point, end: Point) {
    const now = Date.now();
    if (now - lastSwipeAt < SWIPE_DEDUP_MS) {
      destroyOverlay();
      return;
    }

    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const isValid = Math.abs(dx) >= SWIPE_MIN_X && Math.abs(dx) >= Math.abs(dy) * SWIPE_RATIO;
    if (!isValid || !activeTargetHref) {
      await animateOverlayCancel();
      destroyOverlay();
      return;
    }

    const href = activeTargetHref;
    lastSwipeAt = now;

    const scrollY = window.scrollY;
    const animation = prefersReducedMotion() ? Promise.resolve() : animateOverlayCommit(dx);
    const shellNavigation = requestShellNavigation(href, scrollY);

    if (shellNavigation) {
      const [navigationResult] = await Promise.allSettled([shellNavigation, animation]);
      if (navigationResult.status === 'fulfilled') {
        destroyOverlay();
        return;
      }
    }

    const navigation = goto(href, { noScroll: true, keepFocus: true });
    const [navigationResult] = await Promise.allSettled([navigation, animation]);

    if (navigationResult.status === 'rejected') {
      await animateOverlayCancel();
      destroyOverlay();
      return;
    }

    await tick();
    restoreScrollY(scrollY);
    destroyOverlay();
  }

  function handlePointerUp(event: PointerEvent) {
    if (!activePointer || activePointer.id !== event.pointerId) return;

    const start = activePointer.start;
    activePointer = null;
    void finishSwipe(start, { x: event.clientX, y: event.clientY });
  }

  function handlePointerCancel(event: PointerEvent) {
    if (activePointer?.id === event.pointerId) {
      activePointer = null;
      void animateOverlayCancel().then(destroyOverlay);
    }
  }

  function handlePointerMove(event: PointerEvent) {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    handleSwipeMove({ x: event.clientX, y: event.clientY }, activePointer.start);
  }

  function handleTouchStart(event: TouchEvent) {
    if (!isMobileSwipeTarget() || event.touches.length !== 1) return;
    if (isInteractiveTarget(event.target)) return;

    const touch = event.changedTouches[0];
    activeTouch = {
      id: touch.identifier,
      start: { x: touch.clientX, y: touch.clientY }
    };
    prewarmAdjacentPreviews();
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!activeTouch) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (!touch) return;

    const start = activeTouch.start;
    activeTouch = null;
    void finishSwipe(start, { x: touch.clientX, y: touch.clientY });
  }

  function handleTouchCancel(event: TouchEvent) {
    if (!activeTouch) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (touch) {
      activeTouch = null;
      void animateOverlayCancel().then(destroyOverlay);
    }
  }

  function handleTouchMove(event: TouchEvent) {
    if (!activeTouch) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (!touch) return;
    if (handleSwipeMove({ x: touch.clientX, y: touch.clientY }, activeTouch.start)) {
      event.preventDefault();
    }
  }

  $effect(() => {
    const hrefs = buildWarmupHrefs($page.url, $page.data);
    const key = hrefs.join('\n');
    if (!key || sentWarmups.has(key)) return;
    sentWarmups.add(key);
    scheduleWarmup(hrefs);
  });

  $effect(() => {
    prewarmAdjacentPreviews();
  });

  onMount(() => {
    document.addEventListener('pointerdown', handlePointerDown, { passive: true });
    document.addEventListener('pointermove', handlePointerMove, { passive: true });
    document.addEventListener('pointerup', handlePointerUp, { passive: true });
    document.addEventListener('pointercancel', handlePointerCancel, { passive: true });
    document.addEventListener('touchstart', handleTouchStart, { passive: true });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });
    document.addEventListener('touchend', handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true });
  });

  onDestroy(() => {
    if (!browser) return;

    document.removeEventListener('pointerdown', handlePointerDown);
    document.removeEventListener('pointermove', handlePointerMove);
    document.removeEventListener('pointerup', handlePointerUp);
    document.removeEventListener('pointercancel', handlePointerCancel);
    document.removeEventListener('touchstart', handleTouchStart);
    document.removeEventListener('touchmove', handleTouchMove);
    document.removeEventListener('touchend', handleTouchEnd);
    document.removeEventListener('touchcancel', handleTouchCancel);
    destroyOverlay();

    const idleWindow = window as IdleWindow;
    if (pendingIdle !== null && idleWindow.cancelIdleCallback) idleWindow.cancelIdleCallback(pendingIdle);
    if (pendingTimeout !== null) clearTimeout(pendingTimeout);
  });
</script>
