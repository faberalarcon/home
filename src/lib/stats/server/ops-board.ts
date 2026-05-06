import { ENTITIES, getStates } from '$lib/stats/server/home-assistant';
import { fetchDrinkHubStats } from '$lib/stats/server/drink-hub';
import { getCurrentWeather, getDailyForecast, weatherCodeToDescription } from '$lib/stats/server/weather';
import { getVisitorLocationStats } from '$lib/stats/server/visitors';
import { getPiMetrics } from '$lib/stats/server/pi-metrics';
import { readBackupManifest } from '$lib/stats/server/backups';
import { TIERS, backupAgeLabel, formatBytes, humanAge, staleness, tierNotDueYet } from '$lib/stats/backups';
import type { BackupManifest, BackupTier } from '$lib/stats/backups';
import type { DailyWeather } from '$lib/stats/server/weather';

type Severity = 'ok' | 'watch' | 'attention';

interface StateLike {
  state: string;
  attrs: Record<string, unknown>;
}

export interface OpsSignal {
  id: string;
  label: string;
  value: string;
  detail: string;
  severity: Severity;
}

export interface OpsBoard {
  status: {
    severity: Severity;
    label: string;
    headline: string;
    detail: string;
    updatedAt: string;
    attentionCount: number;
    watchCount: number;
  };
  services: OpsSignal[];
  environment: {
    current: {
      temperature: number | null;
      apparentTemperature: number | null;
      humidity: number | null;
      windSpeed: number | null;
      description: string;
      icon: string;
    };
    indoor: number | null;
    indoorHumidity: number | null;
    hvacMode: string | null;
    security: string | null;
    forecast: DailyWeather[];
  };
  infrastructure: {
    pi: {
      available: boolean;
      sampleAgeMinutes: number | null;
      cpuPct: number | null;
      memPct: number | null;
      tempC: number | null;
      load1: number | null;
      history: {
        time: string;
        cpuPct: number;
        memPct: number;
        tempC: number;
        netDownMBps: number;
      }[];
    };
    backups: {
      available: boolean;
      driveMounted: boolean;
      driveUsedPct: number;
      driveFree: string;
      latest: string;
      tiers: {
        tier: BackupTier;
        label: string;
        status: string;
        age: string;
        severity: Severity;
      }[];
    };
  };
  activity: {
    drinkHubAvailable: boolean;
    ordersToday: number | null;
    ordersWeek: number | null;
    ordersMonth: number | null;
    topDrink: string | null;
    leader: string | null;
    timeline: { date: string; count: number }[];
    visitors: {
      available: boolean;
      count: number | null;
      countries: number | null;
      cities: number | null;
      geoStatus: string;
      updatedAt: string | null;
    };
  };
}

const severityRank: Record<Severity, number> = { ok: 0, watch: 1, attention: 2 };

function highest(a: Severity, b: Severity): Severity {
  return severityRank[b] > severityRank[a] ? b : a;
}

function severityLabel(severity: Severity): string {
  if (severity === 'attention') return 'Needs attention';
  if (severity === 'watch') return 'Watch';
  return 'OK';
}

