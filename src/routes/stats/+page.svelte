<script lang="ts">
  import BarChart from '$lib/stats/components/BarChart.svelte';
  import LineChart from '$lib/stats/components/LineChart.svelte';
  import SectionHeader from '$lib/stats/components/SectionHeader.svelte';

  let { data } = $props();
  const ops = $derived(data.ops);

  function formatDateTime(iso: string | null): string {
    if (!iso) return 'never';
    try {
      return new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  }

  function formatDay(dateStr: string): string {
    try {
      return new Date(dateStr + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short' });
    } catch {
      return dateStr;
    }
  }

  function formatPct(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '--';
    return `${Math.round(value)}%`;
  }

  function formatTemp(value: number | null, unit = 'F'): string {
    if (value === null || !Number.isFinite(value)) return '--';
    return `${Math.round(value)}°${unit}`;
  }

  const statusScore = $derived(
    ops.status.severity === 'ok' ? 100 : ops.status.severity === 'watch' ? 68 : 34
  );
  const piHistory = $derived(ops.infrastructure.pi.history);
  const forecast = $derived(ops.environment.forecast.slice(0, 5));
  const serviceCounts = $derived([
    ops.services.filter((s) => s.severity === 'ok').length,
    ops.services.filter((s) => s.severity === 'watch').length,
    ops.services.filter((s) => s.severity === 'attention').length
  ]);
</script>

<svelte:head>
  <title>Operations Board - 21 Bristoe Stats</title>
  <meta name="description" content="Visual household operations board for 21 Bristoe systems, backups, telemetry, and activity" />
</svelte:head>

<article class="ops">
  <header class="ops-hero reveal" data-severity={ops.status.severity}>
    <div class="ops-hero__copy">
      <p class="dashboard-kicker">Overview</p>
      <h1 class="ops-hero__title">Operations board</h1>
      <p class="ops-hero__headline">{ops.status.headline}</p>
      <p class="ops-hero__detail">{ops.status.detail}</p>
    </div>

    <div class="ops-hero__status" aria-label={`Overall status: ${ops.status.label}`}>
      <div class="status-dial" style={`--score: ${statusScore}%`}>
        <span class="status-dial__value">{ops.status.label}</span>
        <span class="status-dial__meta">overall</span>
      </div>
      <div class="ops-hero__counts">
        <span><strong>{ops.status.attentionCount}</strong> attention</span>
        <span><strong>{ops.status.watchCount}</strong> watch</span>
      </div>
      <p class="ops-hero__updated">Updated {formatDateTime(ops.status.updatedAt)}</p>
    </div>
  </header>

  <section class="ops-section reveal">
    <SectionHeader title="Service State" meta={`${ops.services.length} sources`} />
    <div class="service-grid">
      {#each ops.services as service}
        <article class="service-card" data-severity={service.severity}>
          <div>
            <p class="service-card__label">{service.label}</p>
            <h2>{service.value}</h2>
          </div>
          <p>{service.detail}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="ops-section reveal">
    <div class="ops-layout ops-layout--primary">
      <div>
        <SectionHeader title="House Conditions" meta={ops.environment.current.description} />
        <div class="environment-panel">
          <div class="environment-panel__main">
            <span class="environment-panel__icon" aria-hidden="true">{ops.environment.current.icon}</span>
            <div>
              <p class="environment-panel__temp">{formatTemp(ops.environment.current.temperature)}</p>
              <p class="environment-panel__meta">
                Feels {formatTemp(ops.environment.current.apparentTemperature)}
                {#if ops.environment.current.windSpeed !== null}
                  / wind {Math.round(ops.environment.current.windSpeed)} mph
                {/if}
              </p>
            </div>
          </div>

          <div class="condition-grid">
            <div>
              <span>Indoor</span>
              <strong>{formatTemp(ops.environment.indoor)}</strong>
            </div>
            <div>
              <span>Humidity</span>
              <strong>{formatPct(ops.environment.indoorHumidity ?? ops.environment.current.humidity)}</strong>
            </div>
            <div>
              <span>HVAC</span>
              <strong>{ops.environment.hvacMode ?? '--'}</strong>
            </div>
            <div>
              <span>Security</span>
              <strong>{ops.environment.security ?? '--'}</strong>
            </div>
          </div>
        </div>
      </div>

      <div>
        <SectionHeader title="Forecast" meta="Next 5 days" />
        <div class="forecast-strip">
          {#each forecast as day}
            <div class="forecast-strip__day">
              <span>{formatDay(day.date)}</span>
              <strong>{Math.round(day.tempMax)}°</strong>
              <em>{Math.round(day.tempMin)}°</em>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="ops-section reveal">
    <div class="ops-layout">
      <div>
        <SectionHeader title="Infrastructure" meta="Pi + backups" />
        <div class="infra-grid">
          <article class="metric-tile">
            <span>CPU</span>
            <strong>{formatPct(ops.infrastructure.pi.cpuPct)}</strong>
            <em>load {ops.infrastructure.pi.load1?.toFixed(2) ?? '--'}</em>
          </article>
          <article class="metric-tile">
            <span>Memory</span>
            <strong>{formatPct(ops.infrastructure.pi.memPct)}</strong>
            <em>latest sample</em>
          </article>
          <article class="metric-tile">
            <span>Pi temp</span>
            <strong>{formatTemp(ops.infrastructure.pi.tempC, 'C')}</strong>
            <em>{ops.infrastructure.pi.sampleAgeMinutes ?? '--'}m ago</em>
          </article>
          <article class="metric-tile">
            <span>Backup drive</span>
            <strong>{ops.infrastructure.backups.driveUsedPct.toFixed(1)}%</strong>
            <em>{ops.infrastructure.backups.driveMounted ? 'mounted' : 'offline'}</em>
          </article>
        </div>

        {#if piHistory.length > 0}
          <div class="chart-panel ops-chart">
            <p class="chart-panel__title">Pi temperature, 24h</p>
            <div class="chart-panel__body">
              <LineChart
                labels={piHistory.map((p) => p.time)}
                data={piHistory.map((p) => p.tempC)}
                label="Pi °C"
                unit="°"
                color="var(--color-chart-temp)"
              />
            </div>
          </div>
        {/if}
      </div>

      <div>
        <SectionHeader title="Backup Tiers" meta={`latest ${ops.infrastructure.backups.latest}`} />
        <div class="tier-list">
          {#each ops.infrastructure.backups.tiers as tier}
            <div class="tier-row" data-severity={tier.severity}>
              <span>{tier.label}</span>
              <strong>{tier.status}</strong>
              <em>{tier.age}</em>
            </div>
          {/each}
        </div>
      </div>
    </div>
  </section>

  <section class="ops-section reveal">
    <div class="ops-layout">
      <div>
        <SectionHeader title="Household Activity" meta="Drink Hub + visitors" />
        <div class="activity-grid">
          <article class="metric-tile metric-tile--accent">
            <span>Orders today</span>
            <strong>{ops.activity.ordersToday ?? '--'}</strong>
            <em>{ops.activity.ordersWeek ?? '--'} this week</em>
          </article>
          <article class="metric-tile">
            <span>Month orders</span>
            <strong>{ops.activity.ordersMonth ?? '--'}</strong>
            <em>{ops.activity.topDrink ?? 'no top drink'}</em>
          </article>
          <article class="metric-tile">
            <span>Visitors</span>
            <strong>{ops.activity.visitors.count?.toLocaleString() ?? '--'}</strong>
            <em>{ops.activity.visitors.countries ?? '--'} countries</em>
          </article>
          <article class="metric-tile">
            <span>Leader</span>
            <strong>{ops.activity.leader ?? '--'}</strong>
            <em>this week</em>
          </article>
        </div>

        {#if ops.activity.timeline.length > 0}
          <div class="chart-panel ops-chart">
            <p class="chart-panel__title">Drink orders, 14 days</p>
            <div class="chart-panel__body">
              <BarChart
                labels={ops.activity.timeline.map((d) => d.date.slice(5))}
                data={ops.activity.timeline.map((d) => d.count)}
                colors={ops.activity.timeline.map(() => 'var(--color-chart-drinks)')}
                label="Orders"
              />
            </div>
          </div>
        {/if}
      </div>

      <div>
        <SectionHeader title="Signal Mix" meta="Current status distribution" />
        <div class="chart-panel ops-chart">
          <p class="chart-panel__title">Services by severity</p>
          <div class="chart-panel__body">
            <BarChart
              labels={['OK', 'Watch', 'Attention']}
              data={serviceCounts}
              colors={[
                'var(--color-status-on)',
                'var(--color-leaf-500)',
                'var(--color-status-error)'
              ]}
              label="Services"
            />
          </div>
        </div>
      </div>
    </div>
  </section>
</article>

<style>
  .ops {
    display: flex;
    flex-direction: column;
    gap: 2.5rem;
  }

  .ops-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.35fr);
    gap: clamp(1rem, 3vw, 2rem);
    align-items: stretch;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background:
      linear-gradient(135deg, color-mix(in oklab, var(--color-paper-100) 94%, transparent), var(--color-paper-50)),
      var(--color-paper-100);
    padding: clamp(1rem, 3vw, 2rem);
    min-width: 0;
  }
  .ops-hero[data-severity="ok"] { --status-color: var(--color-status-on); }
  .ops-hero[data-severity="watch"] { --status-color: var(--color-leaf-500); }
  .ops-hero[data-severity="attention"] { --status-color: var(--color-status-error); }

  .ops-hero__copy,
  .ops-hero__status {
    min-width: 0;
  }
  .ops-hero__title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 6vw, 5rem);
    line-height: 0.95;
    font-weight: 500;
    margin: 0.35rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .ops-hero__headline {
    max-width: 48rem;
    margin: 0;
    font-size: clamp(1.1rem, 2vw, 1.45rem);
    line-height: 1.35;
    color: var(--color-ink-900);
    font-weight: 700;
  }
  .ops-hero__detail {
    max-width: 50rem;
    margin: 0.85rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.95rem;
  }
  .ops-hero__status {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    border-left: 1px solid var(--color-paper-300);
    padding-left: clamp(1rem, 2vw, 1.5rem);
  }
  .status-dial {
    width: min(100%, 13rem);
    aspect-ratio: 1;
    border-radius: 50%;
    display: grid;
    place-items: center;
    align-content: center;
    background:
      radial-gradient(circle, var(--color-paper-100) 0 58%, transparent 59%),
      conic-gradient(var(--status-color) var(--score), var(--color-paper-300) 0);
    box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--color-ink-900) 8%, transparent);
  }
  .status-dial__value {
    max-width: 8.5rem;
    text-align: center;
    font-family: var(--font-display);
    font-size: clamp(1.55rem, 3vw, 2.25rem);
    line-height: 1;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 48, 'SOFT' 40;
  }
  .status-dial__meta,
  .ops-hero__updated,
  .ops-hero__counts span,
  .metric-tile span,
  .service-card__label,
  .tier-row span,
  .condition-grid span,
  .forecast-strip__day span {
    font-family: var(--font-body);
    font-size: 0.68rem;
    font-weight: 800;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: var(--color-ink-500);
  }
  .ops-hero__counts {
    display: flex;
    gap: 0.85rem;
    flex-wrap: wrap;
    justify-content: center;
  }
  .ops-hero__counts strong {
    font-family: var(--font-mono);
    color: var(--color-ink-900);
    font-size: 1rem;
    margin-right: 0.2rem;
  }
  .ops-hero__updated {
    margin: 0;
    text-align: center;
    letter-spacing: 0.06em;
  }

  .ops-section {
    min-width: 0;
  }
  .service-grid,
  .infra-grid,
  .activity-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 12rem), 1fr));
    gap: 0.9rem;
    min-width: 0;
  }
  .service-card,
  .metric-tile,
  .environment-panel,
  .forecast-strip,
  .tier-list {
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius);
    background: var(--color-paper-100);
    min-width: 0;
  }
  .service-card {
    padding: 1rem;
    border-top-width: 3px;
    transition: transform 0.2s ease, box-shadow 0.2s ease;
  }
  .service-card:hover {
    transform: translateY(-1px);
    box-shadow: 0 8px 16px -12px color-mix(in oklab, var(--color-ink-900) 35%, transparent);
  }
  .service-card[data-severity="ok"] { border-top-color: var(--color-status-on); }
  .service-card[data-severity="watch"] { border-top-color: var(--color-leaf-500); }
  .service-card[data-severity="attention"] { border-top-color: var(--color-status-error); }
  .service-card h2 {
    margin: 0.25rem 0 0;
    font-family: var(--font-mono);
    font-size: clamp(1.35rem, 2vw, 1.85rem);
    line-height: 1;
    color: var(--color-ink-900);
  }
  .service-card p:last-child {
    margin: 0.8rem 0 0;
    font-size: 0.85rem;
    line-height: 1.35;
    color: var(--color-ink-500);
  }

  .ops-layout {
    display: grid;
    grid-template-columns: minmax(0, 1.2fr) minmax(18rem, 0.8fr);
    gap: 1.25rem;
    align-items: start;
    min-width: 0;
  }
  .ops-layout--primary {
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.6fr);
  }

  .environment-panel {
    padding: 1.1rem;
  }
  .environment-panel__main {
    display: flex;
    align-items: center;
    gap: 1rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-paper-300);
  }
  .environment-panel__icon {
    flex: 0 0 auto;
    width: 4rem;
    height: 4rem;
    display: grid;
    place-items: center;
    border: 1px solid var(--color-paper-300);
    border-radius: 50%;
    background: var(--color-paper-50);
    font-size: 2rem;
  }
  .environment-panel__temp {
    margin: 0;
    font-family: var(--font-mono);
    font-size: clamp(2.75rem, 7vw, 4.5rem);
    line-height: 1;
    color: var(--color-ink-900);
  }
  .environment-panel__meta {
    margin: 0.25rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.85rem;
  }
  .condition-grid {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.75rem;
    padding-top: 1rem;
  }
  .condition-grid div {
    min-width: 0;
  }
  .condition-grid strong {
    display: block;
    margin-top: 0.25rem;
    color: var(--color-ink-900);
    font-size: 1rem;
    overflow-wrap: anywhere;
  }

  .forecast-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    overflow: hidden;
  }
  .forecast-strip__day {
    padding: 1rem 0.5rem;
    text-align: center;
    border-left: 1px solid var(--color-paper-300);
  }
  .forecast-strip__day:first-child {
    border-left: 0;
  }
  .forecast-strip__day strong,
  .forecast-strip__day em {
    display: block;
    font-family: var(--font-mono);
    font-style: normal;
  }
  .forecast-strip__day strong {
    margin-top: 0.5rem;
    color: var(--color-ink-900);
    font-size: 1.35rem;
  }
  .forecast-strip__day em {
    color: var(--color-ink-500);
    font-size: 0.95rem;
  }

  .metric-tile {
    padding: 1rem;
  }
  .metric-tile--accent {
    border-top: 3px solid var(--color-blood-500);
  }
  .metric-tile strong {
    display: block;
    margin: 0.35rem 0 0.25rem;
    font-family: var(--font-mono);
    font-size: clamp(1.55rem, 3vw, 2.35rem);
    line-height: 1;
    color: var(--color-ink-900);
    overflow-wrap: anywhere;
  }
  .metric-tile em {
    display: block;
    font-style: normal;
    color: var(--color-ink-500);
    font-size: 0.8rem;
    line-height: 1.3;
    overflow-wrap: anywhere;
  }
  .ops-chart {
    margin-top: 1rem;
  }

  .tier-list {
    overflow: hidden;
  }
  .tier-row {
    display: grid;
    grid-template-columns: minmax(0, 0.75fr) minmax(0, 0.55fr) minmax(0, 0.7fr);
    gap: 0.75rem;
    align-items: center;
    padding: 0.9rem 1rem;
    border-top: 1px solid var(--color-paper-300);
    border-left: 3px solid var(--color-status-on);
  }
  .tier-row:first-child {
    border-top: 0;
  }
  .tier-row[data-severity="watch"] { border-left-color: var(--color-leaf-500); }
  .tier-row[data-severity="attention"] { border-left-color: var(--color-status-error); }
  .tier-row strong {
    color: var(--color-ink-900);
    font-size: 0.9rem;
    text-transform: capitalize;
  }
  .tier-row em {
    font-family: var(--font-mono);
    font-style: normal;
    color: var(--color-ink-500);
    font-size: 0.78rem;
    text-align: right;
  }

  @media (prefers-reduced-motion: reduce) {
    .service-card {
      transition: none;
    }
    .service-card:hover {
      transform: none;
    }
  }

  @media (max-width: 900px) {
    .ops-hero,
    .ops-layout,
    .ops-layout--primary {
      grid-template-columns: 1fr;
    }
    .ops-hero__status {
      border-left: 0;
      border-top: 1px solid var(--color-paper-300);
      padding-left: 0;
      padding-top: 1.25rem;
    }
  }

  @media (max-width: 640px) {
    .ops {
      gap: 2rem;
    }
    .condition-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
    .forecast-strip {
      grid-template-columns: repeat(5, minmax(3.5rem, 1fr));
      overflow-x: auto;
    }
    .tier-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.25rem;
    }
    .tier-row em {
      text-align: left;
    }
  }
</style>
