import { getSetting, setSetting } from '$lib/drinks/server/db/settings';
import { fail } from '@sveltejs/kit';
import { getConfiguredSitePasswordHash } from '$lib/drinks/server/site-access';
import { validateOutboundUrl } from '$lib/drinks/server/url-allowlist';
import { haHealthFetch } from '$lib/drinks/server/ha';
import { generateOrderQuip } from '$lib/drinks/server/tts-llm';
import { runTtsTest } from '$lib/drinks/server/tts';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  return {
    haBaseUrl: getSetting('ha_base_url') ?? '',
    siteName: getSetting('site_name') ?? 'drink-hub',
    hasToken: !!(getSetting('ha_token') ?? ''),
    sitePasswordConfigured: !!getConfiguredSitePasswordHash(),
    ttsEnabled: (getSetting('tts_enabled') ?? 'false') !== 'false' && (getSetting('tts_enabled') ?? '0') !== '0',
    ttsEntityId: getSetting('tts_entity_id') ?? '',
    ttsEngineId: getSetting('tts_engine_id') ?? '',
    ttsService: getSetting('tts_service') ?? 'tts/speak',
    lightsEntityId: getSetting('lights_entity_id') ?? '',
    ttsLlmEnabled: (getSetting('tts_llm_enabled') ?? 'false') === 'true',
    ttsLlmModel: getSetting('tts_llm_model') ?? 'gemma4:e2b',
    ttsLlmTimeoutMs: getSetting('tts_llm_timeout_ms') ?? '3000',
    ttsLlmMaxTokens: getSetting('tts_llm_max_tokens') ?? '60',
    ttsLlmPreloadTtlS: getSetting('tts_llm_preload_ttl_s') ?? '60',
    ttsLlmSystemPrompt: getSetting('tts_llm_system_prompt') ?? '',
    ttsLlmSystemPromptFood: getSetting('tts_llm_system_prompt_food') ?? '',
    ttsLlmSystemPromptMisc: getSetting('tts_llm_system_prompt_misc') ?? ''
  };
};

export const actions: Actions = {
  save: async ({ request }) => {
    const fd = await request.formData();
    const haBaseUrl = (fd.get('haBaseUrl') as string | null)?.trim() ?? '';
    const siteName = (fd.get('siteName') as string | null)?.trim() || 'drink-hub';
    const haToken = (fd.get('haToken') as string | null)?.trim() ?? '';
    const ttsEnabled = fd.get('ttsEnabled') === 'on' ? 'true' : 'false';
    const ttsEntityId = (fd.get('ttsEntityId') as string | null)?.trim() ?? '';
    const ttsEngineId = (fd.get('ttsEngineId') as string | null)?.trim() ?? '';
    const ttsService = (fd.get('ttsService') as string | null)?.trim() || 'tts/speak';
    const lightsEntityId = (fd.get('lightsEntityId') as string | null)?.trim() ?? '';

    if (haBaseUrl) {
      const check = await validateOutboundUrl(haBaseUrl);
      if (!check.ok) {
        return fail(400, { error: `Invalid HA base URL: ${check.error}` });
      }
      setSetting('ha_base_url', haBaseUrl);
    }
    if (siteName) setSetting('site_name', siteName);
    if (haToken) setSetting('ha_token', haToken);
    setSetting('tts_enabled', ttsEnabled);
    setSetting('tts_entity_id', ttsEntityId);
    setSetting('tts_engine_id', ttsEngineId);
    setSetting('tts_service', ttsService);
    setSetting('lights_entity_id', lightsEntityId);

    const ttsLlmEnabled = fd.get('ttsLlmEnabled') === 'on' ? 'true' : 'false';
    const ttsLlmModel = ((fd.get('ttsLlmModel') as string | null) ?? '').trim() || 'gemma4:e2b';
    const ttsLlmTimeoutMs = ((fd.get('ttsLlmTimeoutMs') as string | null) ?? '').trim() || '3000';
    const ttsLlmMaxTokens = ((fd.get('ttsLlmMaxTokens') as string | null) ?? '').trim() || '60';
    const ttsLlmPreloadTtlS = ((fd.get('ttsLlmPreloadTtlS') as string | null) ?? '').trim() || '60';
    const ttsLlmSystemPrompt = ((fd.get('ttsLlmSystemPrompt') as string | null) ?? '').trim();
    const ttsLlmSystemPromptFood = ((fd.get('ttsLlmSystemPromptFood') as string | null) ?? '').trim();
    const ttsLlmSystemPromptMisc = ((fd.get('ttsLlmSystemPromptMisc') as string | null) ?? '').trim();
    setSetting('tts_llm_enabled', ttsLlmEnabled);
    setSetting('tts_llm_model', ttsLlmModel);
    setSetting('tts_llm_timeout_ms', ttsLlmTimeoutMs);
    setSetting('tts_llm_max_tokens', ttsLlmMaxTokens);
    setSetting('tts_llm_preload_ttl_s', ttsLlmPreloadTtlS);
    if (ttsLlmSystemPrompt) setSetting('tts_llm_system_prompt', ttsLlmSystemPrompt);
    if (ttsLlmSystemPromptFood) setSetting('tts_llm_system_prompt_food', ttsLlmSystemPromptFood);
    if (ttsLlmSystemPromptMisc) setSetting('tts_llm_system_prompt_misc', ttsLlmSystemPromptMisc);

    return { saved: true };
  },

  testTts: async () => {
    const result = await runTtsTest('Living room speaker test from admin.');
    if (!result.ok) {
      return fail(400, { ttsTestError: result.error });
    }
    return { ttsTestOk: true };
  },

  testQuip: async () => {
    const quip = await generateOrderQuip({
      profileName: 'Faber',
      items: [{ name: 'pretzels', category: 'snack', quantity: 1 }]
    });
    if (!quip) {
      return fail(502, { quipError: 'No quip returned — check that tts_llm_enabled is true and the target model is loaded on llama.cpp.' });
    }
    return { quip };
  },

  test: async ({ request }) => {
    const fd = await request.formData();
    const formUrl = (fd.get('haBaseUrl') as string | null)?.trim() ?? '';
    const formToken = (fd.get('haToken') as string | null)?.trim() ?? '';
    const storedUrl = getSetting('ha_base_url') ?? '';
    const storedToken = getSetting('ha_token') ?? '';

    const targetUrl = formUrl || storedUrl;
    const usingStoredUrl = !formUrl || formUrl === storedUrl;
    const token = formToken || (usingStoredUrl ? storedToken : '');

    if (!targetUrl || !token) {
      return fail(400, {
        testError: formUrl && !formToken && !usingStoredUrl
          ? 'Enter the HA token again when testing a different base URL.'
          : 'URL and token are required to test the connection.'
      });
    }

    const probe = await haHealthFetch(targetUrl, token, 5000);
    if (probe.ok) {
      return { testOk: true };
    }
    // Distinguish validation failure (4xx-like) from network failure (5xx-like).
    const isValidation = /^Invalid HA base URL|^URL|^Host /i.test(probe.error);
    return fail(isValidation ? 400 : 502, { testError: probe.error });
  }
};
