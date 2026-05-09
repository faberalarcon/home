<script lang="ts">
  import type { WeatherData } from './content';

  export let weather: WeatherData | null;

  const fullForecast = 'https://forecast.weather.gov/MapClick.php?CityName=Taneytown&state=MD&site=LWX&textField1=39.6576&textField2=-77.1763';

  function wmoIcon(code: number): string {
    if (code === 0) return '☀️';
    if (code <= 2) return code === 1 ? '🌤️' : '⛅';
    if (code === 3) return '☁️';
    if (code <= 48) return '🌫️';
    if (code <= 55) return '🌦️';
    if (code <= 65) return '🌧️';
    if (code <= 75) return code <= 71 ? '🌨️' : '❄️';
    if (code <= 82) return code <= 80 ? '🌦️' : '🌧️';
    if (code <= 86) return '🌨️';
    return '⛈️';
  }

  function wmoDesc(code: number): string {
    if (code === 0) return 'Clear sky';
    if (code === 1) return 'Mainly clear';
    if (code === 2) return 'Partly cloudy';
    if (code === 3) return 'Overcast';
    if (code <= 48) return 'Foggy';
    if (code <= 53) return code <= 51 ? 'Light drizzle' : 'Drizzle';
    if (code === 55) return 'Dense drizzle';
    if (code <= 63) return code <= 61 ? 'Light rain' : 'Rain';
    if (code === 65) return 'Heavy rain';
    if (code <= 73) return code <= 71 ? 'Light snow' : 'Snow';
    if (code === 75) return 'Heavy snow';
    if (code <= 82) return 'Rain showers';
    if (code <= 86) return 'Snow showers';
    return 'Thunderstorm';
  }
</script>

{#if weather}
  <div class="weather-card bg-sage-50 border border-sage-200 rounded-lg p-5 shadow-sm flex flex-col gap-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-3 mb-1">
          <span class="weather-icon-ring inline-flex items-center justify-center w-14 h-14 rounded-full text-3xl" aria-hidden="true">{wmoIcon(weather.current.code)}</span>
          <span class="text-4xl font-bold text-warm-800 leading-none">{weather.current.temp}°F</span>
        </div>
        <p class="text-sage-700 font-medium text-sm">{wmoDesc(weather.current.code)}</p>
        <p class="text-sage-600 text-xs mt-0.5">Taneytown, MD</p>
      </div>
      <div class="text-right flex-shrink-0">
        <p class="text-sage-600 font-semibold text-xs uppercase tracking-wide">Weather</p>
        <p class="text-sage-500 text-xs mt-0.5">As of {weather.fetchedAt}</p>
      </div>
    </div>

    <div class="grid grid-cols-3 gap-2 pt-3 border-t border-sage-200">
      {#each weather.daily as day}
        <div class="text-center">
          <p class="text-xs font-semibold text-sage-600 mb-1">{day.label}</p>
          <span class="text-xl" aria-hidden="true">{wmoIcon(day.code)}</span>
          <p class="text-xs text-warm-800 mt-1">
            <span class="font-semibold">{day.high}°</span>
            <span class="text-sage-500"> / {day.low}°</span>
          </p>
        </div>
      {/each}
    </div>

    <a href={fullForecast} class="text-xs text-center text-sage-600 hover:text-sage-800 transition-colors" target="_blank" rel="noopener noreferrer">
      Full forecast →
    </a>
  </div>
{:else}
  <a
    href={fullForecast}
    class="weather-card group flex gap-5 p-6 rounded-lg border transition-all duration-200 shadow-sm hover:shadow-md bg-sage-50 border-sage-200 hover:border-sage-400"
    target="_blank"
    rel="noopener noreferrer"
    aria-label="Taneytown Weather (opens in new tab)"
  >
    <div class="flex-shrink-0 w-12 h-12 rounded-xl bg-sage-100 flex items-center justify-center text-2xl" aria-hidden="true">🌤️</div>
    <div class="flex-1 min-w-0">
      <h3 class="font-semibold text-warm-800 group-hover:text-warm-600 transition-colors flex items-center gap-2">Taneytown Weather</h3>
      <p class="text-gray-500 text-sm mt-1 leading-relaxed">Current conditions and forecast for Taneytown, Carroll County, Maryland.</p>
    </div>
  </a>
{/if}

<style>
  .weather-icon-ring {
    background:
      radial-gradient(circle at 50% 50%, var(--color-sage-50) 58%, transparent 59%),
      conic-gradient(from 210deg, var(--color-warm-400), var(--color-sage-400), var(--color-warm-300), var(--color-warm-400));
    box-shadow: inset 0 0 0 1px rgba(148, 163, 184, 0.3);
  }
</style>
