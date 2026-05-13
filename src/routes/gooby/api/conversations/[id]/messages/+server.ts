import { json } from '@sveltejs/kit';
import { getConversation, listMessages } from '$lib/gooby/db';

export async function GET({ params }) {
  const conversation = getConversation(params.id);
  if (!conversation) {
    return json({ error: 'Conversation not found' }, { status: 404 });
  }

  return json({ conversation, messages: listMessages(params.id) });
}
