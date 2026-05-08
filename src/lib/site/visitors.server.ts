import { readFileSync } from 'node:fs';

const VISITOR_STATS_PATH = '/var/lib/bristoe-stats/visitors.json';

export function readVisitorCount(): number | null {
  try {
    const raw = readFileSync(VISITOR_STATS_PATH, 'utf8');
    const data = JSON.parse(raw);
    if (typeof data.count === 'number') return data.count;
    if (Array.isArray(data.uniqueHashes)) return data.uniqueHashes.length;
  } catch {
    // Visitor stats are optional in local/dev environments.
  }

  return null;
}
