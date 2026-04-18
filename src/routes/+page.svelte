<script lang="ts">
  import StatCard from '$lib/components/StatCard.svelte';
  import StatusBadge from '$lib/components/StatusBadge.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';

  let { data } = $props();

  function formatTime(iso: string | null): string {
    if (!iso) return '--';
    try {
      return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch {
      return '--';
    }
  }

  function formatSpeed(kibps: number): string {
    if (kibps >= 1024) return `${(kibps / 1024).toFixed(1)} MiB/s`;
    return `${Math.round(kibps)} KiB/s`;
  }

  function formatDate(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return dateStr;
    }
  }

  function forecastIcon(code: number): string {
    const map: Record<number, string> = { 0: '☀️', 1: '🌤️', 2: '⛅', 3: '☁️', 45: '🌫️', 51: '🌦️', 61: '🌧️', 63: '🌧️', 65: '🌧️', 71: '🌨️', 80: '🌦️', 95: '⛈️' };
    return map[code] ?? '🌤️';
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
  <title>21 Bristoe Stats</title>
  <meta name="description" content="Household dashboard for 21 Bristoe Station Rd, Taneytown MD" />
</svelte:head>

<div class="space-y-10">
  <!-- Hero -->
  <div class="text-center pb-2">
    <h1 class="text-4xl sm:text-5xl font-bold tracking-tight">
      <span class="text-accent">21 Bristoe</span> Stats
    </h1>
    <p class="mt-2 text-slate-500 dark:text-slate-400">Taneytown, MD &middot; Live household dashboard</p>
  </div>

  <!-- House Status -->
  <section>
    <SectionHeader title="House Status" icon="🏠" />
    {#if !data.ha.available}
      <div class="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-4 text-sm text-amber-700 dark:text-amber-400">
        Home Assistant unavailable — some data may be missing
      </div>
    {/if}
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
      <StatCard
        label="Indoor"
        value={data.ha.indoor ? `${Math.round(data.ha.indoor.temp)}` : '--'}
        unit="°F"
        icon="🌡️"
        sublabel={data.ha.humidity != null ? `${data.ha.humidity}% humidity` : ''}
      />
      <StatCard
        label="Outdoor"
        value={data.ha.outdoor ? `${Math.round(data.ha.outdoor.temp)}` : '--'}
        unit="°F"
        icon="🌿"
        sublabel={data.ha.hvacMode ? `HVAC: ${data.ha.hvacMode}` : ''}
      />
      <StatCard
        label="Security"
        value={data.ha.alarm ? alarmLabels[data.ha.alarm] ?? data.ha.alarm : '--'}
        icon="🔒"
      />
      <StatCard
        label="Network"
        value={data.ha.network ? formatSpeed(data.ha.network.down) : '--'}
        icon="📡"
        sublabel={data.ha.network ? `↑ ${formatSpeed(data.ha.network.up)}` : ''}
      />
    </div>
  </section>

  <!-- Weather -->
  {#if data.weather}
    <section>
      <SectionHeader title="Taneytown Weather" icon="🌤️" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div class="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
          <div class="flex items-center gap-4">
            <span class="text-5xl">{data.weather.icon}</span>
            <div>
              <p class="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {Math.round(data.weather.temperature)}°F
              </p>
              <p class="text-sm text-slate-500 dark:text-slate-400">{data.weather.description}</p>
              <p class="text-xs text-slate-400 dark:text-slate-500">
                Feels like {Math.round(data.weather.apparentTemperature)}°F &middot; Wind {Math.round(data.weather.windSpeed)} mph
              </p>
            </div>
          </div>
        </div>
        {#if data.forecast.length > 0}
          <div class="col-span-2 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5">
            <p class="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">7-Day Forecast</p>
            <div class="flex gap-2 overflow-x-auto">
              {#each data.forecast as day}
                <div class="flex flex-col items-center min-w-[3.5rem] text-center">
                  <span class="text-xs text-slate-400 dark:text-slate-500">{formatDate(day.date)}</span>
                  <span class="text-lg my-1">{forecastIcon(day.weatherCode)}</span>
                  <span class="text-xs font-medium text-slate-700 dark:text-slate-300">{Math.round(day.tempMax)}°</span>
                  <span class="text-xs text-slate-400 dark:text-slate-500">{Math.round(day.tempMin)}°</span>
                </div>
              {/each}
            </div>
          </div>
        {/if}
      </div>

      {#if data.yearStats}
        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <StatCard label="Rainy days this year" value={data.yearStats.rainyDaysThisYear} icon="🌧️" />
          <StatCard label="Sunny days this year" value={data.yearStats.sunnyDaysThisYear} icon="☀️" />
          {#if data.yearStats.hottestDay}
            <StatCard label="Hottest day" value="{data.yearStats.hottestDay.temp}°F" icon="🔥" sublabel={formatDate(data.yearStats.hottestDay.date)} />
          {/if}
          {#if data.yearStats.coldestDay}
            <StatCard label="Coldest day" value="{data.yearStats.coldestDay.temp}°F" icon="🥶" sublabel={formatDate(data.yearStats.coldestDay.date)} />
          {/if}
          <StatCard label="Days since rain" value={data.yearStats.daysSinceRain} icon="💧" />
        </div>
      {/if}
    </section>
  {/if}

  <!-- TV & Entertainment -->
  <section>
    <SectionHeader title="Entertainment" icon="📺" />
    <div class="flex flex-wrap gap-3 mb-4">
      {#each data.ha.tvs as tv}
        <StatusBadge label={tv.name} active={tv.on} />
      {/each}
      <StatusBadge label="Xbox" active={data.ha.xbox.on} activeText={data.ha.xbox.nowPlaying ?? 'On'} />
    </div>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {#if data.ha.xbox.gamerscore != null}
        <StatCard label="Gamerscore" value={data.ha.xbox.gamerscore.toLocaleString()} icon="🎮" unit="pts" />
      {/if}
      <StatCard label="Sunrise" value={formatTime(data.ha.sun.sunrise)} icon="🌅" />
      <StatCard label="Sunset" value={formatTime(data.ha.sun.sunset)} icon="🌇" />
    </div>
  </section>

  <!-- Taneytown Fun Facts -->
  {#if data.yearStats}
    <section>
      <SectionHeader title="Taneytown, MD — {new Date().getFullYear()} So Far" icon="📍" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Rainy days this year"
          value={data.yearStats.rainyDaysThisYear}
          icon="🌧️"
          sublabel="days with >0.5mm precip"
        />
        <StatCard
          label="Sunny days this year"
          value={data.yearStats.sunnyDaysThisYear}
          icon="☀️"
          sublabel="clear or mainly clear"
        />
        {#if data.yearStats.hottestDay}
          <StatCard
            label="Hottest day"
            value="{Math.round(data.yearStats.hottestDay.temp)}°F"
            icon="🔥"
            sublabel={formatDate(data.yearStats.hottestDay.date)}
          />
        {/if}
        {#if data.yearStats.coldestDay}
          <StatCard
            label="Coldest day"
            value="{Math.round(data.yearStats.coldestDay.temp)}°F"
            icon="🥶"
            sublabel={formatDate(data.yearStats.coldestDay.date)}
          />
        {/if}
        <StatCard
          label="Days since last rain"
          value={data.yearStats.daysSinceRain}
          icon="💧"
          sublabel={data.yearStats.daysSinceRain === 0 ? "Raining now!" : data.yearStats.daysSinceRain === 1 ? "Yesterday" : "days of dry weather"}
        />
        {#if data.yearStats.avgTempThisMonth}
          <StatCard
            label="Avg temp this month"
            value="{data.yearStats.avgTempThisMonth}°F"
            icon="🌡️"
          />
        {/if}
      </div>
    </section>
  {/if}

  <!-- Site Traffic -->
  {#if data.visitors}
    <section>
      <SectionHeader title="Site Traffic" icon="👋" />
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Unique visitors"
          value={data.visitors.count.toLocaleString()}
          icon="👀"
          sublabel="21bristoe.com + stats"
        />
      </div>
    </section>
  {/if}

  <!-- Limón -->
  <section>
    <SectionHeader title="Limón Report" icon="🐕" />
    <p class="text-sm text-slate-500 dark:text-slate-400 -mt-2 mb-4 italic">
      Daily stats for our golden retriever
      {#if data.ha.outdoor}
        · Today {Math.round(data.ha.outdoor.temp)}°F outside
      {/if}
      (totally accurate, definitely not made up)
    </p>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {#each data.limonStats as stat}
        <div class="group relative rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 transition-all duration-300 hover:shadow-lg hover:-translate-y-0.5">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <p class="text-sm font-medium text-slate-500 dark:text-slate-400 truncate">{stat.label}</p>
              <p class="mt-1 text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{stat.value}</p>
            </div>
            <span class="text-2xl flex-shrink-0 group-hover:scale-125 transition-transform duration-300">{stat.icon}</span>
          </div>
        </div>
      {/each}
    </div>
    <p class="mt-3 text-xs text-center text-slate-400 dark:text-slate-600 italic">
      Stats refresh on each page load for maximum scientific accuracy
    </p>
  </section>
</div>
