import { readFileSync } from 'node:fs';

function readVisitorCount(): number | null {
  try {
    const raw = readFileSync('/var/lib/bristoe-stats/visitors.json', 'utf8');
    const data = JSON.parse(raw);
    if (typeof data.count === 'number') return data.count;
    if (Array.isArray(data.uniqueHashes)) return data.uniqueHashes.length;
  } catch {
    // file absent or malformed — not fatal
  }
  return null;
}

export function load() {
  return { visitorCount: readVisitorCount() };
}
