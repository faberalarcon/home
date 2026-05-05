import { fail, redirect } from '@sveltejs/kit';
import { makeSessionToken } from '$lib/server/auth';
import {
  isAdminPasswordConfigured,
  isAdminPasswordMustReset,
  verifyAdminPassword
} from '$lib/server/admin-password';
import { isSecureRequest } from '$lib/server/site-access';
import {
  checkAdminLoginGlobal,
  checkRateLimit,
  clearAdminLoginFailures,
  recordAdminLoginFailure
} from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  return {
    adminPasswordConfigured: isAdminPasswordConfigured()
  };
};

export const actions: Actions = {
  login: async ({ request, cookies, url, getClientAddress }) => {
    const fd = await request.formData();
    const password = (fd.get('password') as string | null) ?? '';
    const ip = getClientAddress();

    if (!isAdminPasswordConfigured()) {
      return fail(503, { error: 'Admin password is not configured.' });
    }

    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
      return fail(400, { error: 'Password must be 8–128 characters.' });
    }

    const globalCheck = checkAdminLoginGlobal();
    if (!globalCheck.allowed) {
      console.warn(`[auth] admin-login in global backoff; retryAfter=${globalCheck.retryAfter}s`);
      return fail(429, { error: 'Too many failed admin logins. Try again later.' });
    }

    const rateCheck = checkRateLimit('admin-login', ip);
    if (!rateCheck.allowed) {
      console.warn(`[auth] admin-login rate-limited ip=${ip} at=${new Date().toISOString()}`);
      return fail(429, { error: 'Too many login attempts. Try again later.' });
    }

    if (!verifyAdminPassword(password)) {
      recordAdminLoginFailure();
      console.warn(`[auth] admin-login failed ip=${ip} at=${new Date().toISOString()}`);
      return fail(401, { error: 'Incorrect password.' });
    }

    clearAdminLoginFailures();

    cookies.set('admin_session', makeSessionToken('admin'), {
      path: '/',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    if (isAdminPasswordMustReset()) {
      throw redirect(303, '/admin/settings?force_change=1');
    }
    throw redirect(303, '/admin');
  },

  logout: async ({ cookies }) => {
    cookies.delete('admin_session', { path: '/' });
    throw redirect(303, '/admin/login');
  }
};
