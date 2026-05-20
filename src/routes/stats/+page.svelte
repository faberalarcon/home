<script lang="ts">
  import BristoeCard from '$lib/components/BristoeCard.svelte';
  import LiveBadge from '$lib/components/LiveBadge.svelte';
  import MetricTile from '$lib/components/MetricTile.svelte';
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import StatusPill from '$lib/components/StatusPill.svelte';
  import BarChart from '$lib/stats/components/BarChart.svelte';
  import LineChart from '$lib/stats/components/LineChart.svelte';

  let { data } = $props();
  const ops = $derived(data.ops);

  type Severity = 'ok' | 'watch' | 'attention';

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

  function formatCompact(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '--';
    return new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  }

  function formatRate(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '--';
    return `${value.toFixed(1)} tok/s`;
  }

  function formatBytesShort(value: number | null): string {
    if (value === null || !Number.isFinite(value)) return '--';
    if (value >= 1024 ** 3) return `${(value / 1024 ** 3).toFixed(1)} GiB`;
    if (value >= 1024 ** 2) return `${(value / 1024 ** 2).toFixed(1)} MiB`;
    return `${Math.round(value / 1024)} KiB`;
  }

  function cardVariant(severity: Severity): 'success' | 'warning' | 'attention' {
    if (severity === 'attention') return 'attention';
    if (severity === 'watch') return 'warning';
    return 'success';
  }

  function serviceById(id: string) {
    return ops.services.find((service) => service.id === id);
  }

  const statusScore = $derived(
    ops.status.severity === 'ok' ? 100 : ops.status.severity === 'watch' ? 68 : 34
  );
  const piHistory = $derived(ops.infrastructure.pi.history);
  const forecast = $derived(ops.environment.forecast.slice(0, 5));
  const homeAssistantService = $derived(serviceById('home-assistant'));
  const weatherService = $derived(serviceById('weather'));
  const piService = $derived(serviceById('pi'));
  const backupService = $derived(serviceById('backups'));
  const llamaService = $derived(serviceById('llama'));
  const drinkService = $derived(serviceById('drinks'));
  const visitorService = $derived(serviceById('visitors'));
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
      <LiveBadge label="Live board" detail={`Updated ${formatDateTime(ops.status.updatedAt)}`} status={ops.status.severity} />
      <h1 class="ops-hero__title">Operations board</h1>
      <p class="ops-hero__headline">{ops.status.headline}</p>
      <p class="ops-hero__detail">{ops.status.detail}</p>
    </div>

    <BristoeCard variant={cardVariant(ops.status.severity)} class="ops-hero__status" ariaLabel={`Overall status: ${ops.status.label}`}>
      <div class="status-dial" style={`--score: ${statusScore}%`}>
        <span class="status-dial__value">{ops.status.label}</span>
        <span class="status-dial__meta">overall</span>
      </div>
      <StatusPill status={ops.status.severity} label={ops.status.label} />
      <div class="ops-hero__counts">
        <span><strong>{ops.status.attentionCount}</strong> attention</span>
        <span><strong>{ops.status.watchCount}</strong> watch</span>
      </div>
    </BristoeCard>
  </header>

  <section class="ops-section reveal" aria-labelledby="service-health-heading">
    <SectionHeader
      id="service-health-heading"
      eyebrow={`${ops.services.length} sources`}
      title="Service health"
      description="Canonical health signals for the site, house telemetry, weather, visitors, Drinks, and backups."
      compact
    />
    <div class="service-grid">
      {#each ops.services as service}
        <BristoeCard variant={cardVariant(service.severity)} class="service-card">
          <div class="service-card__top">
            <p>{service.label}</p>
            <StatusPill status={service.severity} label="" />
          </div>
          <h2 class="service-card__detail">{service.detail}</h2>
        </BristoeCard>
      {/each}
    </div>
  </section>

  <section class="ops-section reveal" aria-labelledby="house-conditions-heading">
    <SectionHeader
      id="house-conditions-heading"
      eyebrow={ops.environment.current.description}
      title="House conditions"
      description="Weather, indoor readings, HVAC mode, and security state from the existing integrations."
      compact
    />

    <div class="ops-layout ops-layout--primary">
      <BristoeCard variant={weatherService ? cardVariant(weatherService.severity) : 'warning'} class="weather-panel">
        <div class="weather-panel__main">
          <span class="weather-panel__icon" aria-hidden="true">{ops.environment.current.icon}</span>
          <div>
            <p class="weather-panel__temp">{formatTemp(ops.environment.current.temperature)}</p>
            <p class="weather-panel__meta">
              Feels {formatTemp(ops.environment.current.apparentTemperature)}
              {#if ops.environment.current.windSpeed !== null}
                / wind {Math.round(ops.environment.current.windSpeed)} mph
              {/if}
            </p>
          </div>
          <StatusPill status={weatherService?.severity ?? 'neutral'} label={weatherService?.value ?? 'Weather'} />
        </div>

        <div class="condition-grid">
          <MetricTile
            label="Indoor"
            value={formatTemp(ops.environment.indoor)}
            detail="Home Assistant"
            icon="🏠"
            status={homeAssistantService?.severity ?? 'neutral'}
          />
          <MetricTile
            label="Humidity"
            value={formatPct(ops.environment.indoorHumidity ?? ops.environment.current.humidity)}
            detail="Indoor or weather fallback"
            icon="💧"
            status={weatherService?.severity ?? 'neutral'}
          />
          <MetricTile
            label="HVAC"
            value={ops.environment.hvacMode ?? '--'}
            detail="Current mode"
            icon="♨️"
            status={homeAssistantService?.severity ?? 'neutral'}
          />
          <MetricTile
            label="Security"
            value={ops.environment.security ?? '--'}
            detail="Alarm state"
            icon="🔒"
            status={homeAssistantService?.severity ?? 'neutral'}
          />
        </div>
      </BristoeCard>

      <BristoeCard variant="soft" class="forecast-panel">
        <div class="panel-heading">
          <h3>Forecast</h3>
          <span>Next 5 days</span>
        </div>
        {#if forecast.length > 0}
          <div class="forecast-strip">
            {#each forecast as day}
              <div class="forecast-strip__day">
                <span>{formatDay(day.date)}</span>
                <strong>{Math.round(day.tempMax)}°</strong>
                <em>{Math.round(day.tempMin)}°</em>
              </div>
            {/each}
          </div>
        {:else}
          <p class="empty-note">Forecast data is unavailable right now.</p>
        {/if}
      </BristoeCard>
    </div>
  </section>

  <section class="ops-section reveal" aria-labelledby="infrastructure-heading">
    <SectionHeader
      id="infrastructure-heading"
      eyebrow="Pi + backups"
      title="Infrastructure"
      description="Latest Raspberry Pi telemetry and the backup tiers that keep the household data recoverable."
      compact
    />

    <div class="ops-layout ops-layout--triple">
      <BristoeCard variant={piService ? cardVariant(piService.severity) : 'attention'} class="status-panel">
        <div class="panel-heading">
          <div>
            <h3>Pi telemetry</h3>
            <p>{piService?.detail ?? 'No telemetry sample available'}</p>
          </div>
          <StatusPill status={piService?.severity ?? 'attention'} label={piService?.value ?? 'Needs attention'} />
        </div>
        <div class="panel-metric-grid">
          <MetricTile label="CPU" value={formatPct(ops.infrastructure.pi.cpuPct)} detail={`load ${ops.infrastructure.pi.load1?.toFixed(2) ?? '--'}`} icon="⚙️" status={piService?.severity ?? 'neutral'} />
          <MetricTile label="Memory" value={formatPct(ops.infrastructure.pi.memPct)} detail="latest sample" icon="▣" status={piService?.severity ?? 'neutral'} />
          <MetricTile label="Pi temp" value={formatTemp(ops.infrastructure.pi.tempC, 'C')} detail={`${ops.infrastructure.pi.sampleAgeMinutes ?? '--'}m ago`} icon="🌡️" status={piService?.severity ?? 'neutral'} />
        </div>
      </BristoeCard>

      <BristoeCard variant={llamaService ? cardVariant(llamaService.severity) : 'attention'} class="status-panel">
        <div class="panel-heading">
          <div>
            <h3>GoobyGPT models</h3>
            <p>{llamaService?.detail ?? 'llama.cpp unavailable'}</p>
          </div>
          <StatusPill status={llamaService?.severity ?? 'attention'} label={llamaService?.value ?? 'Needs attention'} />
        </div>
        <div class="panel-metric-grid">
          <MetricTile
            label="Models"
            value={`${ops.infrastructure.llama.loadedCount}/${ops.infrastructure.llama.modelCount}`}
            detail={ops.infrastructure.llama.defaultModel ?? 'no default model'}
            icon="AI"
            status={llamaService?.severity ?? 'neutral'}
          />
          <MetricTile
            label="Generation"
            value={formatRate(ops.infrastructure.llama.predictedTokensPerSecond)}
            detail={`${formatCompact(ops.infrastructure.llama.predictedTokensTotal)} tokens`}
            icon="tok"
            status={ops.infrastructure.llama.metricsAvailable ? 'ok' : 'watch'}
          />
          <MetricTile
            label="Queue"
            value={ops.infrastructure.llama.requestsProcessing ?? '--'}
            detail={`${ops.infrastructure.llama.requestsDeferred ?? '--'} deferred`}
            icon="Q"
            status={llamaService?.severity ?? 'neutral'}
          />
        </div>
        <p class="llama-detail">
          {#if ops.infrastructure.llama.loadedModel}
            {ops.infrastructure.llama.loadedModel}
            / ctx {formatCompact(ops.infrastructure.llama.contextSize)}
            / {formatCompact(ops.infrastructure.llama.parameterCount)} params
            / {formatBytesShort(ops.infrastructure.llama.sizeBytes)}
          {:else if ops.infrastructure.llama.error}
            {ops.infrastructure.llama.error}
          {:else}
            No model is loaded right now.
          {/if}
        </p>
      </BristoeCard>

      <BristoeCard variant={backupService ? cardVariant(backupService.severity) : 'attention'} class="status-panel">
        <div class="panel-heading">
          <div>
            <h3>Backup status</h3>
            <p>Latest backup {ops.infrastructure.backups.latest}</p>
          </div>
          <StatusPill status={backupService?.severity ?? 'attention'} label={backupService?.value ?? 'Needs attention'} />
        </div>
        <div class="backup-summary">
          <MetricTile
            label="Backup drive"
            value={`${ops.infrastructure.backups.driveUsedPct.toFixed(1)}%`}
            detail={ops.infrastructure.backups.driveMounted ? `${ops.infrastructure.backups.driveFree} free` : 'drive offline'}
            icon="💾"
            status={backupService?.severity ?? 'neutral'}
          />
        </div>
        <div class="tier-list">
          {#each ops.infrastructure.backups.tiers as tier}
            <div class="tier-row" data-severity={tier.severity}>
              <span>{tier.label}</span>
              <strong>{tier.status}</strong>
              <em>{tier.age}</em>
              <StatusPill status={tier.severity} label={tier.severity === 'attention' ? 'Needs attention' : tier.severity === 'watch' ? 'Watch' : 'OK'} />
            </div>
          {/each}
        </div>
      </BristoeCard>
    </div>
  </section>

  <section class="ops-section reveal" aria-labelledby="activity-heading">
    <SectionHeader
      id="activity-heading"
      eyebrow="Drinks + visitors"
      title="Household activity"
      description="The public-facing activity signals: Drinks ordering, leaderboard movement, and visitor stats."
      compact
    />

    <div class="ops-layout">
      <BristoeCard variant={drinkService ? cardVariant(drinkService.severity) : 'attention'} class="status-panel">
        <div class="panel-heading">
          <div>
            <h3>Drink activity</h3>
            <p>{drinkService?.detail ?? 'Drinks stats unavailable'}</p>
          </div>
          <StatusPill status={drinkService?.severity ?? 'attention'} label={drinkService?.value ?? 'Needs attention'} />
        </div>
        <div class="panel-metric-grid">
          <MetricTile label="Orders today" value={ops.activity.ordersToday ?? '--'} detail={`${ops.activity.ordersWeek ?? '--'} this week`} icon="🍹" status={drinkService?.severity ?? 'neutral'} />
          <MetricTile label="Month orders" value={ops.activity.ordersMonth ?? '--'} detail={ops.activity.topDrink ?? 'no top drink'} icon="📈" status={drinkService?.severity ?? 'neutral'} />
          <MetricTile label="Leader" value={ops.activity.leader ?? '--'} detail="this week" icon="🏅" status={drinkService?.severity ?? 'neutral'} />
        </div>
      </BristoeCard>

      <BristoeCard variant={visitorService ? cardVariant(visitorService.severity) : 'attention'} class="status-panel">
        <div class="panel-heading">
          <div>
            <h3>Visitor activity</h3>
            <p>{visitorService?.detail ?? 'Visitor stats unavailable'}</p>
          </div>
          <StatusPill status={visitorService?.severity ?? 'attention'} label={visitorService?.value ?? 'Needs attention'} />
        </div>
        <div class="panel-metric-grid">
          <MetricTile label="Visitors" value={ops.activity.visitors.count?.toLocaleString() ?? '--'} detail="unique visitors" icon="👋" status={visitorService?.severity ?? 'neutral'} />
          <MetricTile label="Countries" value={ops.activity.visitors.countries ?? '--'} detail={`${ops.activity.visitors.cities ?? '--'} cities`} icon="🌎" status={visitorService?.severity ?? 'neutral'} />
          <MetricTile label="Geo file" value={ops.activity.visitors.geoStatus} detail={formatDateTime(ops.activity.visitors.updatedAt)} icon="🧭" status={visitorService?.severity ?? 'neutral'} />
        </div>
      </BristoeCard>
    </div>
  </section>

  <section class="ops-section reveal" aria-labelledby="charts-heading">
    <SectionHeader
      id="charts-heading"
      eyebrow="Trends"
      title="Charts"
      description="Lower-priority trend views stay below the primary status cards so the page scans from status to detail."
      compact
    />

    <div class="chart-grid">
      {#if piHistory.length > 0}
        <BristoeCard variant="soft" class="chart-panel">
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
        </BristoeCard>
      {/if}

      {#if ops.activity.timeline.length > 0}
        <BristoeCard variant="soft" class="chart-panel">
          <p class="chart-panel__title">Drink orders, 14 days</p>
          <div class="chart-panel__body">
            <BarChart
              labels={ops.activity.timeline.map((d) => d.date.slice(5))}
              data={ops.activity.timeline.map((d) => d.count)}
              colors={ops.activity.timeline.map(() => 'var(--color-chart-drinks)')}
              label="Orders"
            />
          </div>
        </BristoeCard>
      {/if}

      <BristoeCard variant="soft" class="chart-panel">
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
      </BristoeCard>
    </div>
  </section>
</article>

<style>
  .ops {
    display: flex;
    flex-direction: column;
    gap: clamp(2rem, 4vw, 3rem);
  }

  .ops-hero {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(16rem, 0.32fr);
    gap: clamp(1rem, 3vw, 2rem);
    align-items: stretch;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background:
      radial-gradient(circle at top right, color-mix(in oklab, var(--status-color) 14%, transparent), transparent 24rem),
      linear-gradient(135deg, color-mix(in oklab, var(--color-paper-100) 94%, transparent), var(--color-paper-50)),
      var(--color-paper-100);
    padding: clamp(1rem, 3vw, 2rem);
    min-width: 0;
  }

  .ops-hero[data-severity="ok"] { --status-color: var(--color-status-on); }
  .ops-hero[data-severity="watch"] { --status-color: var(--color-leaf-500); }
  .ops-hero[data-severity="attention"] { --status-color: var(--color-status-error); }

  .ops-hero__copy {
    min-width: 0;
  }

  .ops-hero__title {
    font-family: var(--font-display);
    font-size: clamp(2.5rem, 6vw, 5rem);
    line-height: 0.95;
    font-weight: 500;
    margin: 1rem 0;
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

  :global(.ops-hero__status) {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    min-width: 0;
    --bristoe-card-padding: clamp(1rem, 2vw, 1.4rem);
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
  .ops-hero__counts span,
  .tier-row span,
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

  .ops-section {
    min-width: 0;
  }

  .service-grid,
  .condition-grid,
  .panel-metric-grid,
  .chart-grid {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

  .service-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .condition-grid,
  .panel-metric-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .chart-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  :global(.service-card),
  :global(.weather-panel),
  :global(.forecast-panel),
  :global(.status-panel),
  :global(.chart-panel) {
    min-width: 0;
  }

  .service-card__top,
  .panel-heading,
  .weather-panel__main {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 1rem;
    min-width: 0;
  }

  .service-card__top p,
  .panel-heading span {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.68rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  :global(.service-card h2) {
    margin: 0.7rem 0 0;
    font-family: var(--font-mono);
    font-size: clamp(1.05rem, 1.55vw, 1.35rem);
    line-height: 1.25;
    color: var(--color-ink-900);
    white-space: normal;
    text-wrap: balance;
  }

  .service-card__detail {
    margin: 0.7rem 0 0;
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

  .ops-layout--triple {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .ops-layout--triple .panel-metric-grid {
    grid-template-columns: 1fr;
  }

  .weather-panel__main {
    align-items: center;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--color-paper-300);
  }

  .weather-panel__icon {
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

  .weather-panel__temp {
    margin: 0;
    font-family: var(--font-mono);
    font-size: clamp(2.75rem, 7vw, 4.5rem);
    line-height: 1;
    color: var(--color-ink-900);
  }

  .weather-panel__meta {
    margin: 0.25rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.85rem;
  }

  .condition-grid {
    padding-top: 1rem;
  }

  .panel-heading {
    margin-bottom: 1rem;
  }

  .panel-heading h3 {
    margin: 0;
    color: var(--color-ink-900);
    font-family: var(--font-display);
    font-size: clamp(1.35rem, 2vw, 1.75rem);
    font-weight: 650;
    line-height: 1.1;
  }

  .panel-heading p {
    margin: 0.35rem 0 0;
    color: var(--color-ink-500);
    font-size: 0.86rem;
    line-height: 1.4;
  }

  .forecast-strip {
    display: grid;
    grid-template-columns: repeat(5, minmax(0, 1fr));
    overflow: hidden;
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
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

  .empty-note {
    margin: 0;
    color: var(--color-ink-500);
    font-size: 0.9rem;
  }

  .backup-summary {
    margin-bottom: 1rem;
  }

  .llama-detail {
    margin: 1rem 0 0;
    color: var(--color-ink-500);
    font-family: var(--font-mono);
    font-size: 0.76rem;
    line-height: 1.45;
    overflow-wrap: anywhere;
  }

  .tier-list {
    border: 1px solid var(--color-paper-300);
    border-radius: var(--radius-sm, 0.5rem);
    background: var(--color-paper-50);
    overflow: hidden;
  }

  .tier-row {
    display: grid;
    grid-template-columns: minmax(0, 0.72fr) minmax(0, 0.5fr) minmax(0, 0.65fr) auto;
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
  }

  .chart-panel__title {
    margin: 0 0 1rem;
    color: var(--color-ink-900);
    font-size: 0.8rem;
    font-weight: 850;
    letter-spacing: 0.12em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .chart-panel__body {
    min-height: 16rem;
  }

  @media (prefers-reduced-motion: reduce) {
    .ops-hero {
      transition: none;
    }
  }

  @media (max-width: 900px) {
    .ops-hero,
    .ops-layout,
    .ops-layout--primary,
    .ops-layout--triple {
      grid-template-columns: 1fr;
    }

    .service-grid,
    .chart-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @media (max-width: 640px) {
    .ops {
      gap: 2rem;
    }

    .service-grid,
    .condition-grid {
      grid-template-columns: 1fr;
    }

    .panel-metric-grid,
    .chart-grid {
      grid-template-columns: 1fr;
    }

    .weather-panel__main,
    .panel-heading {
      align-items: flex-start;
      flex-direction: column;
    }

    .forecast-strip {
      grid-template-columns: repeat(5, minmax(3.5rem, 1fr));
      overflow-x: auto;
    }

    .tier-row {
      grid-template-columns: minmax(0, 1fr);
      gap: 0.25rem;
    }
  }
</style>
