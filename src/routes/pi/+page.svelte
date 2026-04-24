<script lang="ts">
  import SectionHeader from '$lib/components/SectionHeader.svelte';
  import StatCard from '$lib/components/StatCard.svelte';
  import LineChart from '$lib/components/LineChart.svelte';

  let { data } = $props();

  const rangeOptions = [
    { value: '1d', label: '1d' },
    { value: '7d', label: '7d' }
  ];
  const rangeLabels: Record<string, string> = {
    '1d': 'last 24 hours',
    '7d': 'last 7 days (hourly avg)'
  };

  function fmtMem(mb: number | null | undefined): string {
    if (mb == null) return '—';
    if (mb >= 1024) return `${(mb / 1024).toFixed(1)} GiB`;
    return `${Math.round(mb)} MiB`;
  }

  function fmtRate(mbps: number | null | undefined): string {
    if (mbps == null) return '—';
    if (mbps >= 1) return `${mbps.toFixed(2)} MiB/s`;
    return `${Math.round(mbps * 1024)} KiB/s`;
  }

  function fmtTime(ms: number | null | undefined): string {
    if (!ms) return '—';
    try {
      return new Date(ms).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } catch { return '—'; }
  }
</script>

<svelte:head>
  <title>Pi — 21 Bristoe Stats</title>
  <meta name="description" content="Host hardware telemetry for the Pi running 21bristoe services" />
</svelte:head>

<article class="pi">
  <header class="pi__head reveal">
    <p class="dashboard-kicker">Host telemetry</p>
    <h1 class="pi__title">Pi health</h1>
    <p class="pi__lede">
      CPU, temperature, memory, and network sampled every five minutes.
    </p>
  </header>

  {#if !data.pi.available}
    <p class="pi__note">
      <span class="dashboard-status dashboard-status--alert">No data</span>
      &mdash; the collector hasn&rsquo;t written a sample yet. First tick takes up to 5 minutes.
    </p>
  {:else}
    <section class="pi__section reveal">
      <SectionHeader title="Current readings" meta="Latest sample" />
      <div class="stat-grid">
        <StatCard
          label="CPU"
          value={data.pi.latest?.cpuPct != null ? String(data.pi.latest.cpuPct) : '—'}
          unit="%"
          sublabel={data.pi.latest ? `load ${data.pi.latest.load1.toFixed(2)}` : ''}
          accent
        />
        <StatCard
          label="Temperature"
          value={data.pi.latest?.tempC != null ? String(data.pi.latest.tempC) : '—'}
          unit="°C"
        />
        <StatCard
          label="Memory"
          value={data.pi.latest ? String(data.pi.latest.memPct) : '—'}
          unit="%"
          sublabel={data.pi.latest ? `${fmtMem(data.pi.latest.memUsedMb)} of ${fmtMem(data.pi.latest.memTotalMb)}` : ''}
        />
        <StatCard
          label="Network ↓"
          value={fmtRate(data.pi.latest?.netDownMBps)}
          sublabel={data.pi.latest ? `↑ ${fmtRate(data.pi.latest.netUpMBps)}` : ''}
        />
      </div>
      {#if data.pi.latest}
        <p class="pi__lastseen">last sample at {fmtTime(data.pi.latest.t)}</p>
      {/if}
    </section>

    <div class="pi__range">
      <p class="pi__range-label">
        History &mdash; <em>{rangeLabels[data.pi.range]}</em>
      </p>
      <div class="pi__range-tabs" role="group" aria-label="Time range">
        {#each rangeOptions as opt}
          <a
            href="?range={opt.value}"
            data-sveltekit-noscroll
            aria-current={data.pi.range === opt.value ? 'page' : undefined}
            class="pi__range-tab"
            class:pi__range-tab--active={data.pi.range === opt.value}
          >{opt.label}</a>
        {/each}
      </div>
    </div>

    {#if data.pi.history.length > 0}
      <section class="pi__section reveal">
        <SectionHeader title="History" meta={rangeLabels[data.pi.range]} />
        <div class="figure-grid">
          <figure class="chart-panel">
            <figcaption>CPU</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.pi.history.map(p => p.time)}
                data={data.pi.history.map(p => p.cpuPct)}
                label="CPU %"
                unit="%"
                color="var(--color-chart-cpu)"
              />
            </div>
          </figure>
          <figure class="chart-panel">
            <figcaption>Temperature</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.pi.history.map(p => p.time)}
                data={data.pi.history.map(p => p.tempC)}
                label="°C"
                unit="°"
                color="var(--color-chart-temp)"
              />
            </div>
          </figure>
          <figure class="chart-panel">
            <figcaption>Memory</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.pi.history.map(p => p.time)}
                data={data.pi.history.map(p => p.memPct)}
                label="Mem %"
                unit="%"
                color="var(--color-chart-memory)"
              />
            </div>
          </figure>
          <figure class="chart-panel">
            <figcaption>Network download</figcaption>
            <div class="chart-panel__body">
              <LineChart
                labels={data.pi.history.map(p => p.time)}
                data={data.pi.history.map(p => p.netDownMBps)}
                label="MiB/s"
                color="var(--color-chart-network)"
              />
            </div>
          </figure>
        </div>
      </section>
    {/if}
  {/if}
</article>

<style>
  .pi__head { margin-bottom: 2rem; }
  .pi__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    font-weight: 500;
    line-height: 1;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .pi__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 58ch;
  }
  .pi__note {
    margin: 0 0 2rem;
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--color-ink-500);
  }
  .pi__section { margin: 3rem 0; }
  .pi__lastseen {
    font-family: var(--font-mono);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--color-ink-500);
    margin: 1rem 0 0;
  }
  .stat-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(12rem, 1fr));
    gap: 0 2rem;
  }
  .figure-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 22rem), 1fr));
    gap: 1.5rem;
    margin-top: 1rem;
  }
  @media (max-width: 900px) { .figure-grid { grid-template-columns: 1fr; } }

  .pi__range {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 2rem 0 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .pi__range-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-ink-700);
    margin: 0;
  }
  .pi__range-label em {
    font-family: var(--font-display);
    font-style: italic;
    font-size: 0.875rem;
    letter-spacing: 0;
    text-transform: none;
    color: var(--color-blood-500);
    font-weight: 400;
    font-variation-settings: 'opsz' 24, 'SOFT' 100;
  }
  .pi__range-tabs {
    display: inline-flex;
    border: 1px solid var(--color-paper-300);
  }
  .pi__range-tab {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.5rem 0.9rem;
    text-decoration: none;
    color: var(--color-ink-500);
    border-left: 1px solid var(--color-paper-300);
    transition: background 0.15s, color 0.15s;
  }
  .pi__range-tab:first-child { border-left: 0; }
  .pi__range-tab:hover { color: var(--color-ink-900); }
  .pi__range-tab--active {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }
</style>