function formatEntityState(value: string | null | undefined): string | null {
  if (!value || value === 'unknown' || value === 'unavailable') return null;
  return value.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

function numericState(state: StateLike | null): number | null {
  if (!state || state.state === 'unknown' || state.state === 'unavailable') return null;
  const n = parseFloat(state.state);
  return Number.isFinite(n) ? n : null;
}

function ageMinutes(ts: number | string | null | undefined): number | null {
  if (!ts) return null;
  const t = typeof ts === 'number' ? ts : new Date(ts).getTime();
  if (!Number.isFinite(t)) return null;
  return Math.max(0, Math.round((Date.now() - t) / 60000));
}

function driveUsedPct(manifest: BackupManifest): number {
  const { totalBytes, freeBytes } = manifest.drive;
  if (!totalBytes) return 0;
  return Math.min(100, Math.max(0, ((totalBytes - freeBytes) / totalBytes) * 100));
}

function latestBackup(manifest: BackupManifest): string | null {
  let latest: string | null = null;
  for (const tier of TIERS) {
    const ts = manifest.tiers[tier].last?.timestamp;
    if (ts && (!latest || ts > latest)) latest = ts;
  }
  return latest;
}

function tierSeverity(manifest: BackupManifest, tier: BackupTier): Severity {
  const last = manifest.tiers[tier].last;
  if (!last) return tierNotDueYet(manifest, tier) ? 'ok' : 'watch';
  if (last.status !== 'success') return 'attention';
  const stale = staleness(tier, last);
  if (stale === 'overdue') return 'attention';
  if (stale === 'due' || stale === 'unknown') return 'watch';
  return 'ok';
}

function backupSeverity(manifest: BackupManifest): Severity {
  if (!manifest.available || !manifest.drive.mounted) return 'attention';
  let severity: Severity = driveUsedPct(manifest) >= 75 ? 'watch' : 'ok';
  for (const tier of TIERS) {
    severity = highest(severity, tierSeverity(manifest, tier));
  }
  return severity;
}

function piSeverity(pi: OpsBoard['infrastructure']['pi']): Severity {
  if (!pi.available || pi.sampleAgeMinutes === null) return 'attention';
  let severity: Severity = 'ok';
  if (pi.sampleAgeMinutes > 60) severity = 'attention';
  else if (pi.sampleAgeMinutes >= 15) severity = 'watch';
  if (pi.tempC !== null) {
    if (pi.tempC >= 75) severity = 'attention';
    else if (pi.tempC >= 65) severity = highest(severity, 'watch');
  }
  if (pi.memPct !== null) {
    if (pi.memPct >= 90) severity = 'attention';
    else if (pi.memPct >= 80) severity = highest(severity, 'watch');
  }
  if (pi.cpuPct !== null && pi.cpuPct >= 75) {
    severity = highest(severity, pi.cpuPct >= 90 ? 'attention' : 'watch');
  }
  return severity;
}

function statusCopy(severity: Severity): { headline: string; detail: string } {
  if (severity === 'attention') {
    return {
      headline: 'One or more household systems need attention.',
      detail: 'Review the highlighted tiles before relying on the dependent dashboard sections.'
    };
  }
  if (severity === 'watch') {
    return {
      headline: 'Household systems are running with a few watch items.',
      detail: 'Core services are reachable, but at least one signal is stale or near a threshold.'
    };
  }
  return {
    headline: 'Household systems are operating normally.',
    detail: 'Services are reachable, telemetry is fresh, and backups are within expected windows.'
  };
}

export async function getOpsBoard(): Promise<OpsBoard> {
  const [
    haStates,
    currentWeather,
    forecast,
    drinkStats,
    visitors,
    piMetrics,
    backups
  ] = await Promise.all([
    getStates(Object.values(ENTITIES)).catch(() => new Map()),
    getCurrentWeather().catch(() => null),
    getDailyForecast().catch(() => []),
    fetchDrinkHubStats().catch(() => null),
    getVisitorLocationStats().catch(() => null),
    getPiMetrics('1d').catch(() => ({ available: false, latest: null, history: [], range: '1d' as const })),
    readBackupManifest().catch(async () => readBackupManifest())
  ]);

  const get = (key: keyof typeof ENTITIES): StateLike | null => {
    const s = haStates.get(ENTITIES[key]);
    return s ? { state: s.state, attrs: s.attributes } : null;
  };

  const weatherDesc = currentWeather
    ? weatherCodeToDescription(currentWeather.weatherCode, currentWeather.isDay)
    : { text: 'Weather unavailable', icon: '--' };

  const pi = {
    available: piMetrics.available,
    sampleAgeMinutes: ageMinutes(piMetrics.latest?.t),
    cpuPct: piMetrics.latest?.cpuPct ?? null,
    memPct: piMetrics.latest?.memPct ?? null,
    tempC: piMetrics.latest?.tempC ?? null,
    load1: piMetrics.latest?.load1 ?? null,
    history: piMetrics.history.slice(-72).map((p) => ({
      time: p.time,
      cpuPct: p.cpuPct,
      memPct: p.memPct,
      tempC: p.tempC,
      netDownMBps: p.netDownMBps
    }))
  };

  const backupUsedPct = driveUsedPct(backups);
  const backupLatest = latestBackup(backups);
  const backupTiers = TIERS.map((tier) => {
    const last = backups.tiers[tier].last;
    const sev = tierSeverity(backups, tier);
    const pending = !last && tierNotDueYet(backups, tier);
    return {
      tier,
      label: tier === 'daily' ? 'Rolling 7-day' : tier[0].toUpperCase() + tier.slice(1),
      status: pending ? 'not due' : last?.status ?? 'missing',
      age: pending ? 'expected later' : backupAgeLabel(tier, last),
      severity: sev
    };
  });

  const visitorSeverity: Severity = !visitors
    ? 'attention'
    : visitors.geo?.status && visitors.geo.status !== 'ok'
      ? 'watch'
      : 'ok';
  const homeAssistantSeverity: Severity = haStates.size > 0 ? 'ok' : 'attention';
  const drinkSeverity: Severity = drinkStats ? 'ok' : 'attention';
  const weatherSeverity: Severity = currentWeather ? 'ok' : 'watch';
  const piStatus = piSeverity(pi);
  const backupStatus = backupSeverity(backups);

  const services: OpsSignal[] = [
    {
      id: 'home-assistant',
      label: 'Home Assistant',
      value: severityLabel(homeAssistantSeverity),
      detail: haStates.size > 0 ? `${haStates.size} tracked entities returned` : 'No entity states returned',
      severity: homeAssistantSeverity
    },
    {
      id: 'drink-hub',
      label: 'Drink Hub',
      value: severityLabel(drinkSeverity),
      detail: drinkStats ? `${drinkStats.totals.today} orders today` : 'Stats API unavailable',
      severity: drinkSeverity
    },
    {
      id: 'pi',
      label: 'Pi telemetry',
      value: severityLabel(piStatus),
      detail: pi.sampleAgeMinutes === null ? 'No sample available' : `Last sample ${pi.sampleAgeMinutes}m ago`,
      severity: piStatus
    },
    {
      id: 'backups',
      label: 'Backups',
      value: severityLabel(backupStatus),
      detail: backups.drive.mounted ? `${backupUsedPct.toFixed(1)}% drive used` : 'Backup drive offline',
      severity: backupStatus
    },
    {
      id: 'visitors',
      label: 'Visitor stats',
      value: severityLabel(visitorSeverity),
      detail: visitors ? `${visitors.count.toLocaleString()} unique visitors` : 'Visitor file unavailable',
      severity: visitorSeverity
    },
    {
      id: 'weather',
      label: 'Weather',
      value: severityLabel(weatherSeverity),
      detail: currentWeather ? weatherDesc.text : 'Open-Meteo unavailable',
      severity: weatherSeverity
    }
  ];

  const attentionCount = services.filter((s) => s.severity === 'attention').length;
  const watchCount = services.filter((s) => s.severity === 'watch').length;
  const overall = services.reduce<Severity>((acc, service) => highest(acc, service.severity), 'ok');
  const copy = statusCopy(overall);

  const topDrink = drinkStats?.topDrinks.thisWeek[0] ?? drinkStats?.topDrinks.allTime[0] ?? null;
  const leader = drinkStats?.leaderboard.thisWeek[0] ?? drinkStats?.leaderboard.allTime[0] ?? null;

  return {
    status: {
      severity: overall,
      label: severityLabel(overall),
      headline: copy.headline,
      detail: copy.detail,
      updatedAt: new Date().toISOString(),
      attentionCount,
      watchCount
    },
    services,
    environment: {
      current: {
        temperature: currentWeather?.temperature ?? null,
        apparentTemperature: currentWeather?.apparentTemperature ?? null,
        humidity: currentWeather?.humidity ?? null,
        windSpeed: currentWeather?.windSpeed ?? null,
        description: weatherDesc.text,
        icon: weatherDesc.icon
      },
      indoor: numericState(get('indoorTemp')),
      indoorHumidity: numericState(get('humidity')),
      hvacMode: formatEntityState(get('hvacMode')?.state),
      security: formatEntityState(get('alarm')?.state),
      forecast
    },
    infrastructure: {
      pi,
      backups: {
        available: backups.available,
        driveMounted: backups.drive.mounted,
        driveUsedPct: backupUsedPct,
        driveFree: formatBytes(backups.drive.freeBytes),
        latest: humanAge(backupLatest),
        tiers: backupTiers
      }
    },
    activity: {
      drinkHubAvailable: Boolean(drinkStats),
      ordersToday: drinkStats?.totals.today ?? null,
      ordersWeek: drinkStats?.totals.thisWeek ?? null,
      ordersMonth: drinkStats?.totals.thisMonth ?? null,
      topDrink: topDrink ? `${topDrink.name} (${topDrink.count})` : null,
      leader: leader ? `${leader.name} (${leader.count})` : null,
      timeline: drinkStats?.dailyTimeline.slice(-14) ?? [],
      visitors: {
        available: Boolean(visitors),
        count: visitors?.count ?? null,
        countries: visitors?.geo?.countryCount ?? null,
        cities: visitors?.geo?.cityCount ?? null,
        geoStatus: visitors?.geo?.status ?? 'unavailable',
        updatedAt: visitors?.geo?.updatedAt ?? visitors?.updatedAt ?? null
      }
    }
  };
}
