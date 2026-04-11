import { fail, redirect } from '@sveltejs/kit';
import { hashPin, makeSessionToken } from '$lib/server/auth';
import { getConfiguredAdminPinHash, isSecureRequest } from '$lib/server/site-access';
import { checkRateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    adminPinConfigured: !!getConfiguredAdminPinHash()
  };
};

export const actions: Actions = {
  login: async ({ request, cookies, url, getClientAddress }) => {
    const fd = await request.formData();
    const pin = (fd.get('pin') as string | null)?.trim() ?? '';
    const storedHash = getConfiguredAdminPinHash();
    const ip = getClientAddress();

    if (!storedHash) {
      return fail(503, { error: 'Admin PIN is not configured. Set ADMIN_PIN or ADMIN_PIN_HASH in the environment.' });
    }

    if (!/^\d{4}$/.test(pin)) {
      return fail(400, { error: 'PIN must be exactly 4 digits.' });
    }

    const rateCheck = checkRateLimit('admin-login', ip);
    if (!rateCheck.allowed) {
      console.warn(`[auth] admin-login rate-limited ip=${ip} at=${new Date().toISOString()}`);
      return fail(429, { error: 'Too many login attempts. Try again later.' });
    }

    if (hashPin(pin) !== storedHash) {
      console.warn(`[auth] admin-login failed ip=${ip} at=${new Date().toISOString()}`);
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
  },

  logout: async ({ cookies }) => {
    cookies.delete('admin_session', { path: '/' });
    throw redirect(303, '/admin/login');
  }
};
