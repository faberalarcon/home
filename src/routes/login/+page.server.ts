import { fail, redirect } from '@sveltejs/kit';
import { hashSitePassword, makeSessionToken } from '$lib/server/auth';
import { getConfiguredSitePasswordHash, isSecureRequest, normalizeNextPath } from '$lib/server/site-access';
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
  default: async ({ request, cookies, url }) => {
    const fd = await request.formData();
    const password = (fd.get('password') as string | null)?.trim() ?? '';
    const next = normalizeNextPath((fd.get('next') as string | null) ?? url.searchParams.get('next'));
    const storedHash = getConfiguredSitePasswordHash();

    if (!storedHash) {
      return fail(503, { error: 'Site password is not configured.', next });
    }

    if (!password) {
      return fail(400, { error: 'Password is required.', next });
    }

    if (hashSitePassword(password) !== storedHash) {
      return fail(401, { error: 'Incorrect password.', next });
    }

    cookies.set('site_session', makeSessionToken(storedHash), {
      path: '/',
      httpOnly: true,
      secure: isSecureRequest(url, request.headers.get('x-forwarded-proto')),
      maxAge: 24 * 60 * 60,
      sameSite: 'strict'
    });

    throw redirect(303, next);
  }
};
