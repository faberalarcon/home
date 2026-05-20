<script lang="ts">
  import StatCard from '$lib/stats/components/StatCard.svelte';
  import SectionHeader from '$lib/stats/components/SectionHeader.svelte';
  import Leaderboard from '$lib/stats/components/Leaderboard.svelte';
  import BarChart from '$lib/stats/components/BarChart.svelte';
  import LineChart from '$lib/stats/components/LineChart.svelte';
  import FilterBar from '$lib/stats/components/FilterBar.svelte';

  let { data } = $props();

  let leaderView: 'allTime' | 'today' | 'thisWeek' = $state('allTime');
  let topDrinksView: 'allTime' | 'thisWeek' = $state('allTime');

  const s = $derived(data.stats);

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  function formatHour(h: string): string {
    const hour = parseInt(h);
    if (hour === 0) return '12 AM';
    if (hour === 12) return '12 PM';
    return hour > 12 ? `${hour - 12} PM` : `${hour} AM`;
  }

  const leaderLabels = { allTime: 'All Time', thisWeek: 'This Week', today: 'Today' } as const;
  const topLabels = { allTime: 'All Time', thisWeek: 'This Week' } as const;
  const dayPalette = [
    'var(--color-chart-cpu)',
    'var(--color-chart-network)',
    'var(--color-chart-drinks)',
    'var(--color-chart-memory)',
    'var(--color-chart-temp)',
    'var(--color-chart-weather)',
    'var(--color-leaf-500)'
  ];

  function colorsFor(count: number, palette: string[]): string[] {
    return Array.from({ length: count }, (_, i) => palette[i % palette.length]);
  }

  function hourColor(hour: number): string {
    if (hour < 6) return 'var(--color-chart-weather)';
    if (hour < 12) return 'var(--color-chart-drinks)';
    if (hour < 18) return 'var(--color-chart-temp)';
    return 'var(--color-chart-memory)';
  }
</script>

<svelte:head>
  <title>Drinks — 21 Bristoe Stats</title>
  <meta name="description" content="Drinks order log and leaderboard for 21 Bristoe" />
</svelte:head>

