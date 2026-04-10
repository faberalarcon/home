import { getSetting, setSetting } from '$lib/server/db/settings';
import { fail } from '@sveltejs/kit';
import { getConfiguredAdminPinHash, getConfiguredSitePasswordHash } from '$lib/server/site-access';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async () => {
  return {
    haBaseUrl: getSetting('ha_base_url') ?? '',
    siteName: getSetting('site_name') ?? 'drink-hub',
    hasToken: !!(getSetting('ha_token') ?? ''),
    sitePasswordConfigured: !!getConfiguredSitePasswordHash(),
    adminPinConfigured: !!getConfiguredAdminPinHash(),
    ttsEnabled: (getSetting('tts_enabled') ?? 'false') !== 'false' && (getSetting('tts_enabled') ?? '0') !== '0',
    ttsEntityId: getSetting('tts_entity_id') ?? '',
    ttsEngineId: getSetting('tts_engine_id') ?? '',
    ttsService: getSetting('tts_service') ?? 'tts/speak'
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

    if (haBaseUrl) setSetting('ha_base_url', haBaseUrl);
    if (siteName) setSetting('site_name', siteName);
    if (haToken) setSetting('ha_token', haToken);
    setSetting('tts_enabled', ttsEnabled);
    setSetting('tts_entity_id', ttsEntityId);
    setSetting('tts_engine_id', ttsEngineId);
    setSetting('tts_service', ttsService);

    return { saved: true };
  },

  test: async ({ request }) => {
    const fd = await request.formData();
    const url = (fd.get('haBaseUrl') as string | null)?.trim() ?? getSetting('ha_base_url') ?? '';
    const token = (fd.get('haToken') as string | null)?.trim() || (getSetting('ha_token') ?? '');

    if (!url || !token) {
      return fail(400, { testError: 'URL and token are required to test the connection.' });
    }

    try {
      const res = await fetch(`${url.replace(/\/$/, '')}/api/`, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(5000)
      });
      if (res.ok) {
        return { testOk: true };
      }
      return fail(502, { testError: `HA returned HTTP ${res.status} ${res.statusText}` });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return fail(502, { testError: `Connection failed: ${msg}` });
    }
  }
};
