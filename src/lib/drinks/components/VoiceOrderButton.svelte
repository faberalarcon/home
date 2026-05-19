<script lang="ts">
  import { onDestroy, onMount } from 'svelte';
  import { appPath } from '$lib/drinks/app-paths';
  import { selectedProfile } from '$lib/drinks/profile';

  type Ambiguity = {
    field: 'profile' | 'drink';
    transcript_fragment: string;
    candidates: Array<{ id: number; label: string }>;
  };

  type PreviewItem = {
    drinkId: number;
    quantity: number;
    notes: string | null;
    name: string | null;
    category: string | null;
  };

  type Preview = {
    profileId: number | null;
    profileName: string | null;
    items: PreviewItem[];
    confidence: 'high' | 'medium' | 'low';
    ambiguities: Ambiguity[];
  };

  let { onSubmitted, onError }: {
    onSubmitted?: (summary: string) => void;
    onError?: (message: string) => void;
  } = $props();

  const MAX_RECORD_MS = 15_000;

  let supported = $state(false);
  let recording = $state(false);
  let processing = $state(false);
  let elapsedMs = $state(0);
  let recorder: MediaRecorder | null = null;
  let mediaStream: MediaStream | null = null;
  let chunks: BlobPart[] = [];
  let countdown: ReturnType<typeof setInterval> | null = null;
  let stopTimeout: ReturnType<typeof setTimeout> | null = null;
  let preview = $state<Preview | null>(null);
  let lastTranscript = $state<string>('');
  let chosenProfileId = $state<number | null>(null);
  let chosenDrinkIds = $state<Record<number, number>>({});

  onMount(() => {
    supported =
      typeof window !== 'undefined' &&
      typeof navigator !== 'undefined' &&
      !!navigator.mediaDevices &&
      typeof navigator.mediaDevices.getUserMedia === 'function' &&
      typeof window.MediaRecorder !== 'undefined';
  });

  onDestroy(() => {
    cleanupRecorder();
  });

  function cleanupRecorder() {
    if (countdown) { clearInterval(countdown); countdown = null; }
    if (stopTimeout) { clearTimeout(stopTimeout); stopTimeout = null; }
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
    recorder = null;
  }

  function pickMimeType(): string {
    const candidates = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mpeg'];
    for (const m of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(m)) return m;
    }
    return 'audio/webm';
  }

  async function startRecording() {
    if (recording || processing) return;
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      onError?.('Microphone permission denied');
      return;
    }
    chunks = [];
    const mime = pickMimeType();
    try {
      recorder = new MediaRecorder(mediaStream, { mimeType: mime });
    } catch {
      cleanupRecorder();
      onError?.('Recorder unsupported');
      return;
    }
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = async () => {
      recording = false;
      const blob = new Blob(chunks, { type: mime });
      cleanupRecorder();
      if (blob.size < 200) {
        onError?.('Nothing recorded');
        return;
      }
      await submitAudio(blob);
    };
    recorder.start();
    recording = true;
    elapsedMs = 0;
    const startedAt = Date.now();
    countdown = setInterval(() => {
      elapsedMs = Date.now() - startedAt;
    }, 100);
    stopTimeout = setTimeout(stopRecording, MAX_RECORD_MS);
  }

  function stopRecording() {
    if (!recording) return;
    if (recorder && recorder.state !== 'inactive') {
      try { recorder.stop(); } catch {}
    }
  }

  async function submitAudio(blob: Blob) {
    processing = true;
    try {
      const form = new FormData();
      form.set('audio', blob, 'order.webm');
      const res = await fetch(appPath('/api/voice'), { method: 'POST', body: form });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error ?? `Voice failed (${res.status})`);
      }
      if (payload.preview == null) {
        onError?.(payload.message ?? 'No speech detected');
        return;
      }
      lastTranscript = String(payload.transcript ?? '');
      const p: Preview = payload.preview;
      chosenProfileId = p.profileId ?? $selectedProfile?.id ?? null;
      chosenDrinkIds = {};
      preview = p;
      if (payload.autoSubmit) {
        await submitOrder();
      }
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Voice failed');
    } finally {
      processing = false;
    }
  }

  function cancelPreview() {
    preview = null;
    lastTranscript = '';
  }

  async function submitOrder() {
    if (!preview) return;
    const profileId = chosenProfileId ?? $selectedProfile?.id ?? null;
    if (!profileId) {
      onError?.('Pick a profile before submitting');
      return;
    }
    const drinkIds = preview.items.flatMap((it, idx) => {
      const id = chosenDrinkIds[idx] ?? it.drinkId;
      const qty = Math.max(1, it.quantity);
      return Array(qty).fill(id);
    });
    if (drinkIds.length === 0) {
      onError?.('No drinks resolved');
      return;
    }
    processing = true;
    try {
      const res = await fetch(appPath('/api/orders'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, drinkIds })
      });
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error ?? `Order failed (${res.status})`);
      }
      const summary = preview.items
        .map((it) => `${it.quantity}× ${it.name ?? `drink#${it.drinkId}`}`)
        .join(', ');
      preview = null;
      lastTranscript = '';
      onSubmitted?.(summary);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : 'Order failed');
    } finally {
      processing = false;
    }
  }

  const remainingSeconds = $derived(Math.max(0, Math.ceil((MAX_RECORD_MS - elapsedMs) / 1000)));
