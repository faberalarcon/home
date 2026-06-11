<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { onDestroy, onMount, tick } from 'svelte';
  import type { SwipeEnhancerConfig } from './types';

  const WARMUP_BATCH_SIZE = 40;
  const PREVIEW_CACHE_LIMIT = 6;
  const SWIPE_PAGE_OVERLAP_PX = 2;
  const SWIPE_MIN_X = 70;
  const SWIPE_RATIO = 1.5;
  const SWIPE_DEDUP_MS = 500;

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

  let { config }: { config: SwipeEnhancerConfig } = $props();

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

  function canWarmup(): boolean {
    if (!browser) return false;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connection?.saveData !== true;
  }

  async function postWarmup(hrefs: string[]) {
    if (!hrefs.length || !canWarmup() || !config.warmupPath) return;
    for (let i = 0; i < hrefs.length; i += WARMUP_BATCH_SIZE) {
      await fetch(config.appPath(config.warmupPath), {
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

  function prewarmAdjacentPreviews() {
    const hrefs = adjacentSectionHrefs();
    if (!browser || !hrefs.length || !canWarmup()) return;

    const pendingHrefs = [...new Set(hrefs)].filter((href) => !previewCache.has(href));
    if (!pendingHrefs.length) return;
    void Promise.all(pendingHrefs.map((href) => loadPreviewHtml(href)));
  }

  function isMobileSwipeTarget(): boolean {
    return browser && window.innerWidth <= 900 && window.matchMedia('(pointer: coarse), (hover: none)').matches;
  }

  function prefersReducedMotion(): boolean {
    return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(config.interactiveSelector));
  }

  function fixedHeaderHeight(): number {
    if (!config.headerHeightVar) return 0;
    const cssValue = getComputedStyle(document.documentElement)
      .getPropertyValue(config.headerHeightVar)
      .trim();
    const cssPixels = Number.parseFloat(cssValue);
    if (Number.isFinite(cssPixels) && cssPixels > 0) return cssPixels;

    const header = config.fixedHeaderSelector ? document.querySelector(config.fixedHeaderSelector) : null;
    return header instanceof HTMLElement ? header.getBoundingClientRect().height : 0;
  }

  function targetForDx(dx: number): string | null {
    const currentIndex = config.sectionIndexForPath(config.routePath($page.url.pathname));
    if (currentIndex === -1) return null;
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    return config.sections[nextIndex]?.href ?? null;
  }

  function adjacentSectionHrefs(): string[] {
    const currentIndex = config.sectionIndexForPath(config.routePath($page.url.pathname));
    if (currentIndex === -1) return [];
    return [config.sections[currentIndex - 1]?.href, config.sections[currentIndex + 1]?.href].filter(
      (href): href is string => Boolean(href)
    );
  }

  function readMainPreview(html: string): string | null {
    try {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const main = parsed.querySelector(config.mainSelector);
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
      const response = await fetch(config.appPath(href), { credentials: 'same-origin' });
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
    document.body.classList.remove(config.draggingBodyClass);
  }

  function createSwipeContent(contentOffsetY: number): HTMLDivElement {
    const content = document.createElement('div');
    content.className = `${config.pageClass}__content`;
    content.style.transform = `translate3d(0, ${Math.round(contentOffsetY)}px, 0)`;
    return content;
  }

  function createOverlay(targetHref: string): SwipeOverlay | null {
    const main = document.querySelector<HTMLElement>(config.mainSelector);
    if (!main) return null;

    const targetPreview = previewCache.get(targetHref) ?? null;
    if (!targetPreview && !config.placeholderHtml) {
      void loadPreviewHtml(targetHref);
      return null;
    }

    const rect = main.getBoundingClientRect();
    const headerOffset = Boolean(config.headerHeightVar);
    const overlayTop = headerOffset ? fixedHeaderHeight() : rect.top;
    const root = document.createElement('div');
    root.className = config.overlayClass;
    root.style.left = `${Math.round(rect.left)}px`;
    root.style.top = `${Math.round(overlayTop)}px`;
    root.style.width = `${Math.round(rect.width)}px`;
    root.style.height = headerOffset
      ? `${Math.round(Math.max(1, window.innerHeight - overlayTop))}px`
      : `${Math.round(rect.height)}px`;

    const contentOffsetY = rect.top - overlayTop;
    const currentMain = main.cloneNode(true) as HTMLElement;
    currentMain.removeAttribute('id');

    const current = document.createElement('div');
    current.className = `${config.pageClass} ${config.pageClass}--current`;
    const next = document.createElement('div');
    next.className = `${config.pageClass} ${config.pageClass}--next`;

    // Header-offset mode wraps pages in a translated content element (stats CSS);
    // otherwise pages are filled directly so direct-child selectors keep working.
    let nextTarget: HTMLElement = next;
    if (headerOffset) {
      const currentContent = createSwipeContent(contentOffsetY);
      currentContent.append(currentMain);
      current.append(currentContent);
      nextTarget = createSwipeContent(contentOffsetY);
      next.append(nextTarget);
    } else {
      current.append(currentMain);
    }
    nextTarget.innerHTML = targetPreview ?? config.placeholderHtml ?? '';

    root.append(current, next);
    document.body.append(root);

    if (!targetPreview) {
      void loadPreviewHtml(targetHref).then((preview) => {
        if (!activeOverlay || activeTargetHref !== targetHref || !preview) return;
        nextTarget.innerHTML = preview;
      });
    }

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
    const detail: SwipeNavigationDetail = { href, scrollY, handled: false };
    window.dispatchEvent(new CustomEvent<SwipeNavigationDetail>(config.navEventName, { detail }));
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
      if (!activeOverlay) return !config.placeholderHtml;
      document.body.classList.add(config.draggingBodyClass);
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

    const navigation = goto(config.appPath(href), { noScroll: true, keepFocus: true });
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

  function handlePointerDown(event: PointerEvent) {
    if (!isMobileSwipeTarget() || !event.isPrimary || event.pointerType === 'mouse') return;
    if (isInteractiveTarget(event.target)) return;
    activePointer = { id: event.pointerId, start: { x: event.clientX, y: event.clientY } };
    prewarmAdjacentPreviews();
  }

  function handlePointerMove(event: PointerEvent) {
    if (!activePointer || activePointer.id !== event.pointerId) return;
    handleSwipeMove({ x: event.clientX, y: event.clientY }, activePointer.start);
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

  function handleTouchStart(event: TouchEvent) {
    if (!isMobileSwipeTarget() || event.touches.length !== 1) return;
    if (isInteractiveTarget(event.target)) return;

    const touch = event.changedTouches[0];
    activeTouch = { id: touch.identifier, start: { x: touch.clientX, y: touch.clientY } };
    prewarmAdjacentPreviews();
  }

  function handleTouchMove(event: TouchEvent) {
    if (!activeTouch) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (!touch) return;
    if (handleSwipeMove({ x: touch.clientX, y: touch.clientY }, activeTouch.start)) {
      event.preventDefault();
    }
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

  $effect(() => {
    if (!config.buildWarmupHrefs || !config.warmupPath) return;
    const hrefs = config.buildWarmupHrefs($page.url, $page.data);
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
