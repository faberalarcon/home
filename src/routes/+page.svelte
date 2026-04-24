<script lang="ts">
  import StatCard from '$lib/components/StatCard.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';

  let { data } = $props();

  function formatTime(iso: string | null): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '—';
    }
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  type WxInfo = { icon: string; color: string };
  function wxInfo(code: number): WxInfo {
    if (code === 0) return { icon: '☀️', color: 'var(--color-weather-sun)' };
    if (code === 1) return { icon: '🌤️', color: 'var(--color-weather-sun)' };
    if (code === 2) return { icon: '⛅', color: 'var(--color-weather-cloud)' };
    if (code === 3) return { icon: '☁️', color: 'var(--color-weather-cloud)' };
    if (code >= 45 && code <= 48) return { icon: '🌫️', color: 'var(--color-weather-fog)' };
    if (code >= 51 && code <= 55) return { icon: '🌦️', color: 'var(--color-weather-rain)' };
    if (code >= 56 && code <= 67) return { icon: '🌧️', color: 'var(--color-weather-rain)' };
    if (code >= 71 && code <= 77) return { icon: '🌨️', color: 'var(--color-weather-snow)' };
    if (code >= 80 && code <= 82) return { icon: '🌧️', color: 'var(--color-weather-rain)' };
    if (code >= 85 && code <= 86) return { icon: '🌨️', color: 'var(--color-weather-snow)' };
    if (code >= 95) return { icon: '⛈️', color: 'var(--color-weather-storm)' };
    return { icon: '🌡️', color: 'var(--color-weather-cloud)' };
  }
</script>

<svelte:head>
  <title>Overview - 21 Bristoe Stats</title>
  <meta name="description" content="Live household dashboard for 21 Bristoe Station Rd, Taneytown MD" />
</svelte:head>

