<script lang="ts">
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import LineChart from '$lib/components/LineChart.svelte';
  import BarChart from '$lib/components/BarChart.svelte';

  let { data } = $props();

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
    <p class="mt-2 text-slate-500 dark:text-slate-400">Live sensors and 7-day history</p>
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

    <!-- TV hours per day charts -->
    {#if data.charts.bedroomTVHours.length > 0 || data.charts.livingTVHours.length > 0}
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {#if data.charts.bedroomTVHours.length > 0}
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Bedroom TV on-time (hrs/day)</p>
            <BarChart
              labels={data.charts.bedroomTVHours.map(d => formatDate(d.date))}
              data={data.charts.bedroomTVHours.map(d => d.hours)}
              label="Hours"
            />
          </div>
        {/if}
        {#if data.charts.livingTVHours.length > 0}
          <div class="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Living Room TV on-time (hrs/day)</p>
            <BarChart
              labels={data.charts.livingTVHours.map(d => formatDate(d.date))}
              data={data.charts.livingTVHours.map(d => d.hours)}
              label="Hours"
            />
          </div>
        {/if}
      </div>
    {/if}
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
