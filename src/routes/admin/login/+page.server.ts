import { fail, redirect } from '@sveltejs/kit';
import { getSetting } from '$lib/server/db/settings';
import { hashPin, makeSessionToken } from '$lib/server/auth';
import { isSecureRequest } from '$lib/server/site-access';
import type { Actions } from './$types';

export const actions: Actions = {
  default: async ({ request, cookies, url }) => {
    const fd = await request.formData();
    const pin = (fd.get('pin') as string | null)?.trim() ?? '';

    if (!/^\d{4}$/.test(pin)) {
      return fail(400, { error: 'PIN must be exactly 4 digits.' });
    }

    const storedHash = getSetting('admin_pin_hash') ?? '';
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
