<script lang="ts">
  import Header from './Header.svelte';
  import Footer from './Footer.svelte';
  import Slideshow from './Slideshow.svelte';
  import WeatherCard from './WeatherCard.svelte';
  import ActionCard from '$lib/components/ActionCard.svelte';
  import BristoeCard from '$lib/components/BristoeCard.svelte';
  import LiveBadge from '$lib/components/LiveBadge.svelte';
  import MetricTile from '$lib/components/MetricTile.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import type { StatusTone } from '$lib/components/StatusPill.svelte';
  import type { HomePageData } from './content';

  export let data: HomePageData;

  const fullTitle = data.meta.title;
  const fullOgImage = new URL(data.meta.ogImage, 'https://21bristoe.com').toString();

  interface TodayMetric {
    label: string;
    value: string;
    detail: string;
    icon: string;
    href: string;
    status: StatusTone;
  }

  const todayMetrics: TodayMetric[] = [
    {
      label: 'Drinks',
      value: 'Menu',
      detail: 'Recipes, orders, and the house leaderboard',
      icon: '🍹',
      href: '/drinks/',
      status: 'ok'
    },
    {
      label: 'Stats',
      value: 'Live',
      detail: 'Systems, backups, visitors, and telemetry',
      icon: '📊',
      href: '/stats/',
      status: 'ok'
    },
    {
      label: 'Visitors',
      value: 'Ready',
      detail: 'Parking, door notes, Wi-Fi, and arrivals',
      icon: '🧭',
      href: '#visitor-guide',
      status: 'neutral'
    },
    {
      label: 'Limón',
      value: 'Home',
      detail: 'Resident welcome committee on duty',
      icon: '🐕',
      href: '#limon',
      status: 'neutral'
    }
  ];

  const skyDetail = `Sunrise ${data.sky.sunrise} · sunset ${data.sky.sunset}`;
  const weatherBadge = data.weather ? `Weather ${data.weather.fetchedAt}` : 'Weather link';

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
      <a href="#today" class="scroll-cue mt-16 inline-flex flex-col items-center gap-2 text-warm-200 hover:text-warm-50 transition-colors drop-shadow" aria-label="Scroll to today's household dashboard">
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

  <section id="today" class="home-section home-section--today" aria-labelledby="today-heading">
    <div class="home-wrap reveal">
      <div class="home-heading-row">
        <SectionHeader
          id="today-heading"
          eyebrow="Today at 21 Bristoe"
          title="Household command center"
          description="Current weather, house apps, visitor notes, and the fastest paths into the parts of the site we actually use."
          class="home-section-heading"
        />
        <LiveBadge label="Live" detail={weatherBadge} status={data.weather ? 'ok' : 'watch'} />
      </div>

      <div class="today-grid">
        <WeatherCard weather={data.weather} />
        <MetricTile
          label="Sky"
          value={data.sky.moonName}
          detail={skyDetail}
          icon={data.sky.moonEmoji}
        />
        {#each todayMetrics as card}
          <MetricTile
            label={card.label}
            value={card.value}
            detail={card.detail}
            icon={card.icon}
            href={card.href}
            status={card.status}
          />
        {/each}
      </div>
    </div>
  </section>

  <section id="quicklinks" class="home-section home-section--actions" aria-labelledby="quicklinks-heading">
    <div class="home-wrap reveal">
      <SectionHeader
        id="quicklinks-heading"
        eyebrow={data.quickLinks.label}
        title={data.quickLinks.heading}
        description={data.quickLinks.description}
        class="home-section-heading home-section-heading--center"
      />
      <div class="action-grid">
        {#each data.quickLinks.links as link}
          <ActionCard
            href={link.href}
            title={link.title}
            description={link.description}
            icon={link.icon}
            eyebrow="House link"
          />
        {/each}
      </div>
    </div>
  </section>

  <section class="home-section home-section--household" aria-labelledby="welcome-heading">
    <div class="home-wrap reveal">
      <div class="household-grid">
        <div>
          <SectionHeader
            id="welcome-heading"
            eyebrow={data.welcome.label}
            title={data.welcome.heading}
            description={data.welcome.seasonalNote}
            class="home-section-heading"
          />
          <div class="home-copy">
            {#each data.welcome.paragraphs as paragraph}
              <p>{paragraph}</p>
            {/each}
          </div>
        </div>

        <BristoeCard variant="feature" class="home-address-card">
          <div class="home-address-card__icon" aria-hidden="true">🏡</div>
          <p>{data.welcome.accentAddress}</p>
          <span>{data.welcome.accentCity}</span>
        </BristoeCard>
      </div>

      <div class="member-grid">
        {#each data.welcome.members as member}
          <BristoeCard variant={member.name === 'Limón' ? 'feature' : 'soft'} class={`home-member-card ${member.cardClass}`}>
            {#if member.photoFile}
              <img class="home-member-card__photo" src={`/uploads/${member.photoFile}`} alt={member.name} />
            {:else}
              <div class="home-member-card__emoji" aria-hidden="true">{member.emoji}</div>
            {/if}
            <h3>{member.name}</h3>
            <p class="home-member-card__role">{member.role}</p>
            <p>{member.bio}</p>
          </BristoeCard>
        {/each}
      </div>
    </div>
  </section>

  <section id="limon" class="home-section home-section--limon" aria-labelledby="limon-heading">
    <div class="home-wrap reveal">
      <div class="limon-grid">
        <div class="limon-photo" aria-label="Limón the golden retriever">
          <div class="limon-photo__fallback">
            <div role="img" aria-label="Dog emoji">🐕</div>
            <p>{data.limon.name}</p>
            <span>{data.limon.fallbackSubtitle}</span>
          </div>
          <img src="/uploads/limon-profile.jpg" alt="Limón the golden retriever" on:error={hideBrokenImage} />
        </div>

        <div>
          <SectionHeader
            id="limon-heading"
            eyebrow={data.limon.sectionLabel}
            title={data.limon.name}
            description={data.limon.bio}
            class="home-section-heading"
          />
          <dl class="fact-grid">
            {#each data.limon.facts as fact}
              <div class="fact-card">
                <dt>{fact.label}</dt>
                <dd>{fact.value}</dd>
              </div>
            {/each}
          </dl>
          <blockquote class="limon-quote">
            <p>"{data.limon.quote}"</p>
            <cite>— {data.limon.quoteAttribution}</cite>
          </blockquote>
        </div>
      </div>
    </div>
  </section>

  <section id="neighborhood" class="home-section home-section--neighborhood" aria-labelledby="neighborhood-heading">
    <div class="home-wrap reveal">
      <SectionHeader
        id="neighborhood-heading"
        eyebrow={data.neighborhood.label}
        title={data.neighborhood.heading}
        description={data.neighborhood.description}
        class="home-section-heading home-section-heading--center"
      />
      <div class="neighborhood-grid">
        {#each data.neighborhood.highlights as item}
          <BristoeCard variant="soft" class="neighborhood-card">
            <div class="neighborhood-card__icon" aria-hidden="true">{item.icon}</div>
            <h3>{item.title}</h3>
            <p>{item.description}</p>
          </BristoeCard>
        {/each}
      </div>
    </div>
  </section>

  <section id="visitor-guide" class="home-section home-section--visitors" aria-labelledby="visitor-heading">
    <div class="home-wrap reveal">
      <SectionHeader
        id="visitor-heading"
        eyebrow={data.visitorGuide.label}
        title={data.visitorGuide.heading}
        description={data.visitorGuide.description}
        class="home-section-heading home-section-heading--center"
      />
      <div class="visitor-grid">
        {#each data.visitorGuide.tips as tip}
          <details class="visitor-card">
            <summary>
              <span class="visitor-card__icon" aria-hidden="true">{tip.icon}</span>
              <span>{tip.title}</span>
              <svg class="chevron" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
            </summary>
            <p>{tip.body}</p>
          </details>
        {/each}
      </div>
    </div>
  </section>
</main>

<Footer footer={data.footer} />

<style>
  .hero-title { font-family: var(--font-display); }

  .home-section {
    padding: clamp(4rem, 7vw, 6rem) clamp(1rem, 3vw, 1.5rem);
  }

  .home-wrap {
    width: min(100%, var(--measure-full));
    margin: 0 auto;
  }

  .home-section--today {
    background:
      linear-gradient(180deg, color-mix(in oklab, var(--color-blood-300) 16%, var(--color-paper-50)), var(--color-paper-50) 58%),
      var(--color-paper-50);
  }

  .home-section--actions,
  .home-section--neighborhood {
    background: var(--color-paper-100);
  }

  .home-section--household,
  .home-section--visitors {
    background: var(--color-paper-50);
  }

  .home-section--limon {
    background:
      radial-gradient(circle at 20% 15%, color-mix(in oklab, var(--color-blood-300) 18%, transparent), transparent 32rem),
      linear-gradient(135deg, var(--color-paper-100), var(--color-paper-50));
  }

  .home-heading-row {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }

  :global(.home-heading-row .section-heading) {
    margin-bottom: 0;
  }

  :global(.home-section-heading--center) {
    justify-content: center;
    text-align: center;
  }

  :global(.home-section-heading--center .section-heading__copy) {
    margin: 0 auto;
  }

  .today-grid,
  .action-grid,
  .member-grid,
  .neighborhood-grid,
  .visitor-grid {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .today-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  :global(.today-grid .weather-card) {
    min-height: 100%;
  }

  .action-grid,
  .neighborhood-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .household-grid,
  .limon-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(18rem, 0.7fr);
    gap: clamp(2rem, 5vw, 4rem);
    align-items: center;
    min-width: 0;
  }

  .home-copy {
    display: grid;
    gap: 1rem;
    color: var(--color-ink-500);
    font-size: 1rem;
    line-height: 1.65;
  }

  .home-copy p {
    margin: 0;
  }

  :global(.home-address-card) {
    display: grid;
    place-items: center;
    min-height: 18rem;
    text-align: center;
  }

  .home-address-card__icon {
    font-size: clamp(4rem, 8vw, 6rem);
    line-height: 1;
    margin-bottom: 1rem;
  }

  :global(.home-address-card p) {
    margin: 0;
    color: var(--color-ink-900);
    font-family: var(--font-display);
    font-size: clamp(1.3rem, 2.4vw, 1.8rem);
    font-weight: 650;
    line-height: 1.1;
  }

  :global(.home-address-card span) {
    display: block;
    margin-top: 0.4rem;
    color: var(--color-ink-500);
    font-size: 0.9rem;
  }

  .member-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    margin-top: clamp(2rem, 4vw, 3rem);
  }

  .home-member-card__photo {
    width: 4rem;
    height: 4rem;
    margin-bottom: 1rem;
    border-radius: 999px;
    object-fit: cover;
  }

  .home-member-card__emoji {
    display: inline-grid;
    place-items: center;
    width: 3rem;
    height: 3rem;
    margin-bottom: 1rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-blood-500) 10%, var(--color-paper-50));
    font-size: 1.65rem;
  }

  :global(.home-member-card h3),
  :global(.neighborhood-card h3) {
    margin: 0;
    color: var(--color-ink-900);
    font-family: var(--font-display);
    font-size: 1.35rem;
    font-weight: 650;
    line-height: 1.1;
  }

  .home-member-card__role {
    margin: 0.25rem 0 0.85rem;
    color: var(--color-blood-500);
    font-size: 0.7rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  :global(.home-member-card p:last-child),
  :global(.neighborhood-card p) {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.92rem;
    line-height: 1.5;
  }

  .limon-grid {
    grid-template-columns: minmax(18rem, 0.85fr) minmax(0, 1fr);
  }

  .limon-photo {
    position: relative;
    overflow: hidden;
    aspect-ratio: 1;
    border-radius: var(--radius-sm, 0.5rem);
    background: linear-gradient(135deg, var(--color-warm-300), var(--color-warm-500));
    box-shadow: 0 1.5rem 3.5rem -2.6rem color-mix(in oklab, var(--color-ink-900) 50%, transparent);
  }

  .limon-photo__fallback,
  .limon-photo img {
    position: absolute;
    inset: 0;
  }

  .limon-photo__fallback {
    display: grid;
    place-items: center;
    align-content: center;
    gap: 0.35rem;
    text-align: center;
    color: var(--color-warm-900);
  }

  .limon-photo__fallback div {
    font-size: clamp(4rem, 9vw, 7rem);
    line-height: 1;
  }

  .limon-photo__fallback p {
    margin: 0;
    font-family: var(--font-display);
    font-size: 1.5rem;
    font-weight: 700;
  }

  .limon-photo__fallback span {
    color: var(--color-warm-800);
    font-size: 0.85rem;
  }

  .limon-photo img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .fact-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 0.75rem;
    margin: 0;
  }

  .fact-card {
    min-width: 0;
    padding: 0.9rem;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-100);
  }

  .fact-card dt {
    color: var(--color-blood-500);
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .fact-card dd {
    margin: 0.35rem 0 0;
    color: var(--color-ink-900);
    font-weight: 650;
    line-height: 1.25;
  }

  .limon-quote {
    margin: 1.5rem 0 0;
    padding-left: 1rem;
    border-left: 3px solid var(--color-blood-500);
  }

  .limon-quote p {
    margin: 0;
    color: var(--color-ink-700);
    font-style: italic;
    line-height: 1.55;
  }

  .limon-quote cite {
    display: block;
    margin-top: 0.55rem;
    color: var(--color-ink-500);
    font-size: 0.85rem;
    font-style: normal;
  }

  .neighborhood-card__icon {
    font-size: 2.35rem;
    line-height: 1;
    margin-bottom: 1rem;
  }

  .visitor-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: min(100%, 46rem);
    margin: 0 auto;
  }

  .visitor-card {
    overflow: hidden;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-100);
    box-shadow: 0 1rem 2.2rem -2rem color-mix(in oklab, var(--color-ink-900) 34%, transparent);
  }

  .visitor-card summary {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    min-height: 4.25rem;
    padding: 1rem;
    cursor: pointer;
    color: var(--color-ink-900);
    font-weight: 750;
    line-height: 1.25;
    user-select: none;
  }

  .visitor-card summary:hover {
    background: color-mix(in oklab, var(--color-blood-500) 7%, transparent);
  }

  .visitor-card__icon {
    display: inline-grid;
    place-items: center;
    width: 2.25rem;
    height: 2.25rem;
    border-radius: 999px;
    background: color-mix(in oklab, var(--color-blood-500) 10%, var(--color-paper-50));
    flex: 0 0 auto;
    font-size: 1.15rem;
  }

  .visitor-card .chevron {
    width: 1rem;
    height: 1rem;
    margin-left: auto;
    color: var(--color-blood-500);
    flex: 0 0 auto;
    transition: transform 160ms ease;
  }

  .visitor-card p {
    margin: 0;
    padding: 0 1rem 1rem 4rem;
    border-top: 1px solid var(--color-paper-300);
    color: var(--color-ink-500);
    font-size: 0.9rem;
    line-height: 1.5;
  }

  @keyframes scroll-bob {
    0%, 100% { transform: translateY(0); opacity: 0.6; }
    50% { transform: translateY(6px); opacity: 1; }
  }
  .scroll-cue-chevron { animation: scroll-bob 1.8s ease-in-out infinite; }
  details[open] .chevron { transform: rotate(180deg); }
  summary { list-style: none; }
  summary::-webkit-details-marker { display: none; }

  @media (max-width: 900px) {
    .today-grid,
    .action-grid,
    .household-grid,
    .limon-grid,
    .neighborhood-grid {
      grid-template-columns: 1fr;
    }

    .member-grid,
    .visitor-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .home-heading-row {
      flex-direction: column;
    }

    .member-grid,
    .visitor-grid,
    .fact-grid {
      grid-template-columns: 1fr;
    }

    :global(.home-address-card) {
      min-height: 14rem;
    }

    .visitor-card p {
      padding-left: 1rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .scroll-cue-chevron { animation: none; opacity: 0.8; }
    .visitor-card .chevron { transition: none; }
  }
</style>
