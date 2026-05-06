<script lang="ts">
  import SectionHeader from '$lib/stats/components/SectionHeader.svelte';
  import StatCard from '$lib/stats/components/StatCard.svelte';
  import StatusBadge from '$lib/stats/components/StatusBadge.svelte';
  import LineChart from '$lib/stats/components/LineChart.svelte';
  import BarChart from '$lib/stats/components/BarChart.svelte';

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

  function formatNumber(value: number | null, decimals = 1): string {
    if (value === null || !Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function formatMoney(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '—';
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  }

  function formatCostRate(value: number): string {
    return value.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 3
    });
  }

  function connectorStatusLabel(c: typeof data.ha.wallConnector): string {
    if (c.charging) return 'Charging';
    if (c.connected) return 'Connected';
    if (c.status?.state) return c.status.state.replace(/_/g, ' ').replace(/\b\w/g, (m: string) => m.toUpperCase());
    return '—';
  }

  function connectorDetail(c: typeof data.ha.wallConnector): string {
    const details = [];
    if (c.gridVoltage !== null) details.push(`${formatNumber(c.gridVoltage, 0)} V`);
    if (c.lineCurrent !== null) details.push(`${formatNumber(c.lineCurrent, 1)} A`);
    return details.join(' / ');
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
    <p class="dashboard-kicker">House</p>
    <h1 class="house__title">Sensors and history</h1>
    <p class="house__lede">
      Current Home Assistant readings with temperature, entertainment, and forecast trends.
    </p>
  </header>

  {#if !data.ha.available}
    <p class="house__note">
      <span class="dashboard-status dashboard-status--alert">Home Assistant offline</span>
      &mdash; showing last known data where possible.
    </p>
  {/if}

  <section class="house__section reveal">
    <SectionHeader title="Current Readings" meta="Live" />
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

  <section class="house__section reveal">
    <SectionHeader title="Charging" meta="Tesla Wall Connector" />
    <div class="badges">
      <StatusBadge
        label="Vehicle"
        active={data.ha.wallConnector.connected}
        activeText="Connected"
        inactiveText="Not connected"
      />
      <StatusBadge
        label="Charging"
        active={data.ha.wallConnector.charging}
        activeText="Active"
        inactiveText="Idle"
      />
    </div>
    <div class="stat-grid">
      <StatCard
        label="Connector"
        value={connectorStatusLabel(data.ha.wallConnector)}
        sublabel={data.ha.wallConnector.status?.state ?? ''}
        accent={data.ha.wallConnector.charging}
      />
      <StatCard
        label="Power"
        value={formatNumber(data.ha.wallConnector.powerKw, 1)}
        unit="kW"
        sublabel={connectorDetail(data.ha.wallConnector)}
      />
      <StatCard
        label="Session energy"
        value={formatNumber(data.ha.wallConnector.sessionKwh, 1)}
        unit="kWh"
        sublabel={data.ha.wallConnector.totalKwh !== null ? `${formatNumber(data.ha.wallConnector.totalKwh, 0)} kWh lifetime` : ''}
      />
      <StatCard
        label="Range energy"
        value={formatNumber(data.ha.wallConnector.rangeKwh, 1)}
        unit="kWh"
        sublabel={rangeLabels[data.range]}
      />
      <StatCard
        label="Est. cost"
        value={formatMoney(data.ha.wallConnector.rangeCost)}
        sublabel={`${formatCostRate(data.ha.wallConnector.costRate)}/kWh`}
      />
    </div>

    <div class="house__range">
      <p class="house__range-label">
        Charging history &mdash; <em>{rangeLabels[data.range]}</em>
      </p>
      <div class="house__range-tabs" role="group" aria-label="Charging time range">
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

    {#if data.charts.wallConnectorEnergy.length > 0 || data.charts.wallConnectorPower.length > 0}
      <div class="figure-grid">
        {#if data.charts.wallConnectorEnergy.length > 0}
          <figure class="chart-panel">
            <figcaption>Energy added</figcaption>
            <p class="house__coverage">
              {data.ha.wallConnector.historyLabel}
            </p>
            <div class="chart-panel__body">
              <BarChart
                labels={data.charts.wallConnectorEnergy.map(d => d.time)}
                data={data.charts.wallConnectorEnergy.map(d => d.kwh)}
                label="kWh"
                unit=" kWh"
                colors={data.charts.wallConnectorEnergy.map(() => 'var(--color-chart-charging)')}
              />
            </div>
          </figure>
        {/if}
        {#if data.charts.wallConnectorPower.length > 0}
          <figure class="chart-panel">
            <figcaption>Average charging power</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.charts.wallConnectorPower.map(d => d.time)}
                data={data.charts.wallConnectorPower.map(d => d.kw)}
                label="kW"
                unit=" kW"
                color="var(--color-chart-charging)"
                beginAtZero
              />
            </div>
          </figure>
        {/if}
      </div>
    {:else}
      <p class="house__note">Charging history is not available yet. Live Wall Connector values will appear as Home Assistant reports them.</p>
    {/if}

    {#if data.ha.wallConnector.handleTemp !== null || data.ha.wallConnector.pcbTemp !== null || data.ha.wallConnector.mcuTemp !== null}
      <p class="house__detail">
        Temps:
        {#if data.ha.wallConnector.handleTemp !== null}handle {formatNumber(data.ha.wallConnector.handleTemp, 0)}°F{/if}
        {#if data.ha.wallConnector.pcbTemp !== null} / PCB {formatNumber(data.ha.wallConnector.pcbTemp, 0)}°F{/if}
        {#if data.ha.wallConnector.mcuTemp !== null} / MCU {formatNumber(data.ha.wallConnector.mcuTemp, 0)}°F{/if}
      </p>
    {/if}
  </section>

  {#if data.charts.indoorTemp.length > 0 || data.charts.outdoorTemp.length > 0}
    <section class="house__section reveal">
      <SectionHeader title="Temperature" meta="7-day history" />
      <div class="figure-grid">
        {#if data.charts.indoorTemp.length > 0}
          <figure class="chart-panel">
            <figcaption>Indoor temperature</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.charts.indoorTemp.map(p => p.time)}
                data={data.charts.indoorTemp.map(p => p.value)}
                label="Indoor °F"
                unit="°"
                color="var(--color-chart-temp)"
              />
            </div>
          </figure>
        {/if}
        {#if data.charts.outdoorTemp.length > 0}
          <figure class="chart-panel">
            <figcaption>Outdoor temperature</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.charts.outdoorTemp.map(p => p.time)}
                data={data.charts.outdoorTemp.map(p => p.value)}
                label="Outdoor °F"
                unit="°"
                color="var(--color-chart-weather)"
              />
            </div>
          </figure>
        {/if}
      </div>
    </section>
  {/if}

  <section class="house__section reveal">
    <SectionHeader title="Entertainment" meta="Live + history" />
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
      <figure class="chart-panel">
        <figcaption>Bedroom TV on-time</figcaption>
        <p class="house__coverage">{coverageNote(data.tvCoverage.bedroomDays, data.tvCoverage.requestedDays)}</p>
        <div class="chart-panel__body">
          <BarChart
            labels={data.charts.bedroomTVHours.map(d => d.time)}
            data={data.charts.bedroomTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
            colors={data.charts.bedroomTVHours.map(() => 'var(--color-chart-tv)')}
          />
        </div>
      </figure>
      <figure class="chart-panel">
        <figcaption>Living Room TV on-time</figcaption>
        <p class="house__coverage">{coverageNote(data.tvCoverage.livingDays, data.tvCoverage.requestedDays)}</p>
        <div class="chart-panel__body">
          <BarChart
            labels={data.charts.livingTVHours.map(d => d.time)}
            data={data.charts.livingTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
            colors={data.charts.livingTVHours.map(() => 'var(--color-chart-tv)')}
          />
        </div>
      </figure>
    </div>
  </section>

  {#if data.forecast.length > 0}
    <section class="house__section reveal">
      <SectionHeader title="The Forecast" meta="7 days, Taneytown" />
      <div class="chart-panel">
        <div class="forecast">
          {#each data.forecast as day}
            {@const wx = wxInfo(day.weatherCode)}
            <div class="forecast__day" style="border-top: 2px solid {wx.color}">
              <span class="forecast__date">{formatDate(day.date)}</span>
              <span class="forecast__icon" aria-hidden="true">{wx.icon}</span>
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
  .house__detail {
    margin: 1rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.75rem;
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
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
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
    grid-template-columns: repeat(auto-fit, minmax(4.25rem, 1fr));
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
    border-top: 2px solid var(--color-paper-300);
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
  .forecast__icon {
    font-size: 1.125rem;
    line-height: 1;
    margin-bottom: 0.1rem;
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