<article class="overview">
  <header class="overview__head reveal">
    <div>
      <p class="dashboard-kicker">Overview</p>
      <h1 class="overview__title">House dashboard</h1>
    </div>
    <p class="overview__freshness">Updated on page load</p>
  </header>

  <section class="overview__section overview__section--first reveal">
    <div class="kpi-grid">
      {#if data.weather}
        <StatCard
          label="Outdoor"
          value={Math.round(data.weather.temperature)}
          unit="°F"
          sublabel={`${data.weather.description} · feels ${Math.round(data.weather.apparentTemperature)}°`}
          accent
        />
      {/if}
      {#if data.visitors}
        <StatCard
          label="Visitors"
          value={data.visitors.count.toLocaleString()}
          sublabel="21bristoe.com + stats"
        />
      {/if}
      {#if data.ha.xbox.gamerscore != null}
        <StatCard label="Gamerscore" value={data.ha.xbox.gamerscore.toLocaleString()} unit="pts" />
      {/if}
      <StatCard label="Sunrise" value={formatTime(data.ha.sun.sunrise)} />
      <StatCard label="Sunset" value={formatTime(data.ha.sun.sunset)} />
    </div>
  </section>

  {#if data.weather}
    <section class="overview__section reveal">
      <SectionHeader title="Weather" meta="Taneytown, MD" />

      <div class="weather">
        <div class="metric-panel weather__current">
          <div>
            <p class="panel-label">Current</p>
            <p class="weather__temp">
              {Math.round(data.weather.temperature)}<span class="weather__unit">°F</span>
            </p>
            <p class="weather__desc">{data.weather.description}</p>
            <p class="weather__meta">
              Feels {Math.round(data.weather.apparentTemperature)}°F · wind {Math.round(data.weather.windSpeed)} mph
            </p>
          </div>
        </div>

        {#if data.forecast.length > 0}
          <div class="metric-panel weather__forecast">
            <p class="panel-label">7-day forecast</p>
            <div class="weather__days">
              {#each data.forecast as day}
                {@const wx = wxInfo(day.weatherCode)}
                <div class="weather__day" style="border-top-color: {wx.color}">
                  <span class="weather__day-label">{formatDate(day.date)}</span>
                  <span class="weather__day-icon" aria-hidden="true">{wx.icon}</span>
                  <span class="weather__day-hi">{Math.round(day.tempMax)}°</span>
                  <span class="weather__day-lo">{Math.round(day.tempMin)}°</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if data.yearStats}
        <div class="stat-grid stat-grid--tight">
          <StatCard label="Rainy days, YTD" value={data.yearStats.rainyDaysThisYear} />
          <StatCard label="Sunny days, YTD" value={data.yearStats.sunnyDaysThisYear} />
          {#if data.yearStats.hottestDay}
            <StatCard
              label="Hottest day"
              value={`${data.yearStats.hottestDay.temp}°F`}
              sublabel={formatDate(data.yearStats.hottestDay.date)}
            />
          {/if}
          {#if data.yearStats.coldestDay}
            <StatCard
              label="Coldest day"
              value={`${data.yearStats.coldestDay.temp}°F`}
              sublabel={formatDate(data.yearStats.coldestDay.date)}
            />
          {/if}
          <StatCard label="Days since rain" value={data.yearStats.daysSinceRain} />
          {#if data.yearStats.avgTempThisMonth}
            <StatCard label="Avg temp, month" value={`${data.yearStats.avgTempThisMonth}°F`} />
          {/if}
        </div>
      {/if}
    </section>
  {/if}

  <section class="overview__section reveal">
    <SectionHeader title="Entertainment" />
    <div class="badges">
      {#each data.ha.tvs as tv}
        <StatusBadge label={tv.name} active={tv.on} />
      {/each}
      <StatusBadge label="Xbox" active={data.ha.xbox.on} activeText={data.ha.xbox.nowPlaying ?? 'On'} />
    </div>
  </section>

  <section class="overview__section reveal">
    <SectionHeader title="Limón" meta={data.ha.outdoor ? `${Math.round(data.ha.outdoor.temp)}°F outside` : ''} />
    <div class="stat-grid">
      {#each data.limonStats as stat}
        <StatCard label={stat.label} value={stat.value} />
      {/each}
    </div>
  </section>
</article>

<style>
  .overview__head {
    display: flex;
    justify-content: space-between;
    align-items: end;
    gap: 1rem;
    margin-bottom: 1.25rem;
  }
  .overview__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 5vw, 4rem);
    line-height: 1;
    font-weight: 500;
    margin: 0.35rem 0 0;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .overview__freshness {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-ink-500);
    margin: 0;
    line-height: 1.2;
  }
  .overview__section { margin: 2rem 0; min-width: 0; }
  .overview__section--first { margin-top: 0; }

  .kpi-grid,
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 11rem), 1fr));
    gap: 0.85rem 1.25rem;
    min-width: 0;
  }

  .stat-grid--tight { margin-top: 1.5rem; }

  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }

  .weather {
    display: grid;
    grid-template-columns: 1fr 1.2fr;
    gap: 1rem;
    margin-bottom: 1.5rem;
    min-width: 0;
  }
  @media (max-width: 768px) {
    .weather { grid-template-columns: 1fr; }
  }
  .metric-panel {
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    padding: 1rem;
    min-width: 0;
    box-shadow: 0 1px 2px 0 color-mix(in oklab, var(--color-ink-900) 6%, transparent);
    transition: box-shadow 0.25s ease, transform 0.25s ease;
  }
  .metric-panel:hover {
    box-shadow: 0 4px 10px -2px color-mix(in oklab, var(--color-ink-900) 10%, transparent);
    transform: translateY(-1px);
  }
  @media (prefers-reduced-motion: reduce) {
    .metric-panel { transition: none; }
    .metric-panel:hover { transform: none; }
  }
  .panel-label {
    font-family: var(--font-body);
    font-size: 0.7rem;
    font-weight: 800;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin: 0;
  }
  .weather__temp {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: clamp(3.5rem, 8vw, 5rem);
    line-height: 1;
    color: var(--color-ink-900);
    margin: 0.45rem 0 0;
    letter-spacing: 0;
  }
  .weather__unit {
    font-family: var(--font-body);
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-left: 0.25rem;
  }
  .weather__desc {
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 700;
    color: var(--color-ink-700);
    margin: 0.25rem 0 0.5rem;
  }
  .weather__meta {
    font-family: var(--font-body);
    font-size: 0.8125rem;
    color: var(--color-ink-500);
    margin: 0;
  }

  .weather__days {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
    gap: 0.4rem;
    margin-top: 0.75rem;
    min-width: 0;
  }
  .weather__day {
    display: flex;
    flex-direction: column;
    text-align: center;
    padding: 0.5rem 0.15rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .weather__day-label {
    font-family: var(--font-body);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-bottom: 0.4rem;
  }
  .weather__day-icon {
    font-size: 1rem;
    line-height: 1;
    margin-bottom: 0.15rem;
  }
  .weather__day-hi {
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    font-weight: 500;
    color: var(--color-ink-900);
  }
  .weather__day-lo {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    color: var(--color-ink-500);
  }
  @media (max-width: 520px) {
    .overview__head {
      display: block;
    }
    .overview__freshness {
      margin-top: 0.5rem;
    }
    .weather__days {
      grid-template-columns: repeat(4, 1fr);
    }
  }
</style>
