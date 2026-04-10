import { fail, redirect } from '@sveltejs/kit';
import { hashPin, makeSessionToken } from '$lib/server/auth';
import { getConfiguredAdminPinHash, isSecureRequest } from '$lib/server/site-access';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    adminPinConfigured: !!getConfiguredAdminPinHash()
  };
};

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const fd = await request.formData();
    const pin = (fd.get('pin') as string | null)?.trim() ?? '';
    const storedHash = getConfiguredAdminPinHash();

    if (!storedHash) {
      return fail(503, { error: 'Admin PIN is not configured. Set ADMIN_PIN or ADMIN_PIN_HASH in the environment.' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return fail(400, { error: 'PIN must be exactly 4 digits.' });
    }

    if (hashPin(pin) !== storedHash) {
      return fail(401, { error: 'Incorrect PIN.' });
    }

    cookies.set('admin_session', makeSessionToken(storedHash), {
      path: '/',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    throw redirect(303, '/admin');
  }
};
