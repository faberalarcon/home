<script lang="ts">
  import type { PageData, ActionData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<h1 class="text-2xl font-semibold mb-6">Settings</h1>

{#if form?.saved}
  <div class="mb-4 px-4 py-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-sm text-emerald-300">Settings saved.</div>
{/if}
{#if form?.testOk}
  <div class="mb-4 px-4 py-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-sm text-emerald-300">✓ Connected to Home Assistant successfully.</div>
{/if}
{#if form?.testError}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.testError}</div>
{/if}

<form method="POST" action="?/save" class="space-y-6 max-w-lg">
  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
    <h2 class="text-base font-semibold">Site</h2>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="siteName">Site name</label>
      <input
        id="siteName" name="siteName" type="text"
        value={data.siteName}
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
    </div>
  </div>

  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
    <h2 class="text-base font-semibold">Home Assistant</h2>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="haBaseUrl">Base URL</label>
      <input
        id="haBaseUrl" name="haBaseUrl" type="url"
        value={data.haBaseUrl}
        placeholder="http://homeassistant.local:8123"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="haToken">
        Long-lived access token
        {#if data.hasToken}
          <span class="text-emerald-500 ml-1">✓ configured</span>
        {/if}
      </label>
      <input
        id="haToken" name="haToken" type="password"
        placeholder={data.hasToken ? '(unchanged — paste new token to replace)' : 'Paste your HA long-lived token'}
        autocomplete="new-password"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
      <p class="text-xs text-slate-500 mt-1">Generate in HA → Profile → Long-lived access tokens.</p>
    </div>
  </div>

  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
    <h2 class="text-base font-semibold">Text-to-Speech</h2>
    <p class="text-xs text-slate-500">
      Announces drink orders on a media player via HA TTS. A 1-minute cooldown prevents spam.
      Milestone thresholds (1 daily, 5, 10) add a fun extra line.
    </p>

    <div class="flex items-center gap-2">
      <input
        id="ttsEnabled" name="ttsEnabled" type="checkbox"
        checked={data.ttsEnabled}
        class="rounded"
      />
      <label for="ttsEnabled" class="text-sm text-slate-300">Enable TTS announcements</label>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="ttsEntityId">Media player entity ID</label>
      <input
        id="ttsEntityId" name="ttsEntityId" type="text"
        value={data.ttsEntityId}
        placeholder="media_player.living_room_speaker"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="ttsEngineId">
        TTS engine entity ID
        <span class="text-slate-500">(only needed for tts/speak)</span>
      </label>
      <input
        id="ttsEngineId" name="ttsEngineId" type="text"
        value={data.ttsEngineId}
        placeholder="tts.google_translate_en_com"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="ttsService">TTS service</label>
      <input
        id="ttsService" name="ttsService" type="text"
        value={data.ttsService}
        placeholder="tts/speak"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
      <p class="text-xs text-slate-500 mt-1">
        Format: <code class="text-slate-400">domain/service</code>.
        Use <code class="text-slate-400">tts/speak</code> with a TTS engine entity (modern HA),
        or <code class="text-slate-400">tts/cloud_say</code> / <code class="text-slate-400">tts/google_translate_say</code> (legacy, no engine ID needed).
      </p>
    </div>
  </div>

  <div class="flex gap-3">
    <button
      type="submit"
      class="px-4 py-2 rounded-lg bg-orange-500 text-slate-950 font-semibold text-sm hover:bg-orange-400 transition"
    >
      Save settings
    </button>
    <button
      type="submit" formaction="?/test"
      class="px-4 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
    >
      Test HA connection
    </button>
  </div>
</form>
