<script lang="ts">
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import BarChart from '$lib/components/BarChart.svelte';

  let { data } = $props();

  const rangeOptions = [
    { value: '1d', label: '1d' },
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' }
  ];
  const rangeLabels: Record<string, string> = {
    '1d': 'last 24 hours (hourly)',
    '7d': 'last 7 days',
    '30d': 'last 30 days',
    '90d': 'last 90 days'
  };

  function formatSpeed(kibps: number): string {
    if (kibps >= 1024) return `${(kibps / 1024).toFixed(1)} MiB/s`;
    return `${Math.round(kibps)} KiB/s`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch { return dateStr; }
  }

  function coverageNote(daysAvailable: number | null, requested: number): string {
    if (daysAvailable === null) return 'no data';
    if (daysAvailable + 1 >= requested) return `${requested} of ${requested} days`;
    return `${daysAvailable + 1} of ${requested} days (HA retention limit)`;
  }

  const alarmLabels: Record<string, string> = {
    armed_away: 'Armed Away', armed_home: 'Armed Home',
    armed_night: 'Armed Night', disarmed: 'Disarmed', triggered: 'TRIGGERED'
  };
</script>

<svelte:head>
  <title>House — 21 Bristoe Stats</title>
  <meta name="description" content="House sensors and rolling history" />
</svelte:head>

