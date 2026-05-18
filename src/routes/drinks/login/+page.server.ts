import { fail, redirect } from '@sveltejs/kit';
import { makeSessionToken } from '$lib/drinks/server/auth';
import { getConfiguredSitePasswordHash, isSecureRequest, normalizeNextPath, verifySitePassword } from '$lib/drinks/server/site-access';
import { checkRateLimit } from '$lib/drinks/server/ratelimit';
import { appPath } from '$lib/drinks/app-paths';
import { readVisitorCount } from '$lib/site/visitors.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies, request, getClientAddress }) => {
  const next = normalizeNextPath(url.searchParams.get('next'));

  if (!locals.sitePasswordEnabled) {
    throw redirect(303, appPath(next));
  }

  if (locals.siteAuthenticated) {
    throw redirect(303, appPath(next));
  }

  const pw = url.searchParams.get('pw');
  const storedHash = getConfiguredSitePasswordHash();
  if (pw && storedHash) {
    const ip = getClientAddress();
    const rateCheck = checkRateLimit('login', ip);
    if (rateCheck.allowed && verifySitePassword(pw.trim())) {
      cookies.set('site_session', makeSessionToken('site'), {
        path: appPath('/'),
        httpOnly: true,
        secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
        maxAge: 24 * 60 * 60,
        sameSite: 'lax'
      });
      throw redirect(303, appPath(next));
    }
    if (!rateCheck.allowed) {
      console.warn(`[auth] site-login (qr) rate-limited ip=${ip} at=${new Date().toISOString()}`);
    } else {
      console.warn(`[auth] site-login (qr) failed ip=${ip} at=${new Date().toISOString()}`);
    }
  }

  return {
    next,
    visitorCount: readVisitorCount()
  };
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

    if (!verifySitePassword(password)) {
      console.warn(`[auth] site-login failed ip=${ip} at=${new Date().toISOString()}`);
      return fail(401, { error: 'Incorrect password.', next });
    }

    cookies.set('site_session', makeSessionToken('site'), {
      path: appPath('/'),
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'lax'
    });

    throw redirect(303, appPath(next));
  },

  logout: async ({ cookies }) => {
    cookies.delete('site_session', { path: appPath('/') });
    throw redirect(303, appPath('/login'));
  }
};
