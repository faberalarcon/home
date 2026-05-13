import { json } from '@sveltejs/kit';
import { getSettings, updateSystemPrompt } from '$lib/gooby/db';

export async function GET() {
  return json(getSettings());
}

export async function PATCH({ request }) {
  const body = await request.json().catch(() => ({}));
  const systemPrompt = typeof body.systemPrompt === 'string' ? body.systemPrompt : '';

  if (systemPrompt.length > 4_000) {
    return json({ error: 'Instructions are too long' }, { status: 400 });
  }

  return json(updateSystemPrompt(systemPrompt));
}
