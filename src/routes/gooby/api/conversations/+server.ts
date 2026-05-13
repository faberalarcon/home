import { json } from '@sveltejs/kit';
import { createConversation, listConversations } from '$lib/gooby/db';
import { fetchLlamaModels, resolveGoobyModel } from '$lib/gooby/llama';

export async function GET() {
  return json({ conversations: listConversations() });
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const requestedModel = typeof body.model === 'string' && body.model.trim() ? body.model.trim() : null;
  const models = await fetchLlamaModels().catch(() => []);
  const model = resolveGoobyModel(requestedModel, models);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'New chat';
  return json({ conversation: createConversation(model, title) }, { status: 201 });
}
