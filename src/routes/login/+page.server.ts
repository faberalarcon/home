import { fail, redirect } from '@sveltejs/kit';
import { hashSitePassword, makeSessionToken } from '$lib/server/auth';
import { getConfiguredSitePasswordHash, isSecureRequest, normalizeNextPath } from '$lib/server/site-access';
import { checkRateLimit } from '$lib/server/ratelimit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const next = normalizeNextPath(url.searchParams.get('next'));

  if (!locals.sitePasswordEnabled) {
    throw redirect(303, next);
  }

  if (locals.siteAuthenticated) {
    throw redirect(303, next);
  }

  return { next };
};

export const actions: Actions = {
  login: async ({ request, cookies, url, getClientAddress }) => {
    const fd = await request.formData();
    const password = (fd.get('password') as string | null)?.trim() ?? '';
    const next = normalizeNextPath((fd.get('next') as string | null) ?? url.searchParams.get('next'));
    const storedHash = getConfiguredSitePasswordHash();
    const ip = getClientAddress();

    if (!storedHash) {
      return fail(503, { error: 'Site password is not configured.', next });
    }

    if (!password) {
      return fail(400, { error: 'Password is required.', next });
    }

    const rateCheck = checkRateLimit('login', ip);
    if (!rateCheck.allowed) {
      console.warn(`[auth] site-login rate-limited ip=${ip} at=${new Date().toISOString()}`);
      return fail(429, { error: 'Too many login attempts. Try again later.', next });
    }

    if (hashSitePassword(password) !== storedHash) {
      console.warn(`[auth] site-login failed ip=${ip} at=${new Date().toISOString()}`);
      return fail(401, { error: 'Incorrect password.', next });
    }

    cookies.set('site_session', makeSessionToken('site'), {
      path: '/',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    throw redirect(303, next);
  },

  logout: async ({ cookies }) => {
    cookies.delete('site_session', { path: '/' });
    throw redirect(303, '/login');
  }
};
