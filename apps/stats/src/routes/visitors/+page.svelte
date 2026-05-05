<script lang="ts">
  import StatCard from '$lib/components/StatCard.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import BarChart from '$lib/components/BarChart.svelte';
  import LineChart from '$lib/components/LineChart.svelte';

  let { data } = $props();

  const stats = $derived(data.stats);
  const geo = $derived(stats?.geo ?? null);
  const topCountries = $derived(geo?.byCountry.slice(0, 12) ?? []);
  const topRegions = $derived(geo?.byRegion.slice(0, 12) ?? []);
  const topCities = $derived(geo?.byCity.slice(0, 18) ?? []);
  const daily = $derived(geo?.daily.slice(-30) ?? []);

  function formatDate(iso: string | null): string {
    if (!iso) return 'Never';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function formatDay(date: string): string {
    try {
      return new Date(date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return date;
    }
  }

  function locationLabel(city: { city: string; region: string; countryName: string }): string {
    const parts = [city.city, city.region, city.countryName].filter(Boolean);
    return parts.join(', ');
  }
</script>

<svelte:head>
  <title>Visitors - 21 Bristoe Stats</title>
  <meta name="description" content="Estimated visitor locations for 21 Bristoe sites" />
</svelte:head>

<article class="visitors">
  <header class="visitors__head reveal">
    <div>
      <p class="dashboard-kicker">Visitors</p>
      <h1 class="visitors__title">Location trends</h1>
      <p class="visitors__lede">
        Estimated city, region, and country locations from local nginx logs.
      </p>
    </div>
    <p class="visitors__freshness">
      Updated {formatDate(geo?.updatedAt ?? stats?.updatedAt ?? null)}
    </p>
  </header>

  {#if !stats}
    <section class="visitors__empty reveal">
      <span class="dashboard-status dashboard-status--alert">No visitor data</span>
      <p>The visitor counter has not written stats yet.</p>
    </section>
  {:else if !geo}
    <section class="visitors__empty reveal">
      <span class="dashboard-status dashboard-status--alert">No location data</span>
      <p>Run the visitor counter refresh to populate city and country aggregates.</p>
    </section>
  {:else}
    {#if geo.status !== 'ok'}
      <section class="visitors__notice reveal">
        <span class="dashboard-status dashboard-status--alert">
          Geo data {geo.status}
        </span>
        <p>
          Location lookup did not complete on the last refresh.
          {#if geo.error} Last error: {geo.error}.{/if}
        </p>
      </section>
    {/if}

    <section class="visitors__section visitors__section--first reveal">
      <div class="stat-grid">
        <StatCard label="Unique visitors" value={stats.count.toLocaleString()} accent />
        <StatCard label="Located" value={geo.locatedCount.toLocaleString()} sublabel={`${geo.unknownCount} unknown`} />
        <StatCard label="Countries" value={geo.countryCount} />
        <StatCard label="Regions" value={geo.regionCount} />
        <StatCard label="Cities" value={geo.cityCount} />
      </div>
    </section>

    <section class="visitors__section reveal">
      <SectionHeader title="Top countries" meta="Estimated by IP" />
      {#if topCountries.length > 0}
        <figure class="chart-panel">
          <figcaption>Qualified unique visitors by country</figcaption>
          <div class="chart-panel__body">
            <BarChart
              labels={topCountries.map((country) => country.name)}
              data={topCountries.map((country) => country.count)}
              colors={topCountries.map(() => 'var(--color-chart-weather)')}
              horizontal
              label="Visitors"
            />
          </div>
        </figure>
      {:else}
        <p class="visitors__muted">No country-level locations are available yet.</p>
      {/if}
    </section>

    {#if daily.length > 0}
      <section class="visitors__section reveal">
        <SectionHeader title="Visitor trend" meta="Last 30 logged days" />
        <figure class="chart-panel">
          <figcaption>Location-processed visitors by day</figcaption>
          <div class="chart-panel__body">
            <LineChart
              labels={daily.map((day) => formatDay(day.date))}
              data={daily.map((day) => day.count)}
              label="Visitors"
              color="var(--color-chart-network)"
              fill
              beginAtZero
            />
          </div>
        </figure>
      </section>
    {/if}

    <section class="visitors__section reveal">
      <div class="table-grid">
        <div>
          <SectionHeader title="Top regions" meta={`${topRegions.length} shown`} />
          <div class="data-table" role="table" aria-label="Top visitor regions">
            <div class="data-table__row data-table__row--head" role="row">
              <span>Region</span>
              <span>Country</span>
              <span>Visitors</span>
            </div>
            {#each topRegions as region}
              <div class="data-table__row" role="row">
                <span>{region.region}</span>
                <span>{region.countryName}</span>
                <span>{region.count.toLocaleString()} <em>{region.percent}%</em></span>
              </div>
            {/each}
          </div>
        </div>

        <div>
          <SectionHeader title="Top cities" meta={`${topCities.length} shown`} />
          <div class="data-table" role="table" aria-label="Top visitor cities">
            <div class="data-table__row data-table__row--head data-table__row--city" role="row">
              <span>City</span>
              <span>Visitors</span>
            </div>
            {#each topCities as city}
              <div class="data-table__row data-table__row--city" role="row">
                <span>{locationLabel(city)}</span>
                <span>{city.count.toLocaleString()} <em>{city.percent}%</em></span>
              </div>
            {/each}
          </div>
        </div>
      </div>
    </section>

    <section class="visitors__section reveal">
      <SectionHeader title="Country list" meta={`${geo.byCountry.length} total`} />
      <div class="country-list">
        {#each geo.byCountry as country}
          <div class="country-list__item">
            <span class="country-list__name">{country.name}</span>
            <span class="country-list__code">{country.code}</span>
            <span class="country-list__bar" style={`--share: ${country.percent}%`}></span>
            <span class="country-list__count">{country.count.toLocaleString()}</span>
          </div>
        {/each}
      </div>
    </section>

    <p class="visitors__source">
      Locations are approximate and processed locally. <a href={geo.attribution.href} target="_blank" rel="noopener noreferrer">{geo.attribution.label}</a>.
    </p>
  {/if}
</article>

<style>
  .visitors__head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .visitors__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    line-height: 1;
    font-weight: 500;
    margin: 0.35rem 0 0;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .visitors__lede {
    max-width: 42rem;
    margin: 0.7rem 0 0;
    color: var(--color-ink-600);
  }
  .visitors__freshness {
    flex: 0 0 auto;
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-ink-500);
    text-align: right;
  }
  .visitors__section { margin: 2rem 0; min-width: 0; }
  .visitors__section--first { margin-top: 0; }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
    gap: 0.85rem 1.25rem;
    min-width: 0;
  }
  .chart-panel {
    margin: 0;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    padding: 1rem;
    min-width: 0;
  }
  .chart-panel figcaption {
    margin-bottom: 0.8rem;
    font-family: var(--font-mono);
    font-size: 0.72rem;
    color: var(--color-ink-500);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .chart-panel__body { min-width: 0; }
  .table-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    gap: 1.25rem;
  }
  .data-table,
  .country-list {
    border-top: 1px solid var(--color-ink-900);
    min-width: 0;
  }
  .data-table__row {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) minmax(0, 1fr) minmax(6rem, 0.5fr);
    gap: 0.8rem;
    align-items: baseline;
    padding: 0.75rem 0;
    border-bottom: 1px solid var(--color-paper-300);
    font-size: 0.9rem;
    min-width: 0;
  }
  .data-table__row--city {
    grid-template-columns: minmax(0, 1fr) minmax(6rem, 0.32fr);
  }
  .data-table__row span {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .data-table__row span:last-child {
    text-align: right;
    font-family: var(--font-mono);
  }
  .data-table__row em {
    color: var(--color-ink-500);
    font-style: normal;
    font-size: 0.75rem;
  }
  .data-table__row--head {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-ink-500);
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .country-list__item {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 3.5rem minmax(5rem, 12rem) 4rem;
    gap: 0.8rem;
    align-items: center;
    padding: 0.7rem 0;
    border-bottom: 1px solid var(--color-paper-300);
    font-size: 0.9rem;
  }
  .country-list__name {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .country-list__code,
  .country-list__count {
    font-family: var(--font-mono);
    color: var(--color-ink-600);
  }
  .country-list__count { text-align: right; }
  .country-list__bar {
    height: 0.45rem;
    background:
      linear-gradient(
        90deg,
        var(--color-chart-weather) 0 var(--share),
        var(--color-paper-300) var(--share) 100%
      );
  }
  .visitors__notice,
  .visitors__empty {
    border-top: 1px solid var(--color-ink-900);
    border-bottom: 1px solid var(--color-paper-300);
    padding: 1rem 0;
    color: var(--color-ink-600);
  }
  .visitors__muted,
  .visitors__source {
    color: var(--color-ink-500);
    font-size: 0.9rem;
  }
  .visitors__source {
    margin-top: 2rem;
    font-family: var(--font-mono);
    font-size: 0.75rem;
  }
  .visitors__source a {
    color: var(--color-blood-600);
  }
  @media (max-width: 820px) {
    .visitors__head {
      display: block;
    }
    .visitors__freshness {
      margin-top: 0.75rem;
      text-align: left;
    }
    .table-grid {
      grid-template-columns: 1fr;
    }
    .data-table__row {
      grid-template-columns: minmax(0, 1fr) minmax(5.5rem, 0.45fr);
    }
    .data-table__row:not(.data-table__row--city) span:nth-child(2),
    .data-table__row--head:not(.data-table__row--city) span:nth-child(2) {
      display: none;
    }
    .country-list__item {
      grid-template-columns: minmax(0, 1fr) 3rem 3.5rem;
    }
    .country-list__bar {
      display: none;
    }
  }
</style>
