<script lang="ts">
  import { onMount } from 'svelte';
  import Header from '$lib/home/Header.svelte';
  import Footer from '$lib/home/Footer.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  interface GalleryImage {
    filename: string;
    originalName?: string;
    url?: string;
  }

  let images: GalleryImage[] = [];
  let status = 'Loading photos…';
  let currentIdx = 0;
  let lightboxOpen = false;

  function photoUrl(img: GalleryImage) {
    return img.url || `/uploads/${img.filename}`;
  }

  function variantUrl(img: GalleryImage, width: number) {
    const url = photoUrl(img);
    return url.startsWith('/uploads/') ? `${url}?w=${width}` : url;
  }

  function openLightbox(idx: number) {
    currentIdx = idx;
    lightboxOpen = true;
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lightboxOpen = false;
    document.body.style.overflow = '';
  }

  function prevPhoto() {
    currentIdx = (currentIdx - 1 + images.length) % images.length;
  }

  function nextPhoto() {
    currentIdx = (currentIdx + 1) % images.length;
  }

  onMount(() => {
    fetch('/uploads/manifest.json', { cache: 'no-cache' })
      .then((res) => {
        if (!res.ok) throw new Error('no manifest');
        return res.json();
      })
      .then((manifest) => {
        images = (manifest.images || []).filter((img: GalleryImage) => img.filename);
        status = images.length ? '' : 'No photos yet — check back soon!';
      })
      .catch(() => {
        status = 'No photos yet — check back soon!';
      });

    const onKey = (e: KeyboardEvent) => {
      if (!lightboxOpen) return;
      if (e.key === 'Escape') closeLightbox();
      if (e.key === 'ArrowLeft') prevPhoto();
      if (e.key === 'ArrowRight') nextPhoto();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  });
</script>

<svelte:head>
  <title>{data.meta.title}</title>
  <meta name="description" content={data.meta.description} />
  <link rel="canonical" href={data.meta.canonicalUrl} />
</svelte:head>

<Header />
<main id="main-content" class="min-h-screen bg-warm-50 py-16 px-6">
  <div class="max-w-5xl mx-auto reveal">
    <div class="text-center mb-12">
      <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-3">21 Bristoe</p>
      <h1 class="text-4xl md:text-5xl font-bold text-warm-800 font-display mb-4">Gallery</h1>
      <p class="text-gray-500 text-lg">Photos from around the house and neighborhood.</p>
    </div>

    {#if status}
      <p class="text-center text-warm-500 text-sm py-12">{status}</p>
    {/if}

    <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4" role="list" aria-label="Photo gallery">
      {#each images as img, i}
        <div class="gallery-thumb" role="listitem">
          <button
            class="w-full aspect-square overflow-hidden rounded-xl block cursor-zoom-in focus-visible:ring-2 focus-visible:ring-warm-500"
            aria-label={`View full size: ${img.originalName || img.filename}`}
            type="button"
            on:click={() => openLightbox(i)}
          >
            <img
              src={variantUrl(img, 480)}
              srcset={`${variantUrl(img, 480)} 480w, ${variantUrl(img, 960)} 960w`}
              sizes="(max-width: 640px) 50vw, 33vw"
              alt={img.originalName || img.filename}
              class="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              loading="lazy"
              decoding="async"
            />
          </button>
        </div>
      {/each}
    </div>

    <div class="text-center mt-12">
      <a href="/" class="text-warm-600 hover:text-warm-800 transition-colors text-sm font-medium">← Back to 21 Bristoe</a>
    </div>
  </div>
</main>
<Footer footer={data.footer} />

{#if lightboxOpen && images[currentIdx]}
  <div
    class="gallery-lightbox"
    aria-modal="true"
    role="dialog"
    aria-label="Photo viewer"
    tabindex="-1"
    on:click={(e) => { if (e.currentTarget === e.target) closeLightbox(); }}
    on:keydown={(e) => { if (e.key === 'Escape') closeLightbox(); }}
  >
    <button class="gallery-lb-close" aria-label="Close" on:click={closeLightbox}>✕</button>
    <button class="gallery-lb-prev" aria-label="Previous photo" on:click={prevPhoto}>‹</button>
    <button class="gallery-lb-next" aria-label="Next photo" on:click={nextPhoto}>›</button>
    <img src={photoUrl(images[currentIdx])} alt={images[currentIdx].originalName || images[currentIdx].filename} decoding="async" />
  </div>
{/if}
