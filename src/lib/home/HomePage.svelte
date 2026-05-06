<script lang="ts">
  import Header from './Header.svelte';
  import Footer from './Footer.svelte';
  import Slideshow from './Slideshow.svelte';
  import WeatherCard from './WeatherCard.svelte';
  import type { HomePageData } from './content';

  export let data: HomePageData;

  const fullTitle = data.meta.title;
  const fullOgImage = new URL(data.meta.ogImage, 'https://21bristoe.com').toString();

  function external(href: string) {
    return /^https?:\/\//.test(href) && !href.startsWith('https://21bristoe.com');
  }

  function linkStyle(i: number) {
    return i % 2 === 0
      ? { accent: 'bg-warm-50 border-warm-200 hover:border-warm-400', iconBg: 'bg-warm-100' }
      : { accent: 'bg-sage-50 border-sage-200 hover:border-sage-400', iconBg: 'bg-sage-100' };
  }

  function hideBrokenImage(event: Event) {
    if (event.currentTarget instanceof HTMLImageElement) {
      event.currentTarget.style.display = 'none';
    }
  }
</script>

<svelte:head>
  <title>{fullTitle}</title>
  <meta name="description" content={data.meta.description} />
  <link rel="canonical" href={data.meta.canonicalUrl} />
  <meta property="og:title" content={fullTitle} />
  <meta property="og:description" content={data.meta.description} />
  <meta property="og:image" content={fullOgImage} />
  <meta property="og:url" content={data.meta.canonicalUrl} />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="21 Bristoe" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={fullTitle} />
  <meta name="twitter:description" content={data.meta.description} />
  <meta name="twitter:image" content={fullOgImage} />
  <script type="application/ld+json">
    {JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'WebSite',
          '@id': 'https://21bristoe.com/#website',
          name: '21 Bristoe',
          url: 'https://21bristoe.com',
          description: 'Home of Faber, Kasey, and Limón — Meades Crossing, Taneytown, Maryland.'
        },
        {
          '@type': 'Residence',
          '@id': 'https://21bristoe.com/#home',
          name: '21 Bristoe',
          address: {
            '@type': 'PostalAddress',
            streetAddress: '21 Bristoe Station Rd',
            addressLocality: 'Taneytown',
            addressRegion: 'MD',
            postalCode: '21787',
            addressCountry: 'US'
          },
          description: 'The home of Faber, Kasey, and Limón at Meades Crossing.',
          occupant: [{ '@type': 'Person', name: 'Faber' }, { '@type': 'Person', name: 'Kasey' }]
        }
      ]
    })}
  </script>
</svelte:head>

<div class="scroll-progress" aria-hidden="true"></div>
<a href="#main-content" class="skip-to-content">Skip to main content</a>
<Header />

