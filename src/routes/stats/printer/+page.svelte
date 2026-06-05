<script lang="ts">
  import SectionHeader from '$lib/stats/components/SectionHeader.svelte';
  import StatCard from '$lib/stats/components/StatCard.svelte';
  import LineChart from '$lib/stats/components/LineChart.svelte';
  import BarChart from '$lib/stats/components/BarChart.svelte';
  import { appPath } from '$lib/stats/app-paths';
  import { onMount, onDestroy } from 'svelte';

  let { data } = $props();

  const status = $derived(data.status);
  const history = $derived(data.history);

  // Camera (snapshot + live view) is only available while a print is active —
  // matched by the server-side gate on the snapshot/webrtc routes. Paused counts.
  const camAllowed = $derived(status.state === 'printing' || status.state === 'paused');

  const stateLabels: Record<string, string> = {
    printing: 'Printing',
    paused: 'Paused',
    complete: 'Complete',
    standby: 'Standby',
    error: 'Error',
    unknown: 'Unknown'
  };
  const stateTone: Record<string, string> = {
    printing: 'live',
    paused: 'warn',
    complete: 'ok',
    standby: 'ok',
    error: 'alert',
    unknown: 'warn'
  };

  // Refresh the webcam snapshot periodically while the page is open.
  let snapshotBust = $state(0);
  onMount(() => {
    if (!status.configured) return;
    const id = setInterval(() => (snapshotBust = Date.now()), 30_000);
    return () => clearInterval(id);
  });
  const snapshotSrc = $derived(`${appPath('/printer/snapshot')}${snapshotBust ? `?t=${snapshotBust}` : ''}`);
  let snapshotOk = $state(true);

  // Live view: the browser plays the printer's WebRTC stream directly (Chromium
  // negotiates the K2's libpeer stack fine). Signaling goes through our
  // same-origin /printer/webrtc proxy; media flows browser <-> printer, so this
  // only works on the home LAN and fails closed elsewhere.
  let liveActive = $state(false);
  let liveError = $state('');
  let videoEl = $state<HTMLVideoElement | null>(null);
  let pc: RTCPeerConnection | null = null;

  async function startLive() {
    liveError = '';
    liveActive = true;
    try {
      // Mirror the proven DnG-Crafts/K2-Camera handshake: STUN server + a
      // sendrecv transceiver (the K2's libpeer stack expects this).
      pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pc.addTransceiver('video', { direction: 'sendrecv' });
      pc.ontrack = (e) => {
        if (videoEl) videoEl.srcObject = e.streams[0];
      };
      await pc.setLocalDescription(await pc.createOffer());
      await new Promise<void>((resolve) => {
        if (pc!.iceGatheringState === 'complete') return resolve();
        const check = () => {
          if (pc!.iceGatheringState === 'complete') {
            pc!.removeEventListener('icegatheringstatechange', check);
            resolve();
          }
        };
        pc!.addEventListener('icegatheringstatechange', check);
        setTimeout(resolve, 3000);
      });
      const body = btoa(JSON.stringify({ type: 'offer', sdp: pc.localDescription!.sdp }));
      const resp = await fetch(appPath('/printer/webrtc'), { method: 'POST', body });
      if (!resp.ok) throw new Error('signaling failed');
      const answer = JSON.parse(atob((await resp.text()).trim()));
      await pc.setRemoteDescription(answer);
    } catch {
      liveError = 'Live view unavailable — home network only.';
      stopLive();
    }
  }

  function stopLive() {
    liveActive = false;
    if (pc) {
      pc.close();
      pc = null;
    }
    if (videoEl) videoEl.srcObject = null;
  }

  onDestroy(stopLive);

  // If the print finishes (or pauses out) while someone is watching, tear the
  // live stream down so it can't outlive the active-print window.
  $effect(() => {
    if (!camAllowed && liveActive) stopLive();
  });

  const rangeOptions = [
    { value: '7d', label: '7d' },
    { value: '30d', label: '30d' },
    { value: '90d', label: '90d' }
  ];

  function fmtDuration(s: number | null | undefined): string {
    if (s == null || !Number.isFinite(s) || s <= 0) return '—';
    const h = Math.floor(s / 3600);
    const m = Math.round((s % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }
  function fmtFilament(mm: number | null | undefined): string {
    if (mm == null || !Number.isFinite(mm)) return '—';
    const m = mm / 1000;
    return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${m.toFixed(1)} m`;
  }
  function fmtTemp(actual: number | null | undefined, target: number | null | undefined): string {
    if (actual == null) return '—';
    return `${actual.toFixed(1)}°`;
  }
  function tempSub(target: number | null | undefined): string {
    return target != null && target > 0 ? `target ${Math.round(target)}°` : 'idle';
  }
  function successRate(l: typeof status.lifetime): string {
    if (!l || l.totalJobs <= 0) return '—';
    if (l.completed === 0 && l.cancelled === 0) return '—';
    const denom = l.completed + l.cancelled;
    if (denom <= 0) return '—';
    return `${Math.round((l.completed / denom) * 100)}%`;
  }
  function jobTime(at: number): string {
    if (!at) return '';
    try {
      return new Date(at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    } catch {
      return '';
    }
  }
</script>

<svelte:head>
  <title>Printer — 21 Bristoe Stats</title>
  <meta name="description" content="3D printer status and history for the home Creality K2 Pro" />
</svelte:head>

<article class="printer">
  <header class="printer__head reveal">
    <p class="dashboard-kicker">Workshop</p>
    <h1 class="printer__title">{status.name}</h1>
    <p class="printer__lede">
      Live job status, temperatures, and print history from the 3D printer on the home network.
    </p>
  </header>

  {#if !status.configured}
    <p class="printer__note">
      <span class="dashboard-status dashboard-status--alert">Not configured</span>
      &mdash; awaiting the printer. Set <code>PRINTER_BASE_URL</code> once it&rsquo;s on the network
      (or <code>PRINTER_FIXTURE=1</code> to preview sample data).
    </p>
  {:else if !status.available}
    <p class="printer__note">
      <span class="dashboard-status dashboard-status--alert">Unreachable</span>
      &mdash; printer configured but not responding, and no samples collected yet.
    </p>
  {:else}
    <section class="printer__section reveal">
      <SectionHeader
        title="Current job"
        meta={status.source === 'live' ? 'Live' : status.source === 'jsonl' ? 'Latest sample' : 'Sample data'}
      />
      <div class="job-card">
        <div class="job-card__state">
          <span class="dashboard-status dashboard-status--{stateTone[status.state] ?? 'warn'}">
            {stateLabels[status.state] ?? status.state}
          </span>
          {#if status.job?.filename}
            <p class="job-card__file redacted" title="Filename hidden for privacy">{status.job.filename}</p>
          {/if}
        </div>
        {#if status.state === 'printing' || status.state === 'paused'}
          <div class="job-card__progress">
            <div class="job-card__bar">
              <span style="width: {Math.min(100, status.job?.progressPct ?? 0)}%"></span>
            </div>
            <div class="job-card__meta">
              <span>{(status.job?.progressPct ?? 0).toFixed(1)}%</span>
              <span>elapsed {fmtDuration(status.job?.elapsedS)}</span>
              <span>remaining {fmtDuration(status.job?.remainingS)}</span>
            </div>
          </div>
        {/if}
      </div>

      <div class="stat-grid">
        <StatCard label="Nozzle" value={fmtTemp(status.temps.nozzleC, status.temps.nozzleTarget)} sublabel={tempSub(status.temps.nozzleTarget)} accent />
        <StatCard label="Bed" value={fmtTemp(status.temps.bedC, status.temps.bedTarget)} sublabel={tempSub(status.temps.bedTarget)} />
        <StatCard label="Chamber" value={status.temps.chamberC != null ? `${status.temps.chamberC.toFixed(1)}°` : '—'} sublabel="enclosure" />
        <StatCard label="Progress" value={status.job ? `${(status.job.progressPct).toFixed(0)}` : '—'} unit="%" sublabel={status.job?.filename ? 'current job' : 'idle'} />
      </div>
    </section>

    {#if status.box?.connected && status.box.slots.length > 0}
      <section class="printer__section reveal">
        <SectionHeader title="Filament box" meta="CFS · dry box" />
        <div class="cfs-grid">
          {#each status.box.slots as slot}
            <div class="cfs-slot" class:cfs-slot--empty={!slot.loaded}>
              <span
                class="cfs-slot__swatch"
                style="background: {slot.colorHex ? `#${slot.colorHex}` : 'transparent'}"
              ></span>
              <div class="cfs-slot__info">
                <span class="cfs-slot__id">{slot.id}</span>
                <span class="cfs-slot__material">{slot.loaded ? (slot.material ?? 'Filament') : 'Empty'}</span>
                {#if slot.loaded && slot.remainPct != null}
                  <div class="cfs-slot__bar">
                    <span style="width: {Math.min(100, Math.max(0, slot.remainPct))}%"></span>
                  </div>
                  <span class="cfs-slot__remain">{Math.round(slot.remainPct)}% remaining</span>
                {/if}
              </div>
            </div>
          {/each}
        </div>
        <div class="stat-grid">
          <StatCard label="Box temp" value={status.box.tempC != null ? `${status.box.tempC.toFixed(0)}°` : '—'} sublabel="dry box" />
          <StatCard label="Humidity" value={status.box.humidityPct != null ? `${status.box.humidityPct.toFixed(0)}` : '—'} unit="%" sublabel="dry box" />
        </div>
      </section>
    {/if}

    {#if status.configured}
      <section class="printer__section reveal">
        <SectionHeader
          title="Camera"
          meta={!camAllowed ? 'during prints only' : liveActive ? 'live · WebRTC' : 'snapshot · refreshes every 30s'}
        />
        {#if !camAllowed}
          <p class="printer__note printer__note--inline">Camera is available while a print is running.</p>
        {:else}
          {#if liveActive}
            <!-- svelte-ignore a11y_media_has_caption -->
            <video class="printer__cam" bind:this={videoEl} autoplay playsinline muted></video>
          {:else if snapshotOk}
            <img
              class="printer__cam"
              src={snapshotSrc}
              alt="Printer webcam snapshot"
              onerror={() => (snapshotOk = false)}
            />
          {:else}
            <p class="printer__note printer__note--inline">Camera snapshot unavailable.</p>
          {/if}
          <div class="printer__cam-actions">
            {#if liveActive}
              <button class="printer__cam-btn" onclick={stopLive}>Stop live view</button>
            {:else}
              <button class="printer__cam-btn" onclick={startLive}>Live view</button>
            {/if}
            {#if liveError}<span class="printer__note printer__note--inline">{liveError}</span>{/if}
          </div>
        {/if}
      </section>
    {/if}

    <section class="printer__section reveal">
      <SectionHeader title="Lifetime" meta="since first print" />
      <div class="stat-grid">
        <StatCard label="Total prints" value={status.lifetime ? String(status.lifetime.totalJobs) : '—'} />
        <StatCard label="Print time" value={status.lifetime ? fmtDuration(status.lifetime.totalTimeS) : '—'} />
        <StatCard label="Filament" value={status.lifetime ? fmtFilament(status.lifetime.totalFilamentMm) : '—'} />
        <StatCard label="Success rate" value={successRate(status.lifetime)} />
      </div>
    </section>

    <div class="printer__range">
      <p class="printer__range-label">History</p>
      <div class="printer__range-tabs" role="group" aria-label="Time range">
        {#each rangeOptions as opt}
          <a
            href="?range={opt.value}"
            data-sveltekit-noscroll
            aria-current={history.range === opt.value ? 'page' : undefined}
            class="printer__range-tab"
            class:printer__range-tab--active={history.range === opt.value}
          >{opt.label}</a>
        {/each}
      </div>
    </div>

    {#if history.available && history.temps.length > 0}
      <section class="printer__section reveal">
        <SectionHeader title="Temperatures" meta="collected samples" />
        <div class="figure-grid">
          <figure class="chart-panel">
            <figcaption>Nozzle</figcaption>
            <div class="chart-panel__body">
              <LineChart labels={history.temps.map((p) => p.time)} data={history.temps.map((p) => p.nozzleC)} label="°C" unit="°" color="var(--color-chart-temp)" />
            </div>
          </figure>
          <figure class="chart-panel">
            <figcaption>Bed</figcaption>
            <div class="chart-panel__body">
              <LineChart labels={history.temps.map((p) => p.time)} data={history.temps.map((p) => p.bedC)} label="°C" unit="°" color="var(--color-chart-cpu)" />
            </div>
          </figure>
          <figure class="chart-panel">
            <figcaption>Chamber</figcaption>
            <div class="chart-panel__body">
              <LineChart labels={history.temps.map((p) => p.time)} data={history.temps.map((p) => p.chamberC)} label="°C" unit="°" color="var(--color-chart-memory)" />
            </div>
          </figure>
          {#if history.printHours.length > 0}
            <figure class="chart-panel">
              <figcaption>Print hours / day</figcaption>
              <div class="chart-panel__body">
                <BarChart labels={history.printHours.map((p) => p.day)} data={history.printHours.map((p) => p.hours)} label="hours" unit="h" />
              </div>
            </figure>
          {/if}
        </div>
      </section>
    {:else}
      <p class="printer__note">No history collected yet — the metrics timer writes a sample every few minutes once enabled.</p>
    {/if}

    {#if status.recentJobs.length > 0}
      <section class="printer__section reveal">
        <SectionHeader title="Recent jobs" />
        <ul class="job-list">
          {#each status.recentJobs.slice(0, 10) as job}
            <li class="job-list__row">
              <span class="job-list__name redacted" title="Filename hidden for privacy">{job.filename}</span>
              <span class="job-list__status job-list__status--{job.status}">{job.status}</span>
              <span class="job-list__detail">{fmtDuration(job.durationS)} · {fmtFilament(job.filamentMm)}</span>
              <span class="job-list__when">{jobTime(job.at)}</span>
            </li>
          {/each}
        </ul>
      </section>
    {/if}
  {/if}
</article>

<style>
  .printer__head { margin-bottom: 2rem; }
  .printer__title {
    font-family: var(--font-display);
    font-size: clamp(2.25rem, 4vw + 1rem, 4rem);
    font-weight: 500;
    line-height: 1;
    margin: 0.75rem 0 1rem;
    color: var(--color-ink-900);
    font-variation-settings: 'opsz' 144, 'SOFT' 30;
  }
  .printer__lede {
    font-family: var(--font-body);
    font-size: 1.0625rem;
    color: var(--color-ink-700);
    line-height: 1.55;
    max-width: 58ch;
  }
  .printer__note {
    margin: 0 0 2rem;
    font-family: var(--font-body);
    font-size: 0.875rem;
    color: var(--color-ink-500);
  }
  .printer__note--inline { margin: 0; }
  .printer__note code {
    font-family: var(--font-mono);
    font-size: 0.8em;
    background: var(--color-paper-100);
    padding: 0.1em 0.35em;
    border: 1px solid var(--color-paper-300);
  }
  .printer__section { margin: 3rem 0; }

  .job-card {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1.25rem;
    border: 1px solid var(--color-paper-300);
    border-left: 3px solid var(--color-blood-500);
    background: var(--color-paper-100);
    margin-bottom: 1.5rem;
  }
  .job-card__file {
    margin: 0.5rem 0 0;
    font-family: var(--font-mono);
    font-size: 0.95rem;
    color: var(--color-ink-900);
    overflow-wrap: anywhere;
  }
  .job-card__bar {
    height: 0.6rem;
    background: var(--color-paper-300);
    border-radius: 999px;
    overflow: hidden;
  }
  .job-card__bar span {
    display: block;
    height: 100%;
    background: var(--color-blood-500);
    transition: width 0.4s ease;
  }
  .job-card__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 1rem;
    margin-top: 0.6rem;
    font-family: var(--font-mono);
    font-size: 0.8rem;
    color: var(--color-ink-500);
  }

  .printer__cam {
    display: block;
    width: 100%;
    max-width: 640px;
    border: 1px solid var(--color-paper-300);
    background: var(--color-paper-100);
  }
  .printer__cam-actions {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-top: 0.75rem;
  }
  .printer__cam-btn {
    font-family: var(--font-body);
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    padding: 0.5rem 0.9rem;
    color: var(--color-ink-700);
    background: var(--color-paper-100);
    border: 1px solid var(--color-paper-300);
    cursor: pointer;
    transition: background 0.15s, color 0.15s;
  }
  .printer__cam-btn:hover {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }

  /* Filenames hidden for privacy — keep layout/length but unreadable. */
  .redacted {
    filter: blur(6px);
    user-select: none;
    -webkit-user-select: none;
  }

  .cfs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
    gap: 1rem;
    margin-bottom: 1.5rem;
  }
  .cfs-slot {
    display: flex;
    gap: 0.75rem;
    align-items: flex-start;
    padding: 0.85rem;
    border: 1px solid var(--color-paper-300);
    background: var(--color-paper-100);
  }
  .cfs-slot--empty { opacity: 0.5; }
  .cfs-slot__swatch {
    flex: 0 0 auto;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: 999px;
    border: 1px solid var(--color-paper-300);
    box-shadow: inset 0 0 0 2px var(--color-paper-50);
  }
  .cfs-slot--empty .cfs-slot__swatch {
    background-image: repeating-linear-gradient(
      45deg,
      var(--color-paper-300) 0,
      var(--color-paper-300) 3px,
      transparent 3px,
      transparent 6px
    );
  }
  .cfs-slot__info {
    display: flex;
    flex-direction: column;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }
  .cfs-slot__id {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    letter-spacing: 0.08em;
    color: var(--color-ink-500);
  }
  .cfs-slot__material {
    font-family: var(--font-body);
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-ink-900);
  }
  .cfs-slot__bar {
    height: 0.4rem;
    margin-top: 0.35rem;
    background: var(--color-paper-300);
    border-radius: 999px;
    overflow: hidden;
  }
  .cfs-slot__bar span {
    display: block;
    height: 100%;
    background: var(--color-blood-500);
    transition: width 0.4s ease;
  }
  .cfs-slot__remain {
    font-family: var(--font-mono);
    font-size: 0.7rem;
    color: var(--color-ink-500);
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

  .printer__range {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 1rem;
    flex-wrap: wrap;
    margin: 2rem 0 1rem;
    padding-top: 1.5rem;
    border-top: 1px solid var(--color-paper-300);
  }
  .printer__range-label {
    font-family: var(--font-body);
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: var(--color-ink-700);
    margin: 0;
  }
  .printer__range-tabs {
    display: inline-flex;
    border: 1px solid var(--color-paper-300);
  }
  .printer__range-tab {
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
  .printer__range-tab:first-child { border-left: 0; }
  .printer__range-tab:hover { color: var(--color-ink-900); }
  .printer__range-tab--active {
    background: var(--color-ink-900);
    color: var(--color-paper-50);
  }

  .job-list { list-style: none; margin: 1rem 0 0; padding: 0; }
  .job-list__row {
    display: grid;
    grid-template-columns: 1fr auto auto auto;
    align-items: center;
    gap: 1rem;
    padding: 0.65rem 0;
    border-bottom: 1px solid var(--color-paper-300);
    font-size: 0.85rem;
  }
  .job-list__name {
    font-family: var(--font-mono);
    color: var(--color-ink-900);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .job-list__status {
    font-size: 0.7rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--color-ink-500);
  }
  .job-list__status--completed { color: var(--color-status-on, #2f7d3a); }
  .job-list__status--cancelled,
  .job-list__status--error { color: var(--color-status-error, #b1442f); }
  .job-list__detail, .job-list__when {
    font-family: var(--font-mono);
    font-size: 0.75rem;
    color: var(--color-ink-500);
    white-space: nowrap;
  }
  @media (max-width: 640px) {
    .job-list__row { grid-template-columns: 1fr auto; row-gap: 0.25rem; }
    .job-list__detail, .job-list__when { grid-column: 1 / -1; }
  }
</style>
