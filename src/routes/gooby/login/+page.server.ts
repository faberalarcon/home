import { fail, redirect } from '@sveltejs/kit';
import { makeSessionToken } from '$lib/drinks/server/auth';
import { checkRateLimit } from '$lib/drinks/server/ratelimit';
import { isSecureRequest } from '$lib/drinks/server/site-access';
import {
  getConfiguredGoobyPasswordHash,
  normalizeGoobyNextPath,
  verifyGoobyPassword
} from '$lib/gooby/auth';
import { readVisitorCount } from '$lib/site/visitors.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url, cookies, request, getClientAddress }) => {
  const next = normalizeGoobyNextPath(url.searchParams.get('next'));

  if (locals.goobyAuthenticated) {
    throw redirect(303, next);
  }

  const pw = url.searchParams.get('pw');
  if (pw && getConfiguredGoobyPasswordHash()) {
    const ip = getClientAddress();
    const rateCheck = checkRateLimit('gooby-login', ip);
    if (rateCheck.allowed && verifyGoobyPassword(pw.trim())) {
      cookies.set('gooby_session', makeSessionToken('gooby'), {
        path: '/gooby',
        httpOnly: true,
        secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
        maxAge: 24 * 60 * 60,
        sameSite: 'strict'
      });
      throw redirect(303, next);
    }
    if (!rateCheck.allowed) {
      console.warn(`[auth] gooby-login (qr) rate-limited ip=${ip} at=${new Date().toISOString()}`);
    } else {
      console.warn(`[auth] gooby-login (qr) failed ip=${ip} at=${new Date().toISOString()}`);
    }
  }

  return {
    next,
    passwordConfigured: locals.goobyPasswordEnabled,
    visitorCount: readVisitorCount()
  };
};

export const actions: Actions = {
  login: async ({ request, cookies, url, getClientAddress }) => {
    const fd = await request.formData();
    const password = (fd.get('password') as string | null)?.trim() ?? '';
    const next = normalizeGoobyNextPath((fd.get('next') as string | null) ?? url.searchParams.get('next'));
    const ip = getClientAddress();

    if (!getConfiguredGoobyPasswordHash()) {
      return fail(503, { error: 'GoobyGPT password is not configured.', next });
    }

    if (!password) {
      return fail(400, { error: 'Password is required.', next });
    }

    const rateCheck = checkRateLimit('gooby-login', ip);
    if (!rateCheck.allowed) {
      console.warn(`[auth] gooby-login rate-limited ip=${ip} at=${new Date().toISOString()}`);
      return fail(429, { error: 'Too many login attempts. Try again later.', next });
    }

    if (!verifyGoobyPassword(password)) {
      console.warn(`[auth] gooby-login failed ip=${ip} at=${new Date().toISOString()}`);
      return fail(401, { error: 'Incorrect password.', next });
    }

    cookies.set('gooby_session', makeSessionToken('gooby'), {
      path: '/gooby',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    throw redirect(303, next);
  },

  logout: async ({ cookies }) => {
    cookies.delete('gooby_session', { path: '/gooby' });
    throw redirect(303, '/gooby/login');
  }
};