<main id="main-content">
  <section class="relative w-full min-h-[90vh] md:min-h-screen flex items-center justify-center overflow-hidden" aria-label="Welcome hero">
    <Slideshow />
    <div class="relative z-20 text-center px-6 max-w-4xl mx-auto">
      <p class="text-warm-300 text-sm md:text-base font-medium uppercase tracking-widest mb-4 drop-shadow">{data.hero.preHeading}</p>
      <h1 class="hero-title text-6xl md:text-8xl lg:text-9xl font-bold text-warm-50 mb-6 leading-none drop-shadow-lg">21 Bristoe</h1>
      <p class="text-warm-100 text-xl md:text-2xl mb-4 font-light drop-shadow">{data.hero.subtitle}</p>
      <p class="text-warm-300 text-base md:text-lg flex items-center justify-center gap-2 drop-shadow">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true"><path fill-rule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clip-rule="evenodd"/></svg>
        {data.hero.location}
      </p>
      <a href="#neighborhood" class="scroll-cue mt-16 inline-flex flex-col items-center gap-2 text-warm-200 hover:text-warm-50 transition-colors drop-shadow" aria-label="Scroll to neighborhood">
        <span class="text-xs uppercase tracking-widest">Explore</span>
        <svg class="w-5 h-5 scroll-cue-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
      </a>
    </div>
  </section>

  <div class="w-full bg-warm-900 text-warm-300 py-2 px-6" role="complementary" aria-label="Daily sky info for Taneytown, MD">
    <div class="max-w-5xl mx-auto flex flex-wrap items-center justify-center gap-x-6 gap-y-1 text-xs">
      <span>🌅 Sunrise <strong class="font-medium text-warm-200">{data.sky.sunrise}</strong></span>
      <span class="text-warm-700 hidden sm:inline" aria-hidden="true">·</span>
      <span>🌇 Sunset <strong class="font-medium text-warm-200">{data.sky.sunset}</strong></span>
      <span class="text-warm-700 hidden sm:inline" aria-hidden="true">·</span>
      <span aria-label={`Moon phase: ${data.sky.moonName}`}>{data.sky.moonEmoji} <strong class="font-medium text-warm-200">{data.sky.moonName}</strong></span>
      <span class="text-warm-700 hidden sm:inline" aria-hidden="true">·</span>
      <span class="text-warm-600">Taneytown, MD</span>
    </div>
  </div>

  <section class="py-20 px-6 bg-warm-50" aria-labelledby="welcome-heading">
    <div class="max-w-5xl mx-auto reveal">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div>
          <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-3">{data.welcome.label}</p>
          <h2 id="welcome-heading" class="text-4xl md:text-5xl font-bold text-warm-800 mb-3 font-display">{data.welcome.heading}</h2>
          <p class="text-warm-500 italic text-sm mb-6">{data.welcome.seasonalNote}</p>
          <div class="space-y-4 text-gray-600 leading-relaxed">
            {#each data.welcome.paragraphs as paragraph}
              <p>{paragraph}</p>
            {/each}
          </div>
        </div>
        <div class="rounded-3xl overflow-hidden aspect-[4/3] bg-gradient-to-br from-warm-200 via-warm-300 to-sage-300 flex items-center justify-center shadow-xl" aria-hidden="true">
          <div class="text-center text-warm-700 p-8">
            <div class="text-7xl mb-4">🏡</div>
            <p class="font-medium text-lg font-display">{data.welcome.accentAddress}</p>
            <p class="text-sm text-warm-600 mt-1">{data.welcome.accentCity}</p>
          </div>
        </div>
      </div>

      <div class="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-6">
        {#each data.welcome.members as member}
          <div class={`rounded-2xl border p-6 shadow-sm ${member.cardClass}`}>
            {#if member.photoFile}
              <img class="mb-3 w-16 h-16 rounded-full object-cover" src={`/uploads/${member.photoFile}`} alt={member.name} />
            {:else}
              <div class="text-3xl mb-3" aria-hidden="true">{member.emoji}</div>
            {/if}
            <h3 class="text-warm-800 font-bold text-lg font-display mb-0.5">{member.name}</h3>
            <p class="text-warm-500 text-xs font-medium uppercase tracking-wide mb-3">{member.role}</p>
            <p class="text-gray-600 text-sm leading-relaxed">{member.bio}</p>
          </div>
        {/each}
      </div>
    </div>
  </section>

  <section id="neighborhood" class="py-20 px-6 bg-white" aria-labelledby="neighborhood-heading">
    <div class="max-w-5xl mx-auto reveal">
      <div class="text-center mb-14">
        <p class="text-sage-600 text-sm font-medium uppercase tracking-widest mb-2">{data.neighborhood.label}</p>
        <h2 id="neighborhood-heading" class="text-4xl md:text-5xl font-bold text-warm-800 mb-4 font-display">{data.neighborhood.heading}</h2>
        <p class="text-gray-500 text-lg max-w-2xl mx-auto">{data.neighborhood.description}</p>
      </div>
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        {#each data.neighborhood.highlights as item}
          <article class="bg-warm-50 rounded-2xl p-8 border border-warm-100 hover:border-warm-300 hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ease-out">
            <div class="text-4xl mb-4" aria-hidden="true">{item.icon}</div>
            <h3 class="text-xl font-semibold text-warm-800 mb-3 font-display">{item.title}</h3>
            <p class="text-gray-600 leading-relaxed">{item.description}</p>
          </article>
        {/each}
      </div>
    </div>
  </section>

  <section id="limon" class="py-20 px-6 bg-gradient-to-br from-warm-100 to-warm-50" aria-labelledby="limon-heading">
    <div class="max-w-5xl mx-auto reveal">
      <div class="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        <div class="order-2 md:order-1 rounded-3xl overflow-hidden aspect-square shadow-2xl relative bg-gradient-to-br from-warm-300 via-warm-400 to-warm-500" aria-label="Limón the golden retriever">
          <div class="absolute inset-0 bg-gradient-to-br from-warm-300 via-warm-400 to-warm-500 flex items-center justify-center">
            <div class="relative text-center p-8">
              <div class="text-8xl mb-4" role="img" aria-label="Dog emoji">🐕</div>
              <p class="text-warm-900 font-bold text-2xl font-display">{data.limon.name}</p>
              <p class="text-warm-800 text-sm mt-1">{data.limon.fallbackSubtitle}</p>
            </div>
          </div>
          <img src="/uploads/limon-profile.jpg" alt="Limón the golden retriever" class="relative z-10 w-full h-full object-cover" on:error={hideBrokenImage} />
        </div>
        <div class="order-1 md:order-2">
          <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-3">{data.limon.sectionLabel}</p>
          <h2 id="limon-heading" class="text-4xl md:text-5xl font-bold text-warm-800 mb-6 font-display">{data.limon.name}</h2>
          <p class="text-gray-600 leading-relaxed mb-8">{data.limon.bio}</p>
          <dl class="grid grid-cols-2 gap-4">
            {#each data.limon.facts as fact}
              <div class="bg-white rounded-xl p-4 border border-warm-200 shadow-sm">
                <dt class="text-xs font-semibold text-warm-500 uppercase tracking-wide mb-1">{fact.label}</dt>
                <dd class="text-warm-800 font-medium text-sm">{fact.value}</dd>
              </div>
            {/each}
          </dl>
          <blockquote class="mt-8 pl-4 border-l-4 border-warm-400">
            <p class="text-warm-700 italic text-base leading-relaxed">"{data.limon.quote}"</p>
            <cite class="text-warm-500 text-sm mt-2 block not-italic">— {data.limon.quoteAttribution}</cite>
          </blockquote>
        </div>
      </div>
    </div>
  </section>

  <section id="quicklinks" class="py-20 px-6 bg-white" aria-labelledby="quicklinks-heading">
    <div class="max-w-5xl mx-auto reveal">
      <div class="text-center mb-14">
        <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-2">{data.quickLinks.label}</p>
        <h2 id="quicklinks-heading" class="text-4xl md:text-5xl font-bold text-warm-800 mb-4 font-display">{data.quickLinks.heading}</h2>
        <p class="text-gray-500 text-lg max-w-xl mx-auto">{data.quickLinks.description}</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
        {#each data.quickLinks.links as link, i}
          {@const style = linkStyle(i)}
          <a
            href={link.href}
            class={`group flex gap-5 p-6 rounded-2xl border-2 transition-all duration-200 shadow-sm hover:shadow-md hover:-translate-y-0.5 ${style.accent}`}
            target={external(link.href) ? '_blank' : undefined}
            rel={external(link.href) ? 'noopener noreferrer' : undefined}
            aria-label={external(link.href) ? `${link.title} (opens in new tab)` : link.title}
          >
            <div class={`flex-shrink-0 w-12 h-12 rounded-xl ${style.iconBg} flex items-center justify-center text-2xl`} aria-hidden="true">{link.icon}</div>
            <div class="flex-1 min-w-0">
              <h3 class="font-semibold text-warm-800 group-hover:text-warm-600 transition-colors flex items-center gap-2">{link.title}</h3>
              <p class="text-gray-500 text-sm mt-1 leading-relaxed">{link.description}</p>
            </div>
          </a>
          {#if i === 0}
            <WeatherCard weather={data.weather} />
          {/if}
        {/each}
      </div>
    </div>
  </section>

  <section class="py-16 px-6 bg-warm-100" aria-labelledby="visitor-heading">
    <div class="max-w-5xl mx-auto reveal">
      <div class="text-center mb-10">
        <p class="text-warm-500 text-sm font-medium uppercase tracking-widest mb-2">{data.visitorGuide.label}</p>
        <h2 id="visitor-heading" class="text-3xl md:text-4xl font-bold text-warm-800 font-display">{data.visitorGuide.heading}</h2>
        <p class="text-gray-500 text-base mt-3 max-w-md mx-auto">{data.visitorGuide.description}</p>
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mx-auto">
        {#each data.visitorGuide.tips as tip}
          <details class="bg-white rounded-2xl border border-warm-200 shadow-sm overflow-hidden">
            <summary class="flex items-center gap-3 px-5 py-4 cursor-pointer select-none text-warm-800 font-semibold hover:bg-warm-50 transition-colors">
              <span class="text-xl flex-shrink-0" aria-hidden="true">{tip.icon}</span>
              <span>{tip.title}</span>
              <svg class="ml-auto w-4 h-4 text-warm-400 chevron transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <p class="px-5 pb-5 pt-2 text-gray-600 text-sm leading-relaxed border-t border-warm-100">{tip.body}</p>
          </details>
        {/each}
      </div>
    </div>
  </section>
</main>

<Footer footer={data.footer} />

<style>
  .hero-title { font-family: var(--font-display); }
  @keyframes scroll-bob {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50% { transform: translateY(6px); opacity: 1; }
  }
  .scroll-cue-chevron { animation: scroll-bob 1.8s ease-in-out infinite; }
  details[open] .chevron { transform: rotate(180deg); }
  summary { list-style: none; }
  summary::-webkit-details-marker { display: none; }
  @media (prefers-reduced-motion: reduce) {
    .scroll-cue-chevron { animation: none; opacity: 0.8; }
  }
</style>
