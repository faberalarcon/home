import { readFile, stat, statfs } from 'node:fs/promises';
import { TIERS, DEFAULT_RETAIN, emptyTier, emptyDrive } from '$lib/stats/backups';
import type { BackupEntry, BackupManifest, BackupTier, DriveHealth, TierData } from '$lib/stats/backups';

const MANIFEST_PATH = '/var/lib/bristoe-backup/manifest.json';
const DRIVE_MOUNT = '/mnt/usbbackup';

async function liveDriveHealth(manifestDrive: Partial<DriveHealth> | undefined): Promise<DriveHealth> {
  const base: DriveHealth = {
    mounted: false,
    uuid: manifestDrive?.uuid ?? null,
    mountpoint: manifestDrive?.mountpoint ?? DRIVE_MOUNT,
    totalBytes: manifestDrive?.totalBytes ?? 0,
    freeBytes: manifestDrive?.freeBytes ?? 0,
    updatedAt: manifestDrive?.updatedAt ?? null
  };
  try {
    const s = await statfs(base.mountpoint);
    const total = Number(s.bsize) * Number(s.blocks);
    const free = Number(s.bsize) * Number(s.bavail);
    if (total > 0) {
      base.mounted = true;
      base.totalBytes = total;
      base.freeBytes = free;
    }
  } catch {
    // keep manifest values, mounted stays false
  }
  return base;
}

export async function readBackupManifest(): Promise<BackupManifest> {
  const tiers = Object.fromEntries(
    TIERS.map((t) => [t, emptyTier(t, DEFAULT_RETAIN[t])])
  ) as Record<BackupTier, TierData>;

  let raw: string;
  let mtime: string | null = null;
  try {
    const [buf, st] = await Promise.all([readFile(MANIFEST_PATH, 'utf8'), stat(MANIFEST_PATH)]);
    raw = buf;
    mtime = st.mtime.toISOString();
  } catch {
    return { available: false, updatedAt: null, manifestMtime: null, tiers, drive: await liveDriveHealth(undefined) };
  }

  let parsed: {
    updatedAt?: string;
    tiers?: Record<string, { last?: BackupEntry; history?: BackupEntry[]; retain?: number }>;
    drive?: Partial<DriveHealth>;
  };
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { available: false, updatedAt: null, manifestMtime: mtime, tiers, drive: await liveDriveHealth(undefined) };
  }

  for (const tier of TIERS) {
    const src = parsed.tiers?.[tier];
    if (!src) continue;
    const history = (src.history ?? []).slice(-30);
    const last = src.last ?? (history.length ? history[history.length - 1] : null);
    const lastSuccess = [...history].reverse().find((e) => e.status === 'success') ?? null;
    let streak = 0;
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].status === 'success') streak++;
      else break;
    }
    tiers[tier] = {
      tier,
      retain: src.retain ?? DEFAULT_RETAIN[tier],
      last: last ?? null,
      history,
      successStreak: streak,
      lastSuccess
    };
  }

  return {
    available: true,
    updatedAt: parsed.updatedAt ?? null,
    manifestMtime: mtime,
    tiers,
    drive: await liveDriveHealth(parsed.drive)
  };
}

export { emptyDrive };
