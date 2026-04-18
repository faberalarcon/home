import { readFile } from 'node:fs/promises';

const DATA_FILE = '/var/lib/bristoe-stats/visitors.json';

export interface VisitorStats {
  count: number;
  updatedAt: string | null;
}

export async function getUniqueVisitorCount(): Promise<VisitorStats | null> {
  try {
    const raw = await readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);
    const count = typeof data.count === 'number'
      ? data.count
      : Array.isArray(data.uniqueHashes) ? data.uniqueHashes.length : null;
    if (count == null) return null;
    return { count, updatedAt: data.updatedAt ?? null };
  } catch {
    return null;
  }
}
