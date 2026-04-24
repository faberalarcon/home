const LAT = 39.6576;
const LON = -77.1763;
const TIMEOUT = 5000;

export interface CurrentWeather {
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  windSpeed: number;
  weatherCode: number;
  isDay: boolean;
}

export interface DailyWeather {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationSum: number;
  weatherCode: number;
}

export interface WeatherStats {
  rainyDaysThisYear: number;
  sunnyDaysThisYear: number;
  hottestDay: { date: string; temp: number } | null;
  coldestDay: { date: string; temp: number } | null;
  avgTempThisMonth: number | null;
  daysSinceRain: number;
}

export async function getCurrentWeather(): Promise<CurrentWeather> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code,is_day&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=America%2FNew_York`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const data = await res.json();
  const c = data.current;
  return {
    temperature: c.temperature_2m,
    apparentTemperature: c.apparent_temperature,
    humidity: c.relative_humidity_2m,
    windSpeed: c.wind_speed_10m,
    weatherCode: c.weather_code,
    isDay: c.is_day === 1
  };
}

export async function getHourlyOutdoorTemps(pastDays = 7): Promise<{ time: string; value: number }[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&hourly=temperature_2m&temperature_unit=fahrenheit&timezone=America%2FNew_York&timeformat=unixtime&past_days=${pastDays}&forecast_days=1`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const data = await res.json();
  const h = data.hourly;
  if (!h?.time) return [];
  const nowSec = Math.floor(Date.now() / 1000);
  const labelFmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    hour: 'numeric'
  });
  const out: { time: string; value: number }[] = [];
  for (let i = 0; i < h.time.length; i++) {
    const tsSec = h.time[i];
    if (tsSec > nowSec) break;
    const val = h.temperature_2m[i];
    if (val == null) continue;
    out.push({ time: labelFmt.format(new Date(tsSec * 1000)), value: Math.round(val * 10) / 10 });
  }
  return out;
}

export async function getDailyForecast(): Promise<DailyWeather[]> {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&forecast_days=7`;

  const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT) });
  if (!res.ok) throw new Error(`Open-Meteo ${res.status}`);

  const data = await res.json();
  const d = data.daily;
  return d.time.map((date: string, i: number) => ({
    date,
    tempMax: d.temperature_2m_max[i],
    tempMin: d.temperature_2m_min[i],
    precipitationSum: d.precipitation_sum[i],
    weatherCode: d.weather_code[i]
  }));
}

export async function getYearStats(): Promise<WeatherStats> {
  const now = new Date();
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }).split('-')[0];
  const yearStart = `${year}-01-01`;
  const today = now.toLocaleDateString('en-CA', { timeZone: 'America/New_York' });

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&start_date=${yearStart}&end_date=${today}&past_days=0`;

  // Open-Meteo archive API for past dates
  const archiveUrl = `https://archive-api.open-meteo.com/v1/archive?latitude=${LAT}&longitude=${LON}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,weather_code&temperature_unit=fahrenheit&precipitation_unit=inch&timezone=America%2FNew_York&start_date=${yearStart}&end_date=${today}`;

  const res = await fetch(archiveUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`Open-Meteo archive ${res.status}`);

  const data = await res.json();
  const d = data.daily;

  if (!d || !d.time || d.time.length === 0) {
    return {
      rainyDaysThisYear: 0,
      sunnyDaysThisYear: 0,
      hottestDay: null,
      coldestDay: null,
      avgTempThisMonth: null,
      daysSinceRain: 0
    };
  }

  const SNOW_CODES = new Set([71, 73, 75, 77, 85, 86]);
  let rainyDays = 0;
  let sunnyDays = 0;
  let hottestDay: { date: string; temp: number } | null = null;
  let coldestDay: { date: string; temp: number } | null = null;
  let daysSinceRain = 0;
  let foundRecentRain = false;
  const currentMonth = now.getMonth();
  let monthTempSum = 0;
  let monthTempCount = 0;

  for (let i = 0; i < d.time.length; i++) {
    const precip = d.precipitation_sum[i] ?? 0;
    const maxTemp = d.temperature_2m_max[i];
    const minTemp = d.temperature_2m_min[i];
    const code = d.weather_code[i];
    const date = d.time[i];
    const dateMonth = new Date(date + 'T12:00:00').getMonth();

    if (precip > 0.01 && !SNOW_CODES.has(code)) rainyDays++;
    if (code <= 1) sunnyDays++; // WMO: 0 = clear, 1 = mainly clear

    if (maxTemp != null && (!hottestDay || maxTemp > hottestDay.temp)) {
      hottestDay = { date, temp: maxTemp };
    }
    if (minTemp != null && (!coldestDay || minTemp < coldestDay.temp)) {
      coldestDay = { date, temp: minTemp };
    }

    if (dateMonth === currentMonth && maxTemp != null && minTemp != null) {
      monthTempSum += (maxTemp + minTemp) / 2;
      monthTempCount++;
    }
  }

  // Days since last rain — count backwards from today
  for (let i = d.time.length - 1; i >= 0; i--) {
    if ((d.precipitation_sum[i] ?? 0) > 0.01) {
      foundRecentRain = true;
      break;
    }
    daysSinceRain++;
  }

  return {
    rainyDaysThisYear: rainyDays,
    sunnyDaysThisYear: sunnyDays,
    hottestDay,
    coldestDay,
    avgTempThisMonth: monthTempCount > 0 ? Math.round(monthTempSum / monthTempCount) : null,
    daysSinceRain: foundRecentRain ? daysSinceRain : d.time.length
  };
}

