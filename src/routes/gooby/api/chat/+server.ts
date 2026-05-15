import { json } from '@sveltejs/kit';
import {
  addMessage,
  countMessages,
  createConversation,
  getConversation,
  getSettings,
  listMessages,
  renameConversation,
  type GoobyMessage
} from '$lib/gooby/db';
import {
  fetchGoobyModels,
  fetchLlamaModels,
  generateChatTitle,
  goobyModelOption,
  goobyModelStatusLabel,
  isModelLoadPendingError,
  resolveAvailableGoobyModel,
  streamChatCompletion,
  waitForGoobyModelReady,
  type ChatMessage
} from '$lib/gooby/llama';

function messageForLlama(message: GoobyMessage): ChatMessage {
  return {
    role: message.role,
    content: message.content
  };
}

function assistantDeltaFromSse(buffer: string): { content: string; reasoning: string; remaining: string } {
  let content = '';
  let reasoning = '';
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
        if (typeof delta?.reasoning_content === 'string') reasoning += delta.reasoning_content;
      } catch {
        // Ignore malformed upstream chunks but keep forwarding them to the client.
      }
    }
  }

  return { content, reasoning, remaining };
}

function sseEvent(event: 'status' | 'error' | 'title', payload: Record<string, unknown>): Uint8Array {
  return new TextEncoder().encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

async function openUpstreamChat(
  model: string,
  messages: ChatMessage[],
  controller: ReadableStreamDefaultController<Uint8Array>
): Promise<Response> {
  const label = goobyModelOption(model)?.displayLabel ?? model;
  const models = await fetchGoobyModels();
  const selectedModel = models.find((candidate) => candidate.id === model);

  if (!selectedModel) {
    throw new Error(`${label} is not listed by llama.cpp`);
  }

  if (selectedModel.status !== 'loaded') {
    controller.enqueue(sseEvent('status', { phase: 'loading', model, label }));
  }

  try {
    return await streamChatCompletion(model, messages);
  } catch (error) {
    if (!isModelLoadPendingError(error)) throw error;

    controller.enqueue(sseEvent('status', { phase: 'waiting', model, label }));
    await waitForGoobyModelReady(model, {
      onPoll(modelStatus) {
        controller.enqueue(
          sseEvent('status', {
            phase: 'loading',
            model,
            label,
            status: goobyModelStatusLabel(modelStatus)
          })
        );
      }
    });
    controller.enqueue(sseEvent('status', { phase: 'ready', model, label }));
    return streamChatCompletion(model, messages);
  }
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

  const models = await fetchLlamaModels().catch(() => []);
  model = resolveAvailableGoobyModel(model, models) ?? '';

  if (!model) {
    return json({ error: 'Selected GoobyGPT model is not available from llama.cpp' }, { status: 503 });
  }

  let conversation = conversationId ? getConversation(conversationId) : null;
  if (!conversation) {
    conversation = createConversation(model);
    conversationId = conversation.id;
  }

  const wasFirstExchange = countMessages(conversationId) === 0;
  addMessage(conversationId, 'user', prompt, model);
  const settings = getSettings();
  const messages = [
    { role: 'system', content: settings.systemPrompt } satisfies ChatMessage,
    ...listMessages(conversationId).slice(-40).map(messageForLlama)
  ];
  let assistantContent = '';
  let assistantReasoning = '';
  let parseBuffer = '';
  let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  let clientClosed = false;
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const upstream = await openUpstreamChat(model, messages, controller);
        reader = upstream.body!.getReader();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          parseBuffer += chunk;
          const parsed = assistantDeltaFromSse(parseBuffer);
          assistantContent += parsed.content;
          assistantReasoning += parsed.reasoning;
          parseBuffer = parsed.remaining;

          if (!clientClosed) {
            try {
              controller.enqueue(encoder.encode(chunk));
            } catch {
              clientClosed = true;
            }
          }
        }

        if (parseBuffer) {
          const parsed = assistantDeltaFromSse(`${parseBuffer}\n\n`);
          assistantContent += parsed.content;
          assistantReasoning += parsed.reasoning;
        }

        const finalContent = assistantContent.trim();
        const finalReasoning = assistantReasoning.trim();
        if (finalContent) {
          addMessage(conversationId, 'assistant', finalContent, model, finalReasoning || null);
        }

        if (wasFirstExchange && finalContent && !clientClosed) {
          try {
            const title = await generateChatTitle(model, prompt, finalContent);
            if (title) {
              const updated = renameConversation(conversationId, title);
              if (updated) {
                try {
                  controller.enqueue(sseEvent('title', { conversationId, title: updated.title }));
                } catch {
                  clientClosed = true;
                }
              }
            }
          } catch {
            // Title gen failures are silent — placeholder slice stays.
          }
        }

        if (!clientClosed) {
          try { controller.close(); } catch {}
        }
      } catch (error) {
        const partial = assistantContent.trim();
        if (partial) {
          addMessage(conversationId, 'assistant', partial, model, assistantReasoning.trim() || null);
        }
        if (!clientClosed) {
          const message = error instanceof Error ? error.message : 'Chat stream failed';
          try { controller.enqueue(sseEvent('error', { error: message })); } catch {}
          try { controller.close(); } catch {}
        }
      } finally {
        reader?.releaseLock();
      }
    },
    cancel() {
      // Client gone — keep draining upstream and persist final to DB.
      clientClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Conversation-Id': conversationId,
      'X-Gooby-Model': model
    }
  });
}
