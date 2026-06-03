import type { PrinterHistory, PrinterSample, PrinterStatus } from './printer';

// Synthetic data used when PRINTER_FIXTURE=1, so the dedicated page and ops
// board can be developed and reviewed before the physical K2 Pro is on the
// network. Mirrors the shape a live Moonraker fetch / collector would produce.

export function fixtureStatus(): PrinterStatus {
  const now = Date.now();
  return {
    configured: true,
    available: true,
    source: 'fixture',
    sampleAt: now,
    name: 'K2 Pro',
    state: 'printing',
    job: {
      filename: 'benchy_0.2mm_PLA.gcode',
      progressPct: 63.4,
      elapsedS: 4920,
      remainingS: 2840
    },
    temps: {
      nozzleC: 218.6,
      nozzleTarget: 220,
      bedC: 60.1,
      bedTarget: 60,
      chamberC: 38.4
    },
    lifetime: {
      totalJobs: 142,
      totalTimeS: 1_238_400,
      totalFilamentMm: 184_320,
      completed: 131,
      cancelled: 11
    },
    box: {
      connected: true,
      tempC: 26,
      humidityPct: 36,
      slots: [
        { id: 'T1A', colorHex: 'ffffff', material: 'PLA', remainPct: 100, loaded: true },
        { id: 'T1B', colorHex: '9ea7ae', material: 'PLA', remainPct: 80, loaded: true },
        { id: 'T1C', colorHex: '1b04ae', material: 'PETG', remainPct: 45, loaded: true },
        { id: 'T1D', colorHex: null, material: null, remainPct: null, loaded: false }
      ]
    },
    recentJobs: [
      { filename: 'bracket_v3.gcode', status: 'completed', durationS: 7320, filamentMm: 4210, at: now - 3_600_000 },
      { filename: 'gridfinity_bin.gcode', status: 'completed', durationS: 5040, filamentMm: 3120, at: now - 90_000_000 },
      { filename: 'phone_stand.gcode', status: 'cancelled', durationS: 640, filamentMm: 210, at: now - 172_000_000 }
    ]
  };
}

export function fixtureHistory(): PrinterHistory {
  const now = Date.now();
  const points = Array.from({ length: 48 }, (_, i) => {
    const t = now - (47 - i) * 30 * 60_000;
    const d = new Date(t);
    return {
      time: d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric' }),
      t,
      nozzleC: 215 + Math.sin(i / 4) * 6,
      bedC: 60 + Math.sin(i / 9) * 1.5,
      chamberC: 36 + Math.sin(i / 6) * 3
    };
  });
  const printHours = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 86_400_000);
    return { day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), hours: Math.round((2 + Math.sin(i) * 2) * 10) / 10 };
  });
  return { available: true, range: '7d', temps: points, printHours };
}

export function fixtureSample(): PrinterSample {
  const s = fixtureStatus();
  return {
    t: s.sampleAt ?? Date.now(),
    state: s.state,
    progressPct: s.job?.progressPct ?? 0,
    nozzleC: s.temps.nozzleC,
    nozzleTarget: s.temps.nozzleTarget,
    bedC: s.temps.bedC,
    bedTarget: s.temps.bedTarget,
    chamberC: s.temps.chamberC,
    filename: s.job?.filename ?? null,
    printDurationS: s.job?.elapsedS ?? 0,
    filamentUsedMm: 1840,
    lifetime: s.lifetime
  };
}
