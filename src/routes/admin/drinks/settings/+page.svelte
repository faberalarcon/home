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
{#if form?.quip}
  <div class="mb-4 px-4 py-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-sm text-emerald-300">
    <span class="opacity-70 mr-2">Quip:</span>{form.quip}
  </div>
{/if}
{#if form?.quipError}
  <div class="mb-4 px-4 py-3 rounded-lg bg-red-950/60 border border-red-800 text-sm text-red-300">{form.quipError}</div>
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
      Announces drink orders on a media player via HA TTS. Each profile is limited to 3 announcements
      per minute; orders are queued and played sequentially. Milestone thresholds (1 daily, 5, 10) add a fun extra line.
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

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="lightsEntityId">Lights entity ID <span class="text-slate-600">(optional)</span></label>
      <input
        id="lightsEntityId" name="lightsEntityId" type="text"
        value={data.lightsEntityId}
        placeholder="light.living_room"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
      <p class="text-xs text-slate-500 mt-1">When set, flashes this light a random color on every TTS announcement.</p>
    </div>
  </div>

  <div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
    <h2 class="text-base font-semibold">LLM Quips (beta)</h2>
    <p class="text-xs text-slate-500">
      Generates a one-line announcement from a small local model on llama.cpp for every order and milestone.
      Falls back to the hardcoded pool on timeout, error, or if the wrong model is loaded.
      The order page preloads the target model on mount and heartbeats every 30 seconds; Gooby will see a
      409 with an "Override" button while a drinks session is active.
    </p>

    <div class="flex items-center gap-2">
      <input
        id="ttsLlmEnabled" name="ttsLlmEnabled" type="checkbox"
        checked={data.ttsLlmEnabled}
        class="rounded"
      />
      <label for="ttsLlmEnabled" class="text-sm text-slate-300">Enable LLM-generated quips</label>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="ttsLlmModel">Target model</label>
      <input
        id="ttsLlmModel" name="ttsLlmModel" type="text"
        value={data.ttsLlmModel}
        placeholder="gemma4:e2b"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
      />
      <p class="text-xs text-slate-500 mt-1">
        Must be a model id known to llama-swap. Small/fast models recommended:
        <code class="text-slate-400">gemma4:e2b</code>, <code class="text-slate-400">gemma4:e4b</code>.
      </p>
    </div>

    <div class="grid grid-cols-3 gap-3">
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="ttsLlmTimeoutMs">Timeout (ms)</label>
        <input
          id="ttsLlmTimeoutMs" name="ttsLlmTimeoutMs" type="number" min="500" max="15000" step="100"
          value={data.ttsLlmTimeoutMs}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="ttsLlmMaxTokens">Max tokens</label>
        <input
          id="ttsLlmMaxTokens" name="ttsLlmMaxTokens" type="number" min="8" max="256" step="1"
          value={data.ttsLlmMaxTokens}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
      <div>
        <label class="block text-sm text-slate-400 mb-1" for="ttsLlmPreloadTtlS">Preload TTL (s)</label>
        <input
          id="ttsLlmPreloadTtlS" name="ttsLlmPreloadTtlS" type="number" min="10" max="600" step="5"
          value={data.ttsLlmPreloadTtlS}
          class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-500"
        />
      </div>
    </div>

    <div>
      <label class="block text-sm text-slate-400 mb-1" for="ttsLlmSystemPrompt">System prompt</label>
      <textarea
        id="ttsLlmSystemPrompt" name="ttsLlmSystemPrompt" rows="8"
        class="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:border-slate-500"
      >{data.ttsLlmSystemPrompt}</textarea>
      <p class="text-xs text-slate-500 mt-1">
        Keep under ~250 tokens. The user prompt the server adds is a single short line with the profile, drink, today count, all-time count (or the milestone details).
      </p>
    </div>

    <div>
      <button
        type="submit" formaction="?/testQuip"
        class="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 text-sm hover:bg-slate-700 transition"
      >
        Test quip
      </button>
      <span class="ml-2 text-xs text-slate-500">Save first if you've changed the prompt.</span>
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

<div class="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4 max-w-lg mt-8">
  <h2 class="text-base font-semibold">Security</h2>

  <div class="space-y-3 text-sm text-slate-300">
    <div class="flex items-center justify-between gap-4">
      <span>House password</span>
      <span class={data.sitePasswordConfigured ? 'text-emerald-400' : 'text-amber-400'}>
        {data.sitePasswordConfigured ? 'Configured via environment' : 'Not configured'}
      </span>
    </div>
    <div class="flex items-center justify-between gap-4">
      <span>Admin access</span>
      <span class="text-emerald-400">Gated by Tailscale + nginx basic auth</span>
    </div>
  </div>

  <p class="text-xs text-slate-500">
    The house password is env-backed (<code class="text-slate-400">SITE_PASSWORD</code> /
    <code class="text-slate-400">SITE_PASSWORD_HASH</code>). Admin access is enforced at the
    edge: tailnet CIDR + basic auth on <code class="text-slate-400">admin.21bristoe.com</code>.
    Manage the admin credential by editing <code class="text-slate-400">.htpasswd-admin</code>
    on the server.
  </p>
</div>