</script>

{#if supported}
  <button
    class="voice-fab"
    class:recording
    class:processing
    onclick={recording ? stopRecording : startRecording}
    aria-label={recording ? `Stop recording (${remainingSeconds}s)` : 'Voice order'}
    disabled={processing && !recording}
    title={recording ? `Recording — tap to stop (${remainingSeconds}s)` : 'Voice order'}
  >
    {#if processing && !recording}
      <span class="voice-fab__spinner" aria-hidden="true"></span>
    {:else}
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
        <path
          d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3z M19 11a7 7 0 0 1-14 0 M12 18v3 M9 21h6"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    {/if}
    {#if recording}
      <span class="voice-fab__timer">{remainingSeconds}s</span>
    {/if}
  </button>
{/if}

{#if preview}
  <div class="voice-overlay" role="dialog" aria-modal="true">
    <button class="voice-overlay__scrim" aria-label="Close" onclick={cancelPreview}></button>
    <div class="voice-modal">
      <header class="voice-modal__head">
        <h3>Voice order</h3>
        <button type="button" class="voice-modal__close" onclick={cancelPreview} aria-label="Close">×</button>
      </header>
      {#if lastTranscript}
        <p class="voice-modal__transcript">"{lastTranscript}"</p>
      {/if}
      <p class="voice-modal__confidence">Confidence: <strong>{preview.confidence}</strong></p>
      <div class="voice-modal__profile">
        <span class="voice-modal__profile-label">Profile:</span>
        <strong>{preview.profileName ?? $selectedProfile?.name ?? '—'}</strong>
      </div>
      <ul class="voice-modal__items">
        {#each preview.items as item, idx}
          <li>
            <strong>{item.quantity}×</strong>
            {#if item.name}
              {item.name}
            {:else}
              <em>(unresolved drink)</em>
            {/if}
            {#if item.notes}<span class="voice-modal__notes">— {item.notes}</span>{/if}
          </li>
        {/each}
      </ul>
      {#if preview.ambiguities.length > 0}
        <div class="voice-modal__ambiguities">
          <p class="voice-modal__ambig-head">Need a clarification:</p>
          {#each preview.ambiguities as amb}
            <div class="voice-modal__ambig">
              <p>"{amb.transcript_fragment}" ({amb.field})</p>
              {#each amb.candidates as cand}
                <span class="voice-modal__chip">{cand.label}</span>
              {/each}
            </div>
          {/each}
        </div>
      {/if}
      <div class="voice-modal__actions">
        <button type="button" class="voice-modal__btn" onclick={cancelPreview}>Cancel</button>
        <button
          type="button"
          class="voice-modal__btn voice-modal__btn--primary"
          onclick={submitOrder}
          disabled={processing || preview.items.length === 0}
        >
          {processing ? 'Submitting…' : 'Confirm order'}
        </button>
      </div>
    </div>
  </div>
{/if}

<style>
  .voice-fab {
    position: fixed;
    right: max(1rem, env(safe-area-inset-right));
    bottom: calc(env(safe-area-inset-bottom, 0) + 5rem);
    z-index: 40;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    padding: 0.7rem 1.05rem;
    border: 0;
    border-radius: 999px;
    background: var(--color-blood-500, #b91c1c);
    color: var(--color-paper-50, #fff);
    font-weight: 700;
    cursor: pointer;
    box-shadow: 0 10px 24px rgba(0, 0, 0, 0.18);
    transition: transform 0.12s ease, background 0.12s ease;
  }

  .voice-fab:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .voice-fab.recording {
    background: var(--color-danger-bg, #fee2e2);
    color: var(--color-danger-text, #991b1b);
    animation: voice-pulse 1.2s ease-in-out infinite;
  }

  .voice-fab__timer {
    font-variant-numeric: tabular-nums;
    font-size: 0.85rem;
  }

  .voice-fab__spinner {
    width: 1rem;
    height: 1rem;
    border: 2px solid currentColor;
    border-top-color: transparent;
    border-radius: 50%;
    animation: voice-spin 0.9s linear infinite;
  }

  @keyframes voice-pulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(185, 28, 28, 0.6); }
    50% { box-shadow: 0 0 0 12px rgba(185, 28, 28, 0); }
  }

  @keyframes voice-spin {
    to { transform: rotate(360deg); }
  }

  .voice-overlay {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1rem;
  }

  .voice-overlay__scrim {
    position: absolute;
    inset: 0;
    background: rgba(0, 0, 0, 0.55);
    border: 0;
  }

  .voice-modal {
    position: relative;
    z-index: 1;
    width: min(100%, 28rem);
    max-height: 90vh;
    overflow-y: auto;
    background: var(--color-paper-50, #fff);
    border: 1px solid var(--color-paper-300, #d1d5db);
    border-radius: 0.6rem;
    padding: 1rem 1.1rem;
    box-shadow: 0 24px 48px rgba(0, 0, 0, 0.25);
    display: grid;
    gap: 0.6rem;
  }

  .voice-modal__head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .voice-modal__head h3 { margin: 0; font-size: 1rem; font-weight: 700; }

  .voice-modal__close {
    border: 0;
    background: transparent;
    cursor: pointer;
    font-size: 1.5rem;
    line-height: 1;
    padding: 0.1rem 0.5rem;
  }

  .voice-modal__transcript {
    margin: 0;
    font-style: italic;
    color: var(--color-ink-500);
    font-size: 0.9rem;
  }

  .voice-modal__confidence,
  .voice-modal__profile {
    margin: 0;
    font-size: 0.85rem;
  }

  .voice-modal__items {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 0.35rem;
  }

  .voice-modal__items li {
    font-size: 0.95rem;
    padding: 0.4rem 0.55rem;
    border: 1px solid var(--color-paper-300);
    border-radius: 0.35rem;
    background: var(--color-paper-100);
  }

  .voice-modal__notes { color: var(--color-ink-500); font-size: 0.82rem; }

  .voice-modal__ambig-head {
    margin: 0.25rem 0;
    font-size: 0.82rem;
    font-weight: 700;
    color: var(--color-blood-600);
  }

  .voice-modal__ambig p { margin: 0 0 0.3rem; font-size: 0.85rem; }

  .voice-modal__chip {
    display: inline-block;
    padding: 0.18rem 0.45rem;
    margin: 0.1rem 0.25rem 0.1rem 0;
    border-radius: 999px;
    background: var(--color-paper-200);
    font-size: 0.78rem;
  }

  .voice-modal__actions {
    display: flex;
    gap: 0.5rem;
    justify-content: flex-end;
    margin-top: 0.25rem;
  }

  .voice-modal__btn {
    border: 1px solid var(--color-paper-300);
    background: var(--color-paper-50);
    color: var(--color-ink-900);
    padding: 0.45rem 0.9rem;
    border-radius: 0.35rem;
    font-weight: 600;
    cursor: pointer;
  }

  .voice-modal__btn--primary {
    background: var(--color-blood-500);
    color: var(--color-paper-50);
    border-color: var(--color-blood-500);
  }

  .voice-modal__btn:disabled { opacity: 0.6; cursor: not-allowed; }
</style>
