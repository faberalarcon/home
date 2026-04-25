<script lang="ts">
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import { TIERS, humanAge, formatBytes, formatDuration, staleness } from '$lib/backups';
  import type { BackupTier, TierData, DriveHealth } from '$lib/backups';

  let { data } = $props();

  function pctUsed(d: DriveHealth): number {
    if (!d.totalBytes) return 0;
    return Math.min(100, Math.max(0, ((d.totalBytes - d.freeBytes) / d.totalBytes) * 100));
  }

  function usageToken(pct: number): 'ok' | 'warn' | 'alert' {
    if (pct >= 90) return 'alert';
    if (pct >= 75) return 'warn';
    return 'ok';
  }

  const drive = $derived(data.manifest.drive);
  const used = $derived(pctUsed(drive));

  const TIER_META: Record<BackupTier, { label: string; cadence: string }> = {
    daily:     { label: 'Daily',     cadence: 'every day at 03:00' },
    weekly:    { label: 'Weekly',    cadence: 'Sundays at 03:30' },
    monthly:   { label: 'Monthly',   cadence: '1st of month at 04:00' },
    quarterly: { label: 'Quarterly', cadence: '1st of Jan/Apr/Jul/Oct at 04:30' }
  };

  function totalSize(m: typeof data.manifest): number {
    return TIERS.reduce((sum, t) => sum + (m.tiers[t].lastSuccess?.sizeBytes ?? 0), 0);
  }

  function healthyTiers(m: typeof data.manifest): number {
    return TIERS.filter((t) => staleness(t, m.tiers[t].last) === 'fresh').length;
  }

  function lastOverall(m: typeof data.manifest): string | null {
    let latest: string | null = null;
    for (const t of TIERS) {
      const ts = m.tiers[t].last?.timestamp;
      if (ts && (!latest || ts > latest)) latest = ts;
    }
    return latest;
  }
</script>

<svelte:head>
  <title>Backups — 21 Bristoe Stats</title>
  <meta name="description" content="Pi backup tiers, history, and retention" />
</svelte:head>