// WMO weather code to description + emoji
export function weatherCodeToDescription(code: number, isDay = true): { text: string; icon: string } {
  const map: Record<number, { text: string; dayIcon: string; nightIcon: string }> = {
    0: { text: 'Clear sky', dayIcon: '☀️', nightIcon: '🌙' },
    1: { text: 'Mainly clear', dayIcon: '🌤️', nightIcon: '🌙' },
    2: { text: 'Partly cloudy', dayIcon: '⛅', nightIcon: '☁️' },
    3: { text: 'Overcast', dayIcon: '☁️', nightIcon: '☁️' },
    45: { text: 'Foggy', dayIcon: '🌫️', nightIcon: '🌫️' },
    48: { text: 'Rime fog', dayIcon: '🌫️', nightIcon: '🌫️' },
    51: { text: 'Light drizzle', dayIcon: '🌦️', nightIcon: '🌧️' },
    53: { text: 'Drizzle', dayIcon: '🌦️', nightIcon: '🌧️' },
    55: { text: 'Dense drizzle', dayIcon: '🌧️', nightIcon: '🌧️' },
    61: { text: 'Light rain', dayIcon: '🌦️', nightIcon: '🌧️' },
    63: { text: 'Rain', dayIcon: '🌧️', nightIcon: '🌧️' },
    65: { text: 'Heavy rain', dayIcon: '🌧️', nightIcon: '🌧️' },
    71: { text: 'Light snow', dayIcon: '🌨️', nightIcon: '🌨️' },
    73: { text: 'Snow', dayIcon: '🌨️', nightIcon: '🌨️' },
    75: { text: 'Heavy snow', dayIcon: '🌨️', nightIcon: '🌨️' },
    80: { text: 'Rain showers', dayIcon: '🌦️', nightIcon: '🌧️' },
    81: { text: 'Moderate showers', dayIcon: '🌧️', nightIcon: '🌧️' },
    82: { text: 'Heavy showers', dayIcon: '🌧️', nightIcon: '🌧️' },
    85: { text: 'Snow showers', dayIcon: '🌨️', nightIcon: '🌨️' },
    86: { text: 'Heavy snow showers', dayIcon: '🌨️', nightIcon: '🌨️' },
    95: { text: 'Thunderstorm', dayIcon: '⛈️', nightIcon: '⛈️' },
    96: { text: 'Thunderstorm + hail', dayIcon: '⛈️', nightIcon: '⛈️' },
    99: { text: 'Heavy thunderstorm', dayIcon: '⛈️', nightIcon: '⛈️' }
  };

  const entry = map[code] ?? { text: 'Unknown', dayIcon: '❓', nightIcon: '❓' };
  return { text: entry.text, icon: isDay ? entry.dayIcon : entry.nightIcon };
}
