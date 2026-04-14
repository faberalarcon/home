import { getSetting, setSetting } from '$lib/server/db/settings';
import { fail } from '@sveltejs/kit';
import {
  getConfiguredSitePasswordHash,
  isSecureRequest,
  verifySitePassword
} from '$lib/server/site-access';
import {
  isAdminPasswordConfigured,
  isAdminPasswordMustReset,
  resetAdminPassword,
  setAdminPassword,
  verifyAdminPassword
} from '$lib/server/admin-password';
import { makeSessionToken } from '$lib/server/auth';
import { validateOutboundUrl } from '$lib/server/url-allowlist';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  return {
    haBaseUrl: getSetting('ha_base_url') ?? '',
    siteName: getSetting('site_name') ?? 'drink-hub',
    hasToken: !!(getSetting('ha_token') ?? ''),
    sitePasswordConfigured: !!getConfiguredSitePasswordHash(),
    adminPasswordConfigured: isAdminPasswordConfigured(),
    adminPasswordMustReset: isAdminPasswordMustReset(),
    forceChange: url.searchParams.get('force_change') === '1',
    ttsEnabled: (getSetting('tts_enabled') ?? 'false') !== 'false' && (getSetting('tts_enabled') ?? '0') !== '0',
    ttsEntityId: getSetting('tts_entity_id') ?? '',
    ttsEngineId: getSetting('tts_engine_id') ?? '',
    ttsService: getSetting('tts_service') ?? 'tts/speak',
    lightsEntityId: getSetting('lights_entity_id') ?? ''
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

    return { saved: true };
  },

  test: async ({ request }) => {
    const fd = await request.formData();
    const formUrl = (fd.get('haBaseUrl') as string | null)?.trim() ?? '';
    const formToken = (fd.get('haToken') as string | null)?.trim() ?? '';
    const storedUrl = getSetting('ha_base_url') ?? '';
    const storedToken = getSetting('ha_token') ?? '';

    const targetUrl = formUrl || storedUrl;
    // Only reuse the stored token when the target URL matches what was already
    // saved. Otherwise the caller must supply a token for the new host — this
    // kills the "point base_url at attacker.tld, reuse stored bearer" attack.
    const usingStoredUrl = !formUrl || formUrl === storedUrl;
    const token = formToken || (usingStoredUrl ? storedToken : '');

    if (!targetUrl || !token) {
      return fail(400, {
        testError: formUrl && !formToken && !usingStoredUrl
          ? 'Enter the HA token again when testing a different base URL.'
          : 'URL and token are required to test the connection.'
      });
    }

    const check = await validateOutboundUrl(targetUrl);
    if (!check.ok || !check.url) {
      return fail(400, { testError: `Invalid HA base URL: ${check.error}` });
    }

    const cleanOrigin = `${check.url.origin}${check.url.pathname.replace(/\/$/, '')}`;

    try {
      const res = await fetch(`${cleanOrigin}/api/`, {
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
  },

  changeAdminPassword: async ({ request, cookies, url }) => {
    const fd = await request.formData();
    const current = (fd.get('currentPassword') as string | null) ?? '';
    const next = (fd.get('newPassword') as string | null) ?? '';
    const confirm = (fd.get('confirmPassword') as string | null) ?? '';

    if (!verifyAdminPassword(current)) {
      return fail(401, { pwError: 'Current password is incorrect.' });
    }
    if (next.length < 8 || next.length > 128) {
      return fail(400, { pwError: 'New password must be 8–128 characters.' });
    }
    if (next !== confirm) {
      return fail(400, { pwError: 'New passwords do not match.' });
    }
    if (next === current) {
      return fail(400, { pwError: 'New password must differ from the current password.' });
    }

    setAdminPassword(next);

    // setAdminPassword bumped the session epoch, which invalidated every admin
    // session (including ours). Re-mint a cookie for the calling user.
    cookies.set('admin_session', makeSessionToken('admin'), {
      path: '/',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    return { pwChanged: true };
  },

  resetAdminPassword: async ({ request, cookies }) => {
    const fd = await request.formData();
    const housePw = (fd.get('housePassword') as string | null) ?? '';

    if (!getConfiguredSitePasswordHash()) {
      return fail(400, {
        resetError:
          'House password is not configured. Set SITE_PASSWORD to use the reset flow, or restart the server without any admin credential to bootstrap a new temp password.'
      });
    }

    if (!verifySitePassword(housePw)) {
      return fail(401, { resetError: 'House password is incorrect.' });
    }

    const temp = resetAdminPassword();
    console.log('');
    console.log('==============================================================');
    console.log('[drink-hub] ADMIN PASSWORD RESET. New temporary password: ' + temp);
    console.log('[drink-hub] Log in at /admin/login and change it immediately.');
    console.log('==============================================================');
    console.log('');

    // resetAdminPassword bumped the session epoch too → log this user out.
    cookies.delete('admin_session', { path: '/' });

    return { resetTemp: temp };
  }
};
