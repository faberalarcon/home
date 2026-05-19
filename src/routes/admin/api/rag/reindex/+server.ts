import { json, type RequestHandler } from '@sveltejs/kit';
import { checkAdminRateLimit } from '$lib/admin/server';
import { indexAll } from '$lib/gooby/server/rag';

export const POST: RequestHandler = async (event) => {
  if (!checkAdminRateLimit(event, 'api')) {
    return json({ error: 'Too many requests — please wait a moment' }, { status: 429 });
  }
  try {
    const result = await indexAll();
    console.log(
      `[gooby-rag] reindex inserted=${result.inserted} updated=${result.updated} removed=${result.removed}`
    );
    return json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[gooby-rag] reindex failed:', message);
    return json({ ok: false, error: message }, { status: 500 });
  }
};
