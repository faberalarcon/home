import { json } from '@sveltejs/kit';
import {
  addMessage,
  createConversation,
  getConversation,
  listMessages,
  type GoobyMessage
} from '$lib/gooby/db';
import { chooseDefaultModel, fetchLlamaModels, streamChatCompletion, type ChatMessage } from '$lib/gooby/llama';

function messageForLlama(message: GoobyMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content
  };
}

function assistantDeltaFromSse(buffer: string): { content: string; remaining: string } {
  let content = '';
  const parts = buffer.split('\n\n');
  const remaining = parts.pop() ?? '';

  for (const part of parts) {
    for (const line of part.split('\n')) {
      if (!line.startsWith('data:')) continue;
      const data = line.slice(5).trim();
      if (!data || data === '[DONE]') continue;

      try {
        const payload = JSON.parse(data);
        const delta = payload.choices?.[0]?.delta;
        if (typeof delta?.content === 'string') content += delta.content;
      } catch {
        // Ignore malformed upstream chunks but keep forwarding them to the client.
      }
    }
  }

  return { content, remaining };
}

export async function POST({ request }) {
  const body = await request.json().catch(() => ({}));
  const prompt = typeof body.prompt === 'string' ? body.prompt.trim() : '';
  let conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
  let model = typeof body.model === 'string' ? body.model.trim() : '';

  if (!prompt) {
    return json({ error: 'Prompt is required' }, { status: 400 });
  }

  if (prompt.length > 32_000) {
    return json({ error: 'Prompt is too long' }, { status: 400 });
  }

  if (!model) {
    const models = await fetchLlamaModels().catch(() => []);
    model = chooseDefaultModel(models) ?? '';
  }

  if (!model) {
    return json({ error: 'No llama.cpp model is available' }, { status: 503 });
  }

  let conversation = conversationId ? getConversation(conversationId) : null;
  if (!conversation) {
    conversation = createConversation(model);
    conversationId = conversation.id;
  }

  addMessage(conversationId, 'user', prompt, model);
  const messages = listMessages(conversationId).slice(-40).map(messageForLlama);
  const upstream = await streamChatCompletion(model, messages);
  const reader = upstream.body!.getReader();
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  let assistantContent = '';
  let parseBuffer = '';

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          parseBuffer += chunk;
          const parsed = assistantDeltaFromSse(parseBuffer);
          assistantContent += parsed.content;
          parseBuffer = parsed.remaining;
          controller.enqueue(encoder.encode(chunk));
        }

        if (parseBuffer) {
          const parsed = assistantDeltaFromSse(`${parseBuffer}\n\n`);
          assistantContent += parsed.content;
        }

        const finalContent = assistantContent.trim();
        if (finalContent) {
          addMessage(conversationId, 'assistant', finalContent, model);
        }

        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Chat stream failed';
        controller.enqueue(encoder.encode(`event: error\ndata: ${JSON.stringify({ error: message })}\n\n`));
        controller.close();
      } finally {
        reader.releaseLock();
      }
    },
    cancel() {
      reader.cancel().catch(() => {});
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Conversation-Id': conversationId
    }
  });
}
