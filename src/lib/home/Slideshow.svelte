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

  function imageUrl(img: SlideImage) {
    return img.url || `/uploads/${img.filename}`;
  }

  function goTo(index: number) {
    if (images.length === 0) return;
    current = (index + images.length) % images.length;
  }

  function resetTimer() {
    if (timer) clearInterval(timer);
    if (images.length > 1) timer = setInterval(() => goTo(current + 1), 6000);
  }

  onMount(() => {
    let cancelled = false;
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
    };
  });
</script>

<div class="slideshow" aria-label="Family photo slideshow" role="region">
  {#if images.length === 0}
    <div class="slide-fallback absolute inset-0 bg-gradient-to-br from-warm-800 via-warm-700 to-sage-700" aria-hidden="true"></div>
  {:else}
    {#each images as img, i}
      <a
        href="/gallery"
        class={`bristoe-slide ${i === current ? 'active' : ''}`}
        style={`background-image: url(${JSON.stringify(imageUrl(img))})`}
        aria-label={`Photo ${i + 1} of ${images.length} — view gallery`}
        tabindex="-1"
      ></a>
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
