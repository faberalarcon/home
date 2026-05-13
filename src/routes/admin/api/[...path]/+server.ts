import { json, type RequestHandler } from '@sveltejs/kit';
import {
  adminStats,
  batchDelete,
  checkAdminRateLimit,
  clearOgImage,
  deleteFixedImage,
  deleteImage,
  getSiteConfig,
  limonImageStatus,
  memberKey,
  readManifest,
  reorderImages,
  resetVisitorCount,
  setOgImage,
  updateSiteConfig,
  uploadFixedImage,
  uploadImages
} from '$lib/admin/server';
import { getSettings, updateSystemPrompt } from '$lib/gooby/db';

function result(data: any) {
  if (data && typeof data.status === 'number' && data.error) {
    return json({ error: data.error }, { status: data.status });
  }
  return json(data);
}

function routeParts(pathname: string | undefined) {
  return (pathname || '').split('/').filter(Boolean);
}

export const GET: RequestHandler = async (event) => {
  if (!checkAdminRateLimit(event, 'api')) return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });
  const parts = routeParts(event.params.path);

  if (parts[0] === 'health') {
    const manifest = readManifest();
    return json({ status: 'ok', uptime: Math.round(process.uptime()), imageCount: manifest.images.length, manifestValid: true });
  }
  if (parts[0] === 'images' && parts.length === 1) return json(readManifest());
  if (parts[0] === 'limon-image') return json(limonImageStatus());
  if (parts[0] === 'stats') return json(adminStats());
  if (parts[0] === 'site-config') return json(getSiteConfig());
  if (parts[0] === 'gooby-settings') return json(getSettings());

  return json({ error: 'Not found' }, { status: 404 });
};

export const POST: RequestHandler = async (event) => {
  const parts = routeParts(event.params.path);
  const limiter = parts[0] === 'upload' || parts[0] === 'limon-image' || parts[0] === 'member-photo' ? 'upload' : 'api';
  if (!checkAdminRateLimit(event, limiter)) return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });

  if (parts[0] === 'upload') {
    const form = await event.request.formData();
    const files = form.getAll('images').filter((value): value is File => value instanceof File);
    return result(await uploadImages(files, event));
  }

  if (parts[0] === 'limon-image') {
    const form = await event.request.formData();
    const file = form.get('image');
    return result(await uploadFixedImage(file instanceof File ? file : null, 'limon', event));
  }

  if (parts[0] === 'visitor-count' && parts[1] === 'reset') return json(resetVisitorCount(event));

  if (parts[0] === 'member-photo' && parts[1]) {
    const member = memberKey(parts[1]);
    if (!['faber', 'kasey', 'limon'].includes(member)) return json({ error: 'Unknown member' }, { status: 400 });
    const form = await event.request.formData();
    const file = form.get('image');
    return result(await uploadFixedImage(file instanceof File ? file : null, member, event));
  }

  if (parts[0] === 'images' && parts[1] && parts[2] === 'og') {
    return result(await setOgImage(parts[1], event));
  }

  if (parts[0] === 'rebuild') {
    return json({ ok: true, message: 'Content is read at runtime; no deploy is required for admin content changes.' });
  }

  return json({ error: 'Not found' }, { status: 404 });
};

export const PUT: RequestHandler = async (event) => {
  if (!checkAdminRateLimit(event, 'api')) return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });
  const parts = routeParts(event.params.path);
  const body = await event.request.json().catch(() => ({}));

  if (parts[0] === 'images' && parts[1] === 'reorder') return result(await reorderImages(body.order, event));
  if (parts[0] === 'site-config') return result(updateSiteConfig(body, event));
  if (parts[0] === 'gooby-settings') {
    const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : '';
    if (systemPrompt.length > 4_000) return json({ error: 'Instructions are too long' }, { status: 400 });
    return json(updateSystemPrompt(systemPrompt));
  }

  return json({ error: 'Not found' }, { status: 404 });
};

export const DELETE: RequestHandler = async (event) => {
  if (!checkAdminRateLimit(event, 'api')) return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });
  const parts = routeParts(event.params.path);

  if (parts[0] === 'images' && parts.length === 1) {
    const body = await event.request.json().catch(() => ({}));
    return result(await batchDelete(body.filenames, event));
  }

  if (parts[0] === 'images' && parts[1]) return result(await deleteImage(parts[1], event));
  if (parts[0] === 'limon-image') return json(deleteFixedImage('limon', event));
  if (parts[0] === 'member-photo' && parts[1]) {
    const member = memberKey(parts[1]);
    if (!['faber', 'kasey', 'limon'].includes(member)) return json({ error: 'Unknown member' }, { status: 400 });
    return json(deleteFixedImage(member, event));
  }
  if (parts[0] === 'og-image') return result(await clearOgImage(event));

  return json({ error: 'Not found' }, { status: 404 });
};
