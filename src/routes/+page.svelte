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

  function formatSpeed(kibps: number): string {
    if (kibps >= 1024) return `${(kibps / 1024).toFixed(1)} MiB/s`;
    return `${Math.round(kibps)} KiB/s`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  const alarmLabels: Record<string, string> = {
    armed_away: 'Armed Away',
    armed_home: 'Armed Home',
    armed_night: 'Armed Night',
    disarmed: 'Disarmed',
    triggered: 'TRIGGERED'
  };
</script>

<svelte:head>
  <title>Overview — 21 Bristoe Stats</title>
  <meta name="description" content="Live household readings from 21 Bristoe Station Rd, Taneytown MD" />
</svelte:head>

<article class="overview">
  <header class="overview__head reveal">
    <p class="dossier-kicker">21 Bristoe Stats</p>
    <h1 class="overview__title">Live household<br/>readings.</h1>
    <p class="overview__lede">
      Current sensors, weather, entertainment, and the occasional fact about Limón &mdash;
      refreshed on every page load.
    </p>
    <hr class="dossier-rule dossier-rule--ornate" />
  </header>

  {#if data.visitors}
    <section class="overview__section reveal">
      <SectionHeader numeral="II.01" title="Callers" meta="cover.log" />
      <div class="stat-grid">
        <StatCard
          label="Unique callers"
          value={data.visitors.count.toLocaleString()}
          sublabel="21bristoe.com + stats"
          accent
        />
      </div>
    </section>
  {/if}

  <section class="overview__section reveal">
    <SectionHeader numeral="II.02" title="The House" meta="sensors.fig" />
    {#if !data.ha.available}
      <p class="overview__note">
        <span class="dossier-status dossier-status--alert">Home Assistant offline</span>
        &mdash; some readings may be missing.
      </p>
    {/if}
    <div class="stat-grid">
      <StatCard
        label="Indoor"
        value={data.ha.indoor ? `${Math.round(data.ha.indoor.temp)}` : '—'}
        unit="°F"
        sublabel={data.ha.humidity != null ? `${data.ha.humidity}% humidity` : ''}
      />
      <StatCard
        label="Outdoor"
        value={data.ha.outdoor ? `${Math.round(data.ha.outdoor.temp)}` : '—'}
        unit="°F"
        sublabel={data.ha.hvacMode ? `HVAC ${data.ha.hvacMode}` : ''}
      />
      <StatCard
        label="Security"
        value={data.ha.alarm ? alarmLabels[data.ha.alarm] ?? data.ha.alarm : '—'}
      />
      <StatCard
        label="Network"
        value={data.ha.network ? formatSpeed(data.ha.network.down) : '—'}
        sublabel={data.ha.network ? `↑ ${formatSpeed(data.ha.network.up)}` : ''}
      />
    </div>
  </section>

  {#if data.weather}
    <section class="overview__section reveal">
      <SectionHeader numeral="II.03" title="The Weather" meta="Taneytown, Md." />

      <div class="weather">
        <div class="dossier-figure weather__current">
          <div class="dossier-figure__body">
            <p class="dossier-kicker">As of now</p>
            <p class="weather__temp">
              {Math.round(data.weather.temperature)}<span class="weather__unit">°F</span>
            </p>
            <p class="weather__desc">&mdash; {data.weather.description}</p>
            <p class="weather__meta">
              Feels like {Math.round(data.weather.apparentTemperature)}°F &middot;
              Wind {Math.round(data.weather.windSpeed)} mph
            </p>
          </div>
        </div>

        {#if data.forecast.length > 0}
          <div class="dossier-figure weather__forecast">
            <p class="dossier-kicker">Forecast, 7 days</p>
            <div class="weather__days">
              {#each data.forecast as day}
                <div class="weather__day">
                  <span class="weather__day-label">{formatDate(day.date)}</span>
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
    <SectionHeader numeral="II.04" title="Entertainment" meta="status.log" />
    <div class="badges">
      {#each data.ha.tvs as tv}
        <StatusBadge label={tv.name} active={tv.on} />
      {/each}
      <StatusBadge label="Xbox" active={data.ha.xbox.on} activeText={data.ha.xbox.nowPlaying ?? 'On'} />
    </div>
    <div class="stat-grid">
      {#if data.ha.xbox.gamerscore != null}
        <StatCard label="Gamerscore" value={data.ha.xbox.gamerscore.toLocaleString()} unit="pts" />
      {/if}
      <StatCard label="Sunrise" value={formatTime(data.ha.sun.sunrise)} />
      <StatCard label="Sunset" value={formatTime(data.ha.sun.sunset)} />
    </div>
  </section>

  <section class="overview__section reveal">
    <SectionHeader numeral="II.05" title="Limón" meta={`Today ${data.ha.outdoor ? Math.round(data.ha.outdoor.temp) + '°F' : ''} outside`} />
    <p class="overview__caption">Daily readings from our resident expert, Limón — purely apocryphal.</p>
    <div class="stat-grid">
      {#each data.limonStats as stat}
        <StatCard label={stat.label} value={stat.value} />
      {/each}
    </div>
  </section>
</article>

<style>
  .overview__head { margin-bottom: 2rem; }
  .overview__title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 5vw + 1rem, 4.5rem);
    line-height: 1;
    font-weight: 500;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .overview__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 56ch;
  }
  .overview__section { margin: 3rem 0; }
  .overview__note {
    margin: 0 0 1rem;
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--color-ink-500);
  }
  .overview__caption {
    font-family: var(--font-display);
    font-style: italic;
    color: var(--color-ink-500);
    font-size: 0.9375rem;
    margin-top: -0.5rem;
    margin-bottom: 1rem;
    font-variation-settings: 'opsz' 24, 'SOFT' 100;
  }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0 2rem;
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
    gap: 1.5rem;
    margin-bottom: 2rem;
  }
  @media (max-width: 768px) {
    .weather { grid-template-columns: 1fr; }
  }
  .weather__temp {
    font-family: var(--font-mono);
    font-weight: 500;
    font-size: clamp(3.5rem, 8vw, 5rem);
    line-height: 1;
    color: var(--color-ink-900);
    margin: 0.5rem 0 0;
    letter-spacing: -0.03em;
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
    font-family: var(--font-display);
    font-style: italic;
    font-size: 1.125rem;
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
    grid-template-columns: repeat(7, 1fr);
    gap: 0.75rem;
    margin-top: 0.75rem;
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
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-bottom: 0.4rem;
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
</style>
