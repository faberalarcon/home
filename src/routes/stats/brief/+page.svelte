<script lang="ts">
  import SectionHeader from '$lib/stats/components/SectionHeader.svelte';

  let { data } = $props();

  const briefs = $derived(data.briefs ?? []);
  const latest = $derived(briefs[0] ?? null);
  const older = $derived(briefs.slice(1));

  function formatDate(dateKey: string): string {
    try {
      const [y, m, d] = dateKey.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateKey;
    }
  }

  function formatGenerated(ts: number): string {
    try {
      return new Date(ts * 1000).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '';
    }
  }

  function summaryLine(facts: typeof briefs[0]['payload']): string {
    const parts: string[] = [];
    if (facts.drinks.total > 0) {
      parts.push(`${facts.drinks.total} drink${facts.drinks.total === 1 ? '' : 's'}`);
      if (facts.drinks.topDrink) parts.push(`top: ${facts.drinks.topDrink.name}`);
    }
    if (facts.weather.yesterdayHighF !== null && facts.weather.yesterdayLowF !== null) {
      parts.push(`${facts.weather.yesterdayLowF}°/${facts.weather.yesterdayHighF}°F`);
    }
    if (facts.pi.peakTempC !== null) parts.push(`Pi peak ${Math.round(facts.pi.peakTempC)}°C`);
    if (facts.ha.errors24h > 0) parts.push(`${facts.ha.errors24h} HA error${facts.ha.errors24h === 1 ? '' : 's'}`);
    return parts.join(' · ');
  }
</script>

<svelte:head>
  <title>Daily Brief — 21 Bristoe Stats</title>
  <meta name="description" content="One-paragraph daily summary across drinks, weather, infra, and visitors." />
</svelte:head>

<article class="brief">
  <header class="brief__head reveal">
    <div>
      <p class="dashboard-kicker">Brief</p>
      <h1 class="brief__title">Daily narrative</h1>
      <p class="brief__lede">
        One paragraph per day, drawn from drinks, weather, Pi telemetry, visitors, and Home Assistant events.
      </p>
    </div>
  </header>

  {#if !latest}
    <section class="brief__empty reveal">
      <span class="dashboard-status dashboard-status--alert">No briefs yet</span>
      <p>
        Run <code>curl -X POST .../admin/api/brief</code> from a privileged session, or wait for the daily
        timer at 08:00 to generate the first entry.
      </p>
    </section>
  {:else}
    <section class="brief__section brief__section--first reveal">
      <SectionHeader title={formatDate(latest.date)} meta={`Generated ${formatGenerated(latest.createdAt)}`} />
      <p class="brief__narrative">{latest.narrative}</p>
      <p class="brief__summary">{summaryLine(latest.payload)}</p>
      {#if latest.model}
        <p class="brief__meta">Model: {latest.model}</p>
      {/if}
    </section>

    {#if older.length > 0}
      <section class="brief__section reveal">
        <SectionHeader title="Earlier briefs" meta={`${older.length} on record`} />
        <ul class="brief__list">
          {#each older as entry (entry.id)}
            <li class="brief__item">
              <p class="brief__item-date">{formatDate(entry.date)}</p>
              <p class="brief__item-narrative">{entry.narrative}</p>
              <p class="brief__item-summary">{summaryLine(entry.payload)}</p>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</article>

<style>
  .brief {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }
  .brief__head {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }
  .brief__title {
    font-size: clamp(1.5rem, 3vw, 2rem);
    margin: 0;
  }
  .brief__lede {
    color: var(--color-ink-soft, var(--color-ink, currentColor));
    max-width: 60ch;
  }
  .brief__empty,
  .brief__section {
    background: var(--surface-panel, var(--surface-card, transparent));
    border: 1px solid var(--surface-border, rgba(0, 0, 0, 0.08));
    border-radius: var(--radius-lg, 12px);
    padding: clamp(1rem, 2.5vw, 1.75rem);
  }
  .brief__narrative {
    font-size: clamp(1.05rem, 1.7vw, 1.25rem);
    line-height: 1.55;
    margin: 0 0 0.75rem;
  }
  .brief__summary {
    color: var(--color-ink-soft, var(--color-ink, currentColor));
    font-size: 0.875rem;
    margin: 0;
  }
  .brief__meta {
    color: var(--color-ink-soft, var(--color-ink, currentColor));
    font-size: 0.75rem;
    margin: 0.5rem 0 0;
    opacity: 0.7;
  }
  .brief__list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 1.25rem;
  }
  .brief__item {
    border-top: 1px solid var(--surface-border, rgba(0, 0, 0, 0.08));
    padding-top: 1rem;
  }
  .brief__item:first-child {
    border-top: none;
    padding-top: 0;
  }
  .brief__item-date {
    font-weight: 600;
    margin: 0 0 0.25rem;
  }
  .brief__item-narrative {
    margin: 0 0 0.25rem;
    line-height: 1.5;
  }
  .brief__item-summary {
    color: var(--color-ink-soft, var(--color-ink, currentColor));
    font-size: 0.8rem;
    margin: 0;
  }
  code {
    background: var(--surface-elevated, rgba(0, 0, 0, 0.05));
    padding: 0 0.25rem;
    border-radius: 4px;
    font-size: 0.9em;
  }
</style>
