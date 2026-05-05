<script lang="ts">
  import { browser } from '$app/environment';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';
  import { appPath, routePath } from '$lib/app-paths';
  import { drinkSections, sectionIndexForPath } from '$lib/drink-sections';
  import { onDestroy, onMount, tick } from 'svelte';

  const SWIPE_MIN_X = 70;
  const SWIPE_RATIO = 1.5;
  const SWIPE_DEDUP_MS = 500;
  const SWIPE_PAGE_OVERLAP_PX = 2;
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
    '.drink-shell__nav',
    '.hubnav'
  ].join(',');

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

  let activePointer: { id: number; start: Point } | null = null;
  let activeTouch: { id: number; start: Point } | null = null;
  let lastSwipeAt = 0;
  let activeOverlay: SwipeOverlay | null = null;
  let activeTargetHref: string | null = null;
  let activeDirection: -1 | 1 = -1;
  const previewCache = new Map<string, string>();

  function isMobileSwipeTarget(): boolean {
    return browser && window.innerWidth <= 900 && window.matchMedia('(pointer: coarse), (hover: none)').matches;
  }

  function prefersReducedMotion(): boolean {
    return browser && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function isInteractiveTarget(target: EventTarget | null): boolean {
    return target instanceof Element && Boolean(target.closest(INTERACTIVE_SELECTOR));
  }

  function targetForDx(dx: number): string | null {
    const currentIndex = sectionIndexForPath(routePath($page.url.pathname));
    if (currentIndex === -1) return null;
    const nextIndex = dx < 0 ? currentIndex + 1 : currentIndex - 1;
    return drinkSections[nextIndex]?.href ?? null;
  }

  function readMainPreview(html: string): string | null {
    try {
      const parsed = new DOMParser().parseFromString(html, 'text/html');
      const main = parsed.querySelector('.drink-shell__main');
      if (!main) return null;
      main.removeAttribute('id');
      return main.outerHTML;
    } catch {
      return null;
    }
  }

  async function loadPreviewHtml(href: string): Promise<string | null> {
    if (previewCache.has(href)) return previewCache.get(href) ?? null;
    try {
      const response = await fetch(appPath(href), { credentials: 'same-origin' });
      if (!response.ok) return null;
      const preview = readMainPreview(await response.text());
      if (preview) previewCache.set(href, preview);
      return preview;
    } catch {
      return null;
    }
  }

  function destroyOverlay() {
    activeOverlay?.root.remove();
    activeOverlay = null;
    activeTargetHref = null;
    document.body.classList.remove('drink-swipe-dragging');
  }

  function createOverlay(targetHref: string): SwipeOverlay | null {
    const main = document.querySelector<HTMLElement>('.drink-shell__main');
    if (!main) return null;

    const rect = main.getBoundingClientRect();
    const root = document.createElement('div');
    root.className = 'drink-swipe-overlay';
    root.style.left = `${Math.round(rect.left)}px`;
    root.style.top = `${Math.round(rect.top)}px`;
    root.style.width = `${Math.round(rect.width)}px`;
    root.style.height = `${Math.round(rect.height)}px`;

    const current = document.createElement('div');
    current.className = 'drink-swipe-page drink-swipe-page--current';
    current.append(main.cloneNode(true));

    const next = document.createElement('div');
    next.className = 'drink-swipe-page drink-swipe-page--next';
    next.innerHTML = '<main class="drink-shell__main"><div class="drink-swipe-preview-loading"></div></main>';

    root.append(current, next);
    document.body.append(root);

    void loadPreviewHtml(targetHref).then((preview) => {
      if (!activeOverlay || activeTargetHref !== targetHref || !preview) return;
      next.innerHTML = preview;
    });

    return { root, current, next, width: rect.width };
  }

  function dragOverlay(dx: number) {
    if (!activeOverlay) return;
    const width = Math.max(activeOverlay.width, 1);
    const direction = dx < 0 ? -1 : 1;
    const nextStart = direction < 0 ? width : -width;
    const nextOffset = nextStart + dx + direction * SWIPE_PAGE_OVERLAP_PX;
    const fade = Math.max(0.76, 1 - Math.min(1, Math.abs(dx) / width) * 0.18);

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
    activeOverlay.current.style.opacity = '0.82';
    activeOverlay.next.style.transform = 'translate3d(0, 0, 0)';
    return new Promise((resolve) => setTimeout(resolve, 210));
  }

  function animateOverlayCancel(): Promise<void> {
    if (!activeOverlay) return Promise.resolve();
    activeOverlay.current.style.transition = 'transform 170ms ease-out, opacity 170ms ease-out';
    activeOverlay.next.style.transition = 'transform 170ms ease-out';
    activeOverlay.current.style.transform = 'translate3d(0, 0, 0)';
    activeOverlay.current.style.opacity = '1';
    activeOverlay.next.style.transform = `translate3d(${activeDirection < 0 ? '100%' : '-100%'}, 0, 0)`;
    return new Promise((resolve) => setTimeout(resolve, 180));
  }

  function restoreScrollY(scrollY: number) {
    const html = document.documentElement;
    const previousScrollBehavior = html.style.scrollBehavior;
    const maxScrollY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
    html.style.scrollBehavior = 'auto';
    window.scrollTo({ left: window.scrollX, top: Math.min(scrollY, maxScrollY), behavior: 'auto' });
    html.style.scrollBehavior = previousScrollBehavior;
  }

  function requestShellNavigation(href: string, scrollY: number): Promise<void> | null {
    const detail: SwipeNavigationDetail = { href, scrollY, handled: false };
    window.dispatchEvent(new CustomEvent<SwipeNavigationDetail>('drink:swipe-navigate', { detail }));
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
      activeOverlay = createOverlay(targetHref);
      if (!activeOverlay) return false;
      document.body.classList.add('drink-swipe-dragging');
      activeDirection = dx < 0 ? -1 : 1;
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

    const navigation = goto(appPath(href), { noScroll: true, keepFocus: true });
    const [navigationResult] = await Promise.allSettled([navigation, animation]);
    if (navigationResult.status === 'fulfilled') {
      await tick();
      restoreScrollY(scrollY);
    }
    destroyOverlay();
  }

  function handlePointerDown(event: PointerEvent) {
    if (!isMobileSwipeTarget() || !event.isPrimary || event.pointerType === 'mouse') return;
    if (isInteractiveTarget(event.target)) return;
    activePointer = { id: event.pointerId, start: { x: event.clientX, y: event.clientY } };
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
  }

  function handleTouchMove(event: TouchEvent) {
    if (!activeTouch) return;
    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (!touch) return;
    if (handleSwipeMove({ x: touch.clientX, y: touch.clientY }, activeTouch.start)) event.preventDefault();
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
  });
</script>
