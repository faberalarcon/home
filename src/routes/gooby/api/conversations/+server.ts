import { json } from '@sveltejs/kit';
import { createConversation, listConversations } from '$lib/gooby/db';
import { fetchLlamaModels, resolveGoobyModel } from '$lib/gooby/llama';
import { checkRateLimit } from '$lib/drinks/server/ratelimit';

export async function GET({ getClientAddress }) {
  const rate = checkRateLimit('gooby-api', getClientAddress());
  if (!rate.allowed) {
    return json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 1) } });
  }
  return json({ conversations: listConversations() });
}

export async function POST({ request, getClientAddress }) {
  const rate = checkRateLimit('gooby-api', getClientAddress());
  if (!rate.allowed) {
    return json({ error: 'Too many requests.' }, { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 1) } });
  }
  const body = await request.json().catch(() => ({}));
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : null;
  const models = await fetchLlamaModels().catch(() => []);
  const model = resolveGoobyModel(requestedModel, models);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'New chat';
  return json({ conversation: createConversation(model, title) }, { status: 201 });
}
