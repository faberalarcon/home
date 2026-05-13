import { json } from '@sveltejs/kit';
import { deleteConversation, getConversation, renameConversation } from '$lib/gooby/db';

export async function PATCH({ params, request }) {
  const body = await request.json().catch(() => ({}));
  const title = typeof body.title === 'string' ? body.title : '';
  const conversation = renameConversation(params.id, title);

  if (!conversation) {
    return json({ error: 'Conversation not found' }, { status: 404 });
  }

  return json({ conversation });
}

export async function DELETE({ params }) {
  const existed = deleteConversation(params.id);
  return json({ ok: existed });
}

export async function GET({ params }) {
  const conversation = getConversation(params.id);
  if (!conversation) {
    return json({ error: 'Conversation not found' }, { status: 404 });
  }
  return json({ conversation });
}