<article class="archive">
  <header class="archive__head reveal">
    <p class="dashboard-kicker">Backups</p>
    <h1 class="archive__title">Backup status</h1>
    <p class="archive__lede">
      Rsync snapshot health, retention, and USB drive capacity.
    </p>
  </header>

  {#if !data.manifest.available}
    <p class="archive__note">
      <span class="dashboard-status dashboard-status--alert">No manifest yet</span>
      &mdash; cron will populate on next scheduled run, or run <code class="archive__code">/home/faber/bin/backup.sh daily</code> manually.
    </p>
  {/if}

  <section class="archive__section reveal">
    <SectionHeader title="Overview" meta="Current" />
    <div class="stat-grid">
      <StatCard
        label="Healthy tiers"
        value={`${healthyTiers(data.manifest)} / ${TIERS.length}`}
        accent
      />
      <StatCard
        label="Latest snapshot"
        value={humanAge(lastOverall(data.manifest))}
        sublabel={lastOverall(data.manifest) ?? ''}
      />
      <StatCard
        label="Total size"
        value={formatBytes(totalSize(data.manifest))}
        sublabel="sum of last successful per tier"
      />
      <StatCard
        label="Manifest updated"
        value={humanAge(data.manifest.manifestMtime ?? data.manifest.updatedAt)}
      />
    </div>
  </section>

  <section class="archive__section reveal">
    <SectionHeader title="Tiers" meta="Retention" />
    <table class="analytics-table archive__tiers">
      <thead>
        <tr>
          <th>Tier</th>
          <th>Cadence</th>
          <th>Last run</th>
          <th>Status</th>
          <th class="num">Last size</th>
          <th class="num">Duration</th>
          <th class="num">Files</th>
          <th class="num">Retain</th>
          <th class="num">Streak</th>
          <th>Recent</th>
        </tr>
      </thead>
      <tbody>
        {#each TIERS as tier}
          {@const t = data.manifest.tiers[tier] as TierData}
          {@const meta = TIER_META[tier]}
          {@const state = staleness(tier, t.last)}
          <tr>
            <td data-label="Tier" class="archive__tier-label">{meta.label}</td>
            <td data-label="Cadence"><em class="archive__cadence">{meta.cadence}</em></td>
            <td data-label="Last run">{humanAge(t.last?.timestamp)}</td>
            <td data-label="Status">
              {#if t.last}
                <span
                  class="dashboard-status"
                  class:dashboard-status--active={state === 'fresh' && t.last.status === 'success'}
                  class:dashboard-status--alert={state === 'overdue' || t.last.status !== 'success'}
                  class:dashboard-status--idle={state === 'due' || state === 'unknown'}
                >{t.last.status}</span>
              {:else}
                &mdash;
              {/if}
            </td>
            <td data-label="Last size" class="num">{formatBytes(t.lastSuccess?.sizeBytes ?? 0)}</td>
            <td data-label="Duration" class="num">{formatDuration(t.lastSuccess?.durationSec ?? 0)}</td>
            <td data-label="Files" class="num">{(t.lastSuccess?.fileCount ?? 0).toLocaleString()}</td>
            <td data-label="Retain" class="num">{t.retain}</td>
            <td data-label="Streak" class="num">{t.successStreak}</td>
            <td data-label="Recent">
              {#if t.history.length > 0}
                <div class="archive__history" aria-label="Recent runs">
                  {#each t.history.slice(-14) as entry}
                    <span
                      class="archive__tick"
                      class:archive__tick--fail={entry.status !== 'success'}
                      title="{entry.timestamp} — {entry.status}"
                    ></span>
                  {/each}
                </div>
              {:else}
                &mdash;
              {/if}
            </td>
          </tr>
          {#if t.last?.error}
            <tr class="archive__error-row">
              <td colspan="10" class="archive__error">{t.last.error}</td>
            </tr>
          {/if}
        {/each}
      </tbody>
    </table>
  </section>

  <section class="archive__section reveal">
    <SectionHeader title="Drive health" meta="USB drive" />
    <div class="chart-panel">
      <div class="archive__drive-head">
        <div>
          <h3 class="archive__drive-name">128 GB USB (SanDisk Ultra)</h3>
          <p class="archive__drive-mount">{drive.mountpoint}</p>
        </div>
        <span
          class="dashboard-status"
          class:dashboard-status--active={drive.mounted}
          class:dashboard-status--alert={!drive.mounted}
        >{drive.mounted ? 'mounted' : 'offline'}</span>
      </div>

      <dl class="archive__dl">
        <div><dt>Free</dt> <dd>{formatBytes(drive.freeBytes)}</dd></div>
        <div><dt>Total</dt> <dd>{formatBytes(drive.totalBytes)}</dd></div>
        <div><dt>Used</dt> <dd>{used.toFixed(1)}%</dd></div>
        <div><dt>UUID</dt> <dd class="archive__uuid">{drive.uuid ?? '—'}</dd></div>
        <div><dt>As of</dt> <dd>{humanAge(drive.updatedAt)}</dd></div>
      </dl>

      <div class="archive__usage">
        <div
          class="archive__usage-fill"
          class:archive__usage-fill--warn={usageToken(used) === 'warn'}
          class:archive__usage-fill--alert={usageToken(used) === 'alert'}
          style="width: {used}%"
        ></div>
      </div>
    </div>
  </section>

  <section class="archive__section reveal">
    <SectionHeader title="Destination" meta="Storage" />
    <div class="chart-panel archive__dest">
      <p>128 GB USB drive (label <code class="archive__code">usbbackup</code>) mounted at <code class="archive__code">/mnt/usbbackup</code></p>
      <p>Snapshots under <code class="archive__code">/mnt/usbbackup/backups/&lt;tier&gt;/&lt;timestamp&gt;</code></p>
      <p>Dedup via <code class="archive__code">rsync --link-dest</code> against previous snapshot in the same tier</p>
    </div>
  </section>
</article>

<style>
  .archive__head { margin-bottom: 2rem; }
  .archive__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    font-weight: 500;
    line-height: 1;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .archive__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 58ch;
  }
  .archive__code {
    font-family: var(--font-mono);
    font-size: 0.8125rem;
    background: var(--color-paper-200);
    padding: 0.1rem 0.4rem;
    color: var(--color-ink-900);
    letter-spacing: 0;
  }
  .archive__note {
    margin: 0 0 2rem;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--color-ink-500);
  }
  .archive__section { margin: 3rem 0; }

  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0 2rem;
  }

  .archive__tiers {
    margin-top: 0.5rem;
    font-size: 0.8125rem;
  }
  .archive__tier-label {
    font-family: var(--font-display);
    font-style: italic;
    font-weight: 500;
    color: var(--color-ink-900);
    font-size: 1rem;
    font-variation-settings: 'opsz' 36, 'SOFT' 30;
  }
  .archive__cadence {
    font-family: var(--font-display);
    font-style: italic;
    color: var(--color-ink-500);
    font-size: 0.8125rem;
    font-variation-settings: 'opsz' 24, 'SOFT' 100;
  }
  .archive__history {
    display: inline-flex;
    gap: 2px;
    align-items: center;
  }
  .archive__tick {
    width: 8px;
    height: 14px;
    background: var(--color-status-on);
    display: inline-block;
  }
  .archive__tick--fail { background: var(--color-status-error); }
  .archive__error-row td { background: var(--color-paper-200) !important; }
  .archive__error {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-blood-500);
    padding: 0.6rem 0.5rem !important;
  }

  .archive__drive-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 1rem;
    margin-bottom: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-paper-300);
  }
  .archive__drive-name {
    font-family: var(--font-display);
    font-weight: 500;
    color: var(--color-ink-900);
    margin: 0;
    font-size: 1.25rem;
    font-variation-settings: 'opsz' 36, 'SOFT' 30;
  }
  .archive__drive-mount {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-ink-500);
    margin: 0.25rem 0 0;
  }
  .archive__dl {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(10rem, 1fr));
    gap: 0.75rem 2rem;
    margin: 0 0 1rem;
  }
  .archive__dl > div {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
  }
  .archive__dl dt {
    font-family: var(--font-body);
    font-size: 0.625rem;
    font-weight: 700;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--color-ink-500);
  }
  .archive__dl dd {
    margin: 0;
    font-family: var(--font-mono);
    font-size: 0.9375rem;
    color: var(--color-ink-900);
  }
  .archive__uuid {
    font-size: 0.75rem !important;
    word-break: break-all;
    color: var(--color-ink-700) !important;
  }
  .archive__usage {
    height: 6px;
    background: var(--color-paper-200);
    overflow: hidden;
  }
  .archive__usage-fill {
    height: 100%;
    background: var(--color-olive-500);
    transition: width 0.6s ease-out;
  }
  .archive__usage-fill--warn { background: var(--color-leaf-500); }
  .archive__usage-fill--alert { background: var(--color-danger-text); }

  .archive__dest p {
    margin: 0 0 0.5rem;
    font-family: var(--font-body);
    font-size: 0.9375rem;
    color: var(--color-ink-700);
  }
  .archive__dest p:last-child { margin-bottom: 0; }
</style>
