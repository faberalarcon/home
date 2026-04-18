import { getStates, ENTITIES } from '$lib/server/home-assistant';
import { getCurrentWeather, getDailyForecast, getYearStats, weatherCodeToDescription } from '$lib/server/weather';
import { generateLimonStats } from '$lib/server/limon';
import { getUniqueVisitorCount } from '$lib/server/visitors';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Fetch all data sources in parallel, gracefully handling failures
  const [haStates, currentWeather, forecast, yearStats, visitors] = await Promise.all([
    getStates(Object.values(ENTITIES)).catch(() => new Map()),
    getCurrentWeather().catch(() => null),
    getDailyForecast().catch(() => []),
    getYearStats().catch(() => null),
    getUniqueVisitorCount().catch(() => null)
  ]);

  // Parse HA data
  const get = (key: keyof typeof ENTITIES) => {
    const s = haStates.get(ENTITIES[key]);
    return s ? { state: s.state, attrs: s.attributes } : null;
  };

  const indoorTemp = get('indoorTemp');
  const humidity = get('humidity');
  const hvac = get('hvacMode');
  const outdoorTemp = get('outdoorTemp');
  const alarm = get('alarm');
  const download = get('downloadSpeed');
  const upload = get('uploadSpeed');
  const livingTV = get('livingRoomTV');
  const bedroomTV = get('bedroomTV');
  const xbox = get('xbox');
  const gamerscore = get('gamerscore');
  const nowPlaying = get('nowPlaying');
  const sunrise = get('sunrise');
  const sunset = get('sunset');

  // Weather description
  const weatherDesc = currentWeather
    ? weatherCodeToDescription(currentWeather.weatherCode, currentWeather.isDay)
    : null;

  // Limón stats — use outdoor temp if available
  const outdoorTempF = outdoorTemp ? parseFloat(outdoorTemp.state) : null;
  const limonStats = generateLimonStats(outdoorTempF);

  return {
    ha: {
      available: haStates.size > 0,
      indoor: indoorTemp ? { temp: parseFloat(indoorTemp.state), unit: '°F' } : null,
      humidity: humidity ? parseFloat(humidity.state) : null,
      hvacMode: hvac?.state ?? null,
      outdoor: outdoorTemp && outdoorTemp.state !== 'unavailable'
        ? { temp: parseFloat(outdoorTemp.state), unit: '°F' }
        : null,
      alarm: alarm?.state ?? null,
      network: download && upload
        ? {
            down: parseFloat(download.state),
            up: parseFloat(upload.state),
            unit: 'KiB/s'
          }
        : null,
      tvs: [
        { name: 'Living Room TV', on: livingTV?.state === 'on' || livingTV?.state === 'playing' },
        { name: 'Bedroom TV', on: bedroomTV?.state === 'on' || bedroomTV?.state === 'playing' }
      ],
      xbox: {
        on: xbox?.state === 'on' || xbox?.state === 'playing',
        nowPlaying: nowPlaying?.state !== 'unknown' && nowPlaying?.state ? nowPlaying.state : null,
        gamerscore: gamerscore ? parseInt(gamerscore.state) : null
      },
      sun: {
        sunrise: sunrise?.state ?? null,
        sunset: sunset?.state ?? null
      }
    },
    weather: currentWeather
      ? {
          ...currentWeather,
          description: weatherDesc?.text ?? 'Unknown',
          icon: weatherDesc?.icon ?? '❓'
        }
      : null,
    forecast,
    yearStats,
    limonStats,
    visitors
  };
};
