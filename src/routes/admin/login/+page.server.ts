import { fail, redirect } from '@sveltejs/kit';
import { getSetting, setSetting as _set } from '$lib/server/db/settings';
import { hashPin, makeSessionToken, verifySessionToken } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ cookies }) => {
  const pinHash = getSetting('admin_pin_hash') ?? '';
  if (verifySessionToken(cookies.get('admin_session'), pinHash)) {
    throw redirect(303, '/admin');
  }
  return {};
};

export const actions: Actions = {
  default: async ({ request, cookies }) => {
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
      secure: false,
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    throw redirect(303, '/admin');
  }
};