<article class="drinks">
  <header class="drinks__head reveal">
    <p class="dashboard-kicker">Drinks</p>
    <h1 class="drinks__title">Orders and trends</h1>
    <p class="drinks__lede">
      Drinks order totals, leaders, and activity patterns.
    </p>
  </header>

  {#if s}
    <FilterBar profiles={s.profiles} drinks={s.drinks} filters={data.filters} />
  {/if}

  {#if !s}
    <p class="drinks__missing">
      <span class="dashboard-status dashboard-status--alert">Drinks offline</span>
      &mdash; could not reach the lounge API.
    </p>
  {:else}
    <section class="drinks__section reveal">
      <SectionHeader title="Order totals" />
      <div class="stat-grid">
        <StatCard label="All time" value={s.totals.allTime.toLocaleString()} accent />
        <StatCard label="Today" value={s.totals.today} />
        <StatCard label="This week" value={s.totals.thisWeek} />
        <StatCard label="This month" value={s.totals.thisMonth} />
      </div>
    </section>

    <section class="drinks__section reveal">
      <SectionHeader title="Leaderboard" meta={leaderLabels[leaderView]} />
      <div class="tab-row">
        {#each (['allTime', 'thisWeek', 'today'] as const) as view}
          <button
            class="tab"
            class:tab--active={leaderView === view}
            onclick={() => leaderView = view}
          >{leaderLabels[view]}</button>
        {/each}
      </div>
      <Leaderboard entries={s.leaderboard[leaderView]} />
    </section>

    <section class="drinks__section reveal">
      <SectionHeader title="Top items" meta={topLabels[topDrinksView]} />
      <div class="tab-row">
        {#each (['allTime', 'thisWeek'] as const) as view}
          <button
            class="tab"
            class:tab--active={topDrinksView === view}
            onclick={() => topDrinksView = view}
          >{topLabels[view]}</button>
        {/each}
      </div>
      <figure class="chart-panel">
        <figcaption>Ranked by order count</figcaption>
        <div class="chart-panel__body">
          {#key topDrinksView}
            <BarChart
              labels={s.topDrinks[topDrinksView].map(d => d.name)}
              data={s.topDrinks[topDrinksView].map(d => d.count)}
              colors={s.topDrinks[topDrinksView].map(() => 'var(--color-chart-drinks)')}
              horizontal
              label="Orders"
            />
          {/key}
        </div>
      </figure>
    </section>

    <section class="drinks__section reveal">
      <div class="figure-grid">
        <figure class="chart-panel">
          <figcaption>Orders by day of week</figcaption>
          <div class="chart-panel__body">
            <BarChart
              labels={s.dowHistogram.map(d => d.day)}
              data={s.dowHistogram.map(d => d.count)}
              colors={colorsFor(s.dowHistogram.length, dayPalette)}
              label="Orders"
            />
          </div>
        </figure>
        <figure class="chart-panel">
          <figcaption>Orders by hour</figcaption>
          <div class="chart-panel__body">
            <BarChart
              labels={s.hourHistogram.map(h => h.hour.toString().padStart(2, '0'))}
              data={s.hourHistogram.map(h => h.count)}
              colors={s.hourHistogram.map(h => hourColor(h.hour))}
              label="Orders"
            />
          </div>
        </figure>
      </div>
    </section>

    {#if s.dailyTimeline.length > 0}
      <section class="drinks__section reveal">
        <SectionHeader title="Orders over time" meta="90-day timeline" />
        <figure class="chart-panel">
          <figcaption>Daily orders</figcaption>
          <div class="chart-panel__body">
            <LineChart
              labels={s.dailyTimeline.map(d => formatDate(d.date))}
              data={s.dailyTimeline.map(d => d.count)}
              label="Orders"
              color="var(--color-chart-drinks)"
              fill
              beginAtZero
            />
          </div>
        </figure>
      </section>
    {/if}

    <section class="drinks__section reveal">
      <SectionHeader title="Additional metrics" />
      <div class="stat-grid">
        {#if s.funStats.busiestDay}
          <StatCard
            label="Busiest day"
            value={`${s.funStats.busiestDay.count} orders`}
            sublabel={formatDate(s.funStats.busiestDay.date)}
          />
        {/if}
        <StatCard label="Longest streak" value={`${s.funStats.longestStreak} days`} />
        <StatCard label="Avg per day" value={s.funStats.avgPerDay} sublabel="on active days" />
        {#if s.funStats.peakDay}
          <StatCard label="Favorite day" value={s.funStats.peakDay} />
        {/if}
        {#if s.funStats.peakHour}
          <StatCard label="Peak hour" value={formatHour(s.funStats.peakHour)} />
        {/if}
        <StatCard label="Drink diversity" value={`${s.funStats.diversityScore}%`} sublabel="unique / total" />
        {#if s.funStats.firstOrderDate}
          <StatCard label="First order" value={formatDate(s.funStats.firstOrderDate)} />
        {/if}
      </div>

      {#if s.funStats.signatureDrinks.length > 0}
        <h3 class="drinks__sig-head">Signature drinks</h3>
        <div class="sig-grid">
          {#each s.funStats.signatureDrinks as sig}
            <div class="sig">
              <span class="sig__dot" style="background-color: {sig.profileColor}"></span>
              <div class="sig__body">
                <p class="sig__name">{sig.profileName}</p>
                <p class="sig__drink">{sig.drinkName} &middot; {sig.count} orders</p>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </section>
  {/if}
</article>

<style>
  .drinks__head { margin-bottom: 2rem; }
  .drinks__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    font-weight: 500;
    line-height: 1;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .drinks__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 58ch;
  }
  .drinks__missing {
    margin: 0 0 2rem;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--color-ink-500);
  }
  .drinks__section { margin: 3rem 0; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0 2rem;
  }
  .figure-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.5rem;
  }
  @media (max-width: 900px) { .figure-grid { grid-template-columns: 1fr; } }

  .tab-row {
    display: inline-flex;
    border: 1px solid var(--color-paper-300);
    margin-bottom: 1.25rem;
  }
  .tab {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.5rem 0.9rem;
    background: transparent;
    border: 0;
    border-left: 1px solid var(--color-paper-300);
    color: var(--color-ink-500);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .tab:first-child { border-left: 0; }
  .tab:hover { color: var(--color-ink-900); }
  .tab--active {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }

  .drinks__sig-head {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-blood-500);
    margin: 2rem 0 1rem;
  }
  .sig-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(16rem, 1fr));
    gap: 0.9rem;
  }
  .sig {
    display: flex;
    align-items: center;
    gap: 0.85rem;
    border: 1px solid var(--color-paper-300);
    padding: 0.85rem 1rem;
    background: var(--color-paper-100);
  }
  .sig__dot {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
  }
  .sig__name {
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--color-ink-900);
    font-size: 1rem;
    margin: 0;
    font-variation-settings: 'opsz' 24, 'SOFT' 30;
  }
  .sig__drink {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--color-ink-500);
    margin: 0.15rem 0 0;
  }
</style>
