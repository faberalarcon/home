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
    armed_night: 'Armed Night', disarmed: 'Disarmed', triggered: '⚠️ TRIGGERED'
  };
</script>

<svelte:head>
  <title>House — 21 Bristoe Stats</title>
  <meta name="description" content="House status and historical data" />
</svelte:head>

<div class="space-y-10">
  <div class="text-center pb-2">
    <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
      <span class="text-accent">House</span> Status
    </h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400">Live sensors and rolling history</p>
  </div>

  {#if !data.ha.available}
    <div class="rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50 dark:bg-sky-950/30 p-4 text-sm text-sky-700 dark:text-sky-400">
      Home Assistant unavailable — showing last known data where possible
    </div>
  {/if}

  <!-- Current Readings -->
  <section>
    <SectionHeader title="Current Readings" icon="📡" />
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard
        label="Indoor Temp"
        value={data.ha.indoor ? `${Math.round(parseFloat(data.ha.indoor.state))}` : '--'}
        unit="°F"
        icon="🌡️"
        sublabel={data.ha.humidity ? `${data.ha.humidity.state}% humidity` : ''}
        accent
      />
      <StatCard
        label="Outdoor Temp"
        value={data.ha.outdoor && data.ha.outdoor.state !== 'unavailable' ? `${Math.round(parseFloat(data.ha.outdoor.state))}` : '--'}
        unit="°F"
        icon="🌿"
        sublabel={data.ha.hvac ? `HVAC: ${data.ha.hvac.state}` : ''}
      />
      <StatCard
        label="Security"
        value={data.ha.alarm ? (alarmLabels[data.ha.alarm.state] ?? data.ha.alarm.state) : '--'}
        icon="🔒"
      />
      <StatCard
        label="Network"
        value={data.ha.download ? formatSpeed(parseFloat(data.ha.download.state)) : '--'}
        icon="📡"
        sublabel={data.ha.upload ? `↑ ${formatSpeed(parseFloat(data.ha.upload.state))}` : ''}
      />
    </div>
  </section>

  <!-- Temperature History -->
  {#if data.charts.indoorTemp.length > 0 || data.charts.outdoorTemp.length > 0}
    <section>
      <SectionHeader title="Temperature — Last 7 Days" icon="🌡️" />
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {#if data.charts.indoorTemp.length > 0}
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Indoor (°F)</p>
            <LineChart
              labels={data.charts.indoorTemp.map(p => p.time)}
              data={data.charts.indoorTemp.map(p => p.value)}
              label="Indoor °F"
              color="#7dd3fc"
              unit="°"
            />
          </div>
        {/if}
        {#if data.charts.outdoorTemp.length > 0}
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Outdoor (°F)</p>
            <LineChart
              labels={data.charts.outdoorTemp.map(p => p.time)}
              data={data.charts.outdoorTemp.map(p => p.value)}
              label="Outdoor °F"
              color="#38bdf8"
              unit="°"
            />
          </div>
        {/if}
      </div>
    </section>
  {/if}

  <!-- Entertainment -->
  <section>
    <SectionHeader title="Entertainment" icon="📺" />
    <div class="flex flex-wrap gap-3 mb-5">
      <StatusBadge label="Living Room TV" active={data.ha.livingTV?.state === 'on' || data.ha.livingTV?.state === 'playing'} />
      <StatusBadge label="Bedroom TV" active={data.ha.bedroomTV?.state === 'on' || data.ha.bedroomTV?.state === 'playing'} />
      <StatusBadge
        label="Xbox"
        active={data.ha.xbox?.state === 'on' || data.ha.xbox?.state === 'playing'}
        activeText={data.ha.nowPlaying?.state && data.ha.nowPlaying.state !== 'unknown' ? data.ha.nowPlaying.state : 'On'}
      />
    </div>
    {#if data.ha.gamerscore}
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard label="Gamerscore" value={parseInt(data.ha.gamerscore.state).toLocaleString()} unit="pts" icon="🎮" />
      </div>
    {/if}

    <!-- TV on-time — rolling window, switchable range -->
    <div class="mt-6">
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <p class="text-sm font-medium text-slate-600 dark:text-slate-300">
          TV on-time — <span class="text-slate-500 dark:text-slate-400">{rangeLabels[data.range]}</span>
        </p>
        <div class="inline-flex rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-1" role="group" aria-label="Time range">
          {#each rangeOptions as opt}
            <a
              href="?range={opt.value}"
              data-sveltekit-noscroll
              aria-current={data.range === opt.value ? 'page' : undefined}
              class="px-3 py-1 text-xs font-medium rounded-md transition-colors {data.range === opt.value
                ? 'bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'}"
            >
              {opt.label}
            </a>
          {/each}
        </div>
      </div>

      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div class="flex items-baseline justify-between mb-3">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Bedroom TV (hrs)</p>
            <p class="text-xs text-slate-400 dark:text-slate-500">{coverageNote(data.tvCoverage.bedroomDays, data.tvCoverage.requestedDays)}</p>
          </div>
          <BarChart
            labels={data.charts.bedroomTVHours.map(d => d.time)}
            data={data.charts.bedroomTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
          />
        </div>
        <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div class="flex items-baseline justify-between mb-3">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400">Living Room TV (hrs)</p>
            <p class="text-xs text-slate-400 dark:text-slate-500">{coverageNote(data.tvCoverage.livingDays, data.tvCoverage.requestedDays)}</p>
          </div>
          <BarChart
            labels={data.charts.livingTVHours.map(d => d.time)}
            data={data.charts.livingTVHours.map(d => d.hours)}
            label="Hours"
            unit="h"
          />
        </div>
      </div>
    </div>
  </section>

  <!-- 7-Day Forecast -->
  {#if data.forecast.length > 0}
    <section>
      <SectionHeader title="7-Day Forecast" icon="🌤️" />
      <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
        <div class="grid grid-cols-7 gap-2">
          {#each data.forecast as day}
            {@const icons: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️' }}
            <div class="flex flex-col items-center text-center gap-1 p-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
              <span class="text-xs text-slate-400 dark:text-slate-500">{formatDate(day.date)}</span>
              <span class="text-2xl">{icons[day.weatherCode] ?? '🌤️'}</span>
              <span class="text-sm font-semibold text-slate-800 dark:text-slate-200">{Math.round(day.tempMax)}°</span>
              <span class="text-xs text-slate-400 dark:text-slate-500">{Math.round(day.tempMin)}°</span>
              {#if day.precipitationSum > 0}
                <span class="text-xs text-sky-400">{day.precipitationSum.toFixed(1)}mm</span>
              {/if}
            </div>
          {/each}
        </div>
      </div>
    </section>
  {/if}
</div>
