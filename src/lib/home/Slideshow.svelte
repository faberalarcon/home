<script lang="ts">
  import { onMount } from 'svelte';

  interface SlideImage {
    filename: string;
    originalName?: string;
    url?: string;
  }

  let images: SlideImage[] = [];
  let current = 0;
  let timer: ReturnType<typeof setInterval> | null = null;
  let slideshowEl: HTMLDivElement;

  let activeTouch: { id: number; x: number; y: number } | null = null;
  let suppressNextClick = false;
  let suppressClickTimer: ReturnType<typeof setTimeout> | null = null;

  function imageUrl(img: SlideImage) {
    const url = img.url || `/uploads/${img.filename}`;
    return url.startsWith('/uploads/') ? `${url}?w=1440` : url;
  }

  // Only the current slide and its neighbors are mounted, so a full gallery
  // isn't downloaded on home page load; the crossfade only ever needs ±1.
  function isNearCurrent(index: number, activeIndex: number, count: number): boolean {
    if (count <= 3) return true;
    const diff = (index - activeIndex + count) % count;
    return diff <= 1 || diff === count - 1;
  }

  function goTo(index: number) {
    if (images.length === 0) return;
    current = (index + images.length) % images.length;
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    if (images.length > 1) timer = setInterval(() => goTo(current + 1), 6000);
  }

  function pauseTimer() {
    if (timer) clearInterval(timer);
    timer = null;
  }

  function gestureRoot() {
    return slideshowEl?.closest('section');
  }

  function eventStartedInHero(event: Event) {
    const target = event.target;
    return target instanceof Node && !!gestureRoot()?.contains(target);
  }

  function suppressGalleryClick() {
    suppressNextClick = true;
    if (suppressClickTimer) clearTimeout(suppressClickTimer);
    suppressClickTimer = setTimeout(() => {
      suppressNextClick = false;
      suppressClickTimer = null;
    }, 400);
  }

  function handleDocumentClick(event: MouseEvent) {
    if (!suppressNextClick || !eventStartedInHero(event)) return;
    event.preventDefault();
    event.stopPropagation();
    suppressNextClick = false;
  }

  function handleTouchStart(event: TouchEvent) {
    if (images.length <= 1 || event.touches.length !== 1 || !eventStartedInHero(event)) return;

    const touch = event.changedTouches[0];
    activeTouch = { id: touch.identifier, x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: TouchEvent) {
    if (!activeTouch || !eventStartedInHero(event)) return;

    const touch = Array.from(event.changedTouches).find((item) => item.identifier === activeTouch?.id);
    if (!touch) return;

    const dx = touch.clientX - activeTouch.x;
    const dy = touch.clientY - activeTouch.y;
    const horizontalSwipe = Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4;
    activeTouch = null;

    if (!horizontalSwipe) return;

    event.preventDefault();
    event.stopPropagation();
    goTo(dx < 0 ? current + 1 : current - 1);
    resetTimer();
    suppressGalleryClick();
  }

  function handleTouchCancel(event: TouchEvent) {
    if (!activeTouch || !eventStartedInHero(event)) return;
    activeTouch = null;
  }

  onMount(() => {
    let cancelled = false;

    document.addEventListener('touchstart', handleTouchStart, { passive: true, capture: true });
    document.addEventListener('touchend', handleTouchEnd, { passive: false, capture: true });
    document.addEventListener('touchcancel', handleTouchCancel, { passive: true, capture: true });
    document.addEventListener('click', handleDocumentClick, true);

    fetch('/uploads/manifest.json', { cache: 'no-cache' })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        images = (data.images || []).filter((img: SlideImage) => img.url || img.filename);
        resetTimer();
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
      if (suppressClickTimer) clearTimeout(suppressClickTimer);
      document.removeEventListener('touchstart', handleTouchStart, true);
      document.removeEventListener('touchend', handleTouchEnd, true);
      document.removeEventListener('touchcancel', handleTouchCancel, true);
      document.removeEventListener('click', handleDocumentClick, true);
    };
  });
</script>

<div
  bind:this={slideshowEl}
  class="slideshow"
  aria-label="Family photo slideshow"
  role="region"
  on:mouseenter={pauseTimer}
  on:mouseleave={resetTimer}
>
  {#if images.length === 0}
    <div class="slide-fallback absolute inset-0 bg-gradient-to-br from-warm-800 via-warm-700 to-sage-700" aria-hidden="true"></div>
  {:else}
    {#each images as img, i}
      {#if isNearCurrent(i, current, images.length)}
        <a
          href="/gallery/"
          class={`bristoe-slide ${i === current ? 'active' : ''}`}
          style={`background-image: url(${JSON.stringify(imageUrl(img))})`}
          aria-label={`Photo ${i + 1} of ${images.length} — view gallery`}
          tabindex="-1"
        ></a>
      {/if}
    {/each}
  {/if}

  {#if images.length > 1}
    <button class="slide-arrow slide-arrow--prev" aria-label="Previous photo" on:click={() => { goTo(current - 1); resetTimer(); }}>&#8249;</button>
    <button class="slide-arrow slide-arrow--next" aria-label="Next photo" on:click={() => { goTo(current + 1); resetTimer(); }}>&#8250;</button>
    <div class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-20" role="tablist" aria-label="Slideshow navigation">
      {#each images as _, i}
        <button
          class={`bristoe-slide-dot ${i === current ? 'active' : ''}`}
          role="tab"
          aria-label={`Go to photo ${i + 1}`}
          aria-selected={i === current ? 'true' : 'false'}
          on:click={() => { goTo(i); resetTimer(); }}
        ></button>
      {/each}
    </div>
  {/if}
</div>

<style>
  .slideshow {
    position: absolute;
    inset: 0;
    overflow: hidden;
    touch-action: pan-y;
  }

  :global(.bristoe-slide) {
    touch-action: pan-y;
  }
  .slide-arrow {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    z-index: 20;
    background: rgba(0, 0, 0, 0.35);
    color: white;
    border: none;
    border-radius: 50%;
    width: 2.5rem;
    height: 2.5rem;
    font-size: 1.6rem;
    line-height: 1;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s, background 0.2s;
    padding: 0 0 2px;
  }
  .slideshow:hover .slide-arrow,
  .slideshow:focus-within .slide-arrow { opacity: 1; }
  .slide-arrow:hover { background: rgba(0, 0, 0, 0.6); }
  .slide-arrow--prev { left: 0.75rem; }
  .slide-arrow--next { right: 0.75rem; }
</style>