<article class="house">
  <header class="house__head reveal">
    <p class="dossier-kicker">House Status</p>
    <h1 class="house__title">Sensors, history,<br/><em>and a little weather.</em></h1>
    <p class="house__lede">
      Live readings from Home Assistant and rolling seven-day history.
      Toggle the range below the entertainment panel.
    </p>
    <hr class="dossier-rule dossier-rule--ornate" />
  </header>

  {#if !data.ha.available}
    <p class="house__note">
      <span class="dossier-status dossier-status--alert">Home Assistant offline</span>
      &mdash; showing last known data where possible.
    </p>
  {/if}

  <section class="house__section reveal">
    <SectionHeader numeral="II.II.01" title="Current Readings" meta="instruments.log" />
    <div class="stat-grid">
      <StatCard
        label="Indoor temp"
        value={data.ha.indoor ? `${Math.round(parseFloat(data.ha.indoor.state))}` : '—'}
        unit="°F"
        sublabel={data.ha.humidity ? `${data.ha.humidity.state}% humidity` : ''}
        accent
      />
      <StatCard
        label="Outdoor temp"
        value={data.ha.outdoor && data.ha.outdoor.state !== 'unavailable' ? `${Math.round(parseFloat(data.ha.outdoor.state))}` : '—'}
        unit="°F"
        sublabel={data.ha.hvac ? `HVAC ${data.ha.hvac.state}` : ''}
      />
      <StatCard
        label="Security"
        value={data.ha.alarm ? (alarmLabels[data.ha.alarm.state] ?? data.ha.alarm.state) : '—'}
      />
      <StatCard
        label="Network"
        value={data.ha.download ? formatSpeed(parseFloat(data.ha.download.state)) : '—'}
        sublabel={data.ha.upload ? `↑ ${formatSpeed(parseFloat(data.ha.upload.state))}` : ''}
      />
    </div>
  </section>

  {#if data.charts.indoorTemp.length > 0 || data.charts.outdoorTemp.length > 0}
    <section class="house__section reveal">
      <SectionHeader numeral="II.II.02" title="Temperature" meta="7-day history" />
      <div class="figure-grid">
        {#if data.charts.indoorTemp.length > 0}
          <figure class="dossier-figure">
            <p class="dossier-kicker">Figure I &middot; Indoor (°F)</p>
            <div class="dossier-figure__body">
              <LineChart
                labels={data.charts.indoorTemp.map(p => p.time)}
                data={data.charts.indoorTemp.map(p => p.value)}
                label="Indoor °F"
                unit="°"
              />
            </div>
          </figure>
        {/if}
        {#if data.charts.outdoorTemp.length > 0}
          <figure class="dossier-figure">
            <p class="dossier-kicker">Figure II &middot; Outdoor (°F)</p>
            <div class="dossier-figure__body">
              <LineChart
                labels={data.charts.outdoorTemp.map(p => p.time)}
                data={data.charts.outdoorTemp.map(p => p.value)}
                label="Outdoor °F"
                unit="°"
              />
            </div>
          </figure>
        {/if}
      </div>
    </section>
  {/if}

  <section class="house__section reveal">
    <SectionHeader numeral="II.II.03" title="Entertainment" meta="status + on-time" />
    <div class="badges">
      <StatusBadge label="Living Room TV" active={data.ha.livingTV?.state === 'on' || data.ha.livingTV?.state === 'playing'} />
      <StatusBadge label="Bedroom TV" active={data.ha.bedroomTV?.state === 'on' || data.ha.bedroomTV?.state === 'playing'} />
      <StatusBadge
        label="Xbox"
        active={data.ha.xbox?.state === 'on' || data.ha.xbox?.state === 'playing'}
        activeText={data.ha.nowPlaying?.state && data.ha.nowPlaying.state !== 'unknown' ? data.ha.nowPlaying.state : 'On'}
      />
    </div>
    {#if data.ha.gamerscore}
      <div class="stat-grid">
        <StatCard label="Gamerscore" value={parseInt(data.ha.gamerscore.state).toLocaleString()} unit="pts" />
      </div>
    {/if}

    <div class="house__range">
      <p class="house__range-label">
        TV on-time &mdash; <em>{rangeLabels[data.range]}</em>
      </p>
      <div class="house__range-tabs" role="group" aria-label="Time range">
        {#each rangeOptions as opt}
          <a
            href="?range={opt.value}"
            data-sveltekit-noscroll
            aria-current={data.range === opt.value ? 'page' : undefined}
            class="house__range-tab"
            class:house__range-tab--active={data.range === opt.value}
          >{opt.label}</a>
        {/each}
      </div>
    </div>

    <div class="figure-grid">
      <figure class="dossier-figure">
        <p class="dossier-kicker">Figure III &middot; Bedroom TV (hrs)</p>
        <p class="house__coverage">{coverageNote(data.tvCoverage.bedroomDays, data.tvCoverage.requestedDays)}</p>
        <div class="dossier-figure__body">
          <BarChart
            labels={data.charts.bedroomTVHours.map(d => d.time)}
            data={data.charts.bedroomTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
          />
        </div>
      </figure>
      <figure class="dossier-figure">
        <p class="dossier-kicker">Figure IV &middot; Living Room TV (hrs)</p>
        <p class="house__coverage">{coverageNote(data.tvCoverage.livingDays, data.tvCoverage.requestedDays)}</p>
        <div class="dossier-figure__body">
          <BarChart
            labels={data.charts.livingTVHours.map(d => d.time)}
            data={data.charts.livingTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
          />
        </div>
      </figure>
    </div>
  </section>

  {#if data.forecast.length > 0}
    <section class="house__section reveal">
      <SectionHeader numeral="II.II.04" title="The Forecast" meta="7 days, Taneytown" />
      <div class="dossier-figure">
        <div class="forecast">
          {#each data.forecast as day}
            <div class="forecast__day">
              <span class="forecast__date">{formatDate(day.date)}</span>
              <span class="forecast__hi">{Math.round(day.tempMax)}°</span>
              <span class="forecast__lo">{Math.round(day.tempMin)}°</span>
              {#if day.precipitationSum > 0}
                <span class="forecast__rain">{day.precipitationSum.toFixed(2)}in</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}
</article>

<style>
  .house__head { margin-bottom: 2rem; }
  .house__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    font-weight: 500;
    line-height: 1;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .house__title em {
    font-style: italic;
    color: var(--color-blood-500);
    font-variation-settings: 'opsz' 144, 'SOFT' 100;
  }
  .house__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 58ch;
  }
  .house__note {
    margin: 0 0 2rem;
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--color-ink-500);
  }
  .house__section { margin: 3rem 0; }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0 2rem;
  }
  .badges {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    margin-bottom: 1.5rem;
  }
  .figure-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1.5rem;
    margin-top: 1rem;
  }
  @media (max-width: 900px) { .figure-grid { grid-template-columns: 1fr; } }

  .house__coverage {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin: 0 0 0.75rem;
  }

  .house__range {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 2rem 0 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .house__range-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-ink-700);
    margin: 0;
  }
  .house__range-label em {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 0.875rem;
    letter-spacing: 0;
    text-transform: none;
    color: var(--color-blood-500);
    font-weight: 400;
    font-variation-settings: 'opsz' 24, 'SOFT' 100;
  }
  .house__range-tabs {
    display: inline-flex;
    border: 1px solid var(--color-paper-300);
  }
  .house__range-tab {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.5rem 0.9rem;
    text-decoration: none;
    color: var(--color-ink-500);
    border-left: 1px solid var(--color-paper-300);
    transition: background 0.15s, color 0.15s;
  }
  .house__range-tab:first-child { border-left: 0; }
  .house__range-tab:hover { color: var(--color-ink-900); }
  .house__range-tab--active {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }

  .forecast {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 0;
    padding-top: 0.5rem;
  }
  .forecast__day {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    padding: 0.75rem 0.35rem;
    border-right: 1px solid var(--color-paper-300);
    gap: 0.2rem;
  }
  .forecast__day:last-child { border-right: 0; }
  .forecast__date {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin-bottom: 0.35rem;
  }
  .forecast__hi {
    font-family: var(--font-mono);
    font-size: 1.125rem;
    font-weight: 500;
    color: var(--color-ink-900);
  }
  .forecast__lo {
    font-family: var(--font-mono);
    font-size: 0.875rem;
    color: var(--color-ink-500);
  }
  .forecast__rain {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    color: var(--color-blood-500);
    margin-top: 0.2rem;
  }
</style>
