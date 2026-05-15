import type { LlamaModel, LlamaStatus } from './llama';

const STORED_MODEL_KEY = 'gooby:selectedModel';

function readStoredModel(): string | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    return localStorage.getItem(STORED_MODEL_KEY);
  } catch {
    return null;
  }
}

function writeStoredModel(modelId: string) {
  if (typeof localStorage === 'undefined') return;
  if (!modelId) return;
  try {
    localStorage.setItem(STORED_MODEL_KEY, modelId);
  } catch {
    // ignore
  }
}

export type GoobyConversation = {
  id: string;
  title: string;
  model: string | null;
  createdAt: number;
  updatedAt: number;
};

export type GoobyMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  reasoning?: string | null;
  model: string | null;
  createdAt: number;
};

export type GoobyChatInit = {
  conversations: GoobyConversation[];
  llama: LlamaStatus;
};

type SseEvent = { name: string; data: any };

function readSseEvents(buffer: string): { events: SseEvent[]; remaining: string } {
  const events: SseEvent[] = [];
  const chunks = buffer.split('\n\n');
  const remaining = chunks.pop() ?? '';

  for (const chunk of chunks) {
    let name = '';
    const dataParts: string[] = [];
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event:')) name = line.slice(6).trim();
      else if (line.startsWith('data:')) dataParts.push(line.slice(5).trim());
    }
    for (const dataLine of dataParts) {
      if (!dataLine || dataLine === '[DONE]') continue;
      try {
        events.push({ name, data: JSON.parse(dataLine) });
      } catch {
        // Ignore malformed upstream chunks.
      }
    }
  }

  return { events, remaining };
}

type TitleUpdate = { conversationId: string; title: string };

type ChatChunkParse = {
  content: string;
  reasoning: string;
  remaining: string;
  error: string | null;
  awaitingModel: boolean;
  titleUpdate: TitleUpdate | null;
};

function parseChatChunk(buffer: string): ChatChunkParse {
  let content = '';
  let reasoning = '';
  let error: string | null = null;
  let awaitingModel = false;
  let titleUpdate: TitleUpdate | null = null;
  const { events, remaining } = readSseEvents(buffer);

  for (const event of events) {
    if (event.name === 'status') {
      if (event.data?.phase && event.data.phase !== 'ready') awaitingModel = true;
      continue;
    }
    if (event.name === 'error') {
      if (typeof event.data?.error === 'string') error = event.data.error;
      continue;
    }
    if (event.name === 'title') {
      const id = event.data?.conversationId;
      const title = event.data?.title;
      if (typeof id === 'string' && typeof title === 'string' && title) {
        titleUpdate = { conversationId: id, title };
      }
      continue;
    }
    const delta = event.data?.choices?.[0]?.delta;
    if (typeof delta?.content === 'string') content += delta.content;
    if (typeof delta?.reasoning_content === 'string') reasoning += delta.reasoning_content;
    if (typeof event.data?.error === 'string') error = event.data.error;
    if (typeof event.data?.error?.message === 'string') error = event.data.error.message;
  }

  return { content, reasoning, remaining, error, awaitingModel, titleUpdate };
}

export class GoobyChat {
  conversations = $state<GoobyConversation[]>([]);
  models = $state<LlamaModel[]>([]);
  selectedId = $state<string | null>(null);
  selectedModel = $state<string>('');
  messages = $state<GoobyMessage[]>([]);
  prompt = $state('');
  loadingMessages = $state(false);
  sending = $state(false);
  switchingModel = $state(false);
  error = $state<string | null>(null);

  private fallbackDefaultModel: string;
  private streamAbort: AbortController | null = null;
  private switchAbort: AbortController | null = null;
  private onScroll: (() => void) | null = null;
  private userStopped = false;

  constructor(init: GoobyChatInit) {
    this.conversations = init.conversations;
    this.models = init.llama.models;
    this.selectedId = init.conversations[0]?.id ?? null;
    this.fallbackDefaultModel = init.llama.defaultModel ?? init.llama.models[0]?.id ?? '';
    const stored = readStoredModel();
    const storedAvailable = stored && this.models.some((model) => model.id === stored);
    this.selectedModel = storedAvailable ? (stored as string) : this.fallbackDefaultModel;
    this.error = init.llama.error;
  }

  private persistSelected() {
    writeStoredModel(this.selectedModel);
  }

  setScrollHandler(handler: (() => void) | null) {
    this.onScroll = handler;
  }

  get selectedConversation(): GoobyConversation | null {
    return this.conversations.find((conversation) => conversation.id === this.selectedId) ?? null;
  }

  get selectedModelInfo(): LlamaModel | null {
    return this.models.find((model) => model.id === this.selectedModel) ?? null;
  }

  get canSend(): boolean {
    return Boolean(this.prompt.trim() && this.selectedModel && !this.sending);
  }

  shortLabel(modelId: string | null): string {
    if (!modelId) return '';
    return this.models.find((model) => model.id === modelId)?.shortLabel ?? modelId;
  }

  async selectModel(modelId: string) {
    if (this.sending || modelId === this.selectedModel) return;
    this.selectedModel = modelId;
    this.error = null;
    this.switchingModel = true;

    this.switchAbort?.abort();
    const controller = new AbortController();
    this.switchAbort = controller;

    let reachedTerminal = false;

    try {
      const res = await fetch('/gooby/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId }),
        signal: controller.signal
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        this.error = payload?.error ?? 'Model switch failed';
        return;
      }

      if (!res.body) {
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let parseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parseBuffer += decoder.decode(value, { stream: true });
        const { events, remaining } = readSseEvents(parseBuffer);
        parseBuffer = remaining;

        for (const event of events) {
          if (event.name !== 'status') continue;
          const data = event.data ?? {};
          if (Array.isArray(data.models)) {
            this.models = data.models;
          }
          if (data.phase === 'ready') {
            reachedTerminal = true;
            this.error = null;
            this.persistSelected();
          } else if (data.phase === 'failed') {
            reachedTerminal = true;
            this.error = typeof data.error === 'string' ? data.error : 'Model failed to load';
          }
        }
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
      this.error = err instanceof Error ? err.message : 'Failed to switch model';
    } finally {
      if (this.switchAbort === controller) this.switchAbort = null;
      if (!reachedTerminal && !this.error) {
        // Stream closed without explicit terminal — fall back to a snapshot fetch.
        await this.refreshModels({ preserveError: true }).catch(() => {});
      }
      this.switchingModel = false;
    }
  }

  async refreshModels(options: { preserveError?: boolean } = {}) {
    try {
      const res = await fetch('/gooby/api/models', { cache: 'no-store' });
      if (!res.ok) throw new Error('Unable to refresh GoobyGPT models');
      const payload = await res.json();
      const nextModels: LlamaModel[] = payload.models ?? [];
      this.models = nextModels;
      const available = new Set(nextModels.map((model) => model.id));
      if (!this.selectedModel || !available.has(this.selectedModel)) {
        this.selectedModel = payload.defaultModel ?? nextModels[0]?.id ?? '';
      }
      if (!options.preserveError || payload.error) this.error = payload.error ?? null;
      return payload;
    } catch (err) {
      if (!options.preserveError) {
        this.error = err instanceof Error ? err.message : 'Unable to refresh GoobyGPT models';
      }
      return null;
    }
  }

  async refreshConversations() {
    const res = await fetch('/gooby/api/conversations');
    const payload = await res.json();
    this.conversations = payload.conversations ?? [];
  }

  async loadMessages(id: string | null) {
    if (!id) {
      this.messages = [];
      return;
    }

    this.loadingMessages = true;
    this.error = null;

    try {
      const res = await fetch(`/gooby/api/conversations/${id}/messages`);
      if (!res.ok) throw new Error('Unable to load conversation');
      const payload = await res.json();
      this.messages = payload.messages ?? [];
      const conversationModel = payload.conversation?.model;
      if (conversationModel && this.models.some((model) => model.id === conversationModel)) {
        this.selectedModel = conversationModel;
      } else if (!this.selectedModel || !this.models.some((model) => model.id === this.selectedModel)) {
        this.selectedModel = this.fallbackDefaultModel || this.models[0]?.id || this.selectedModel;
      }
      this.onScroll?.();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Unable to load conversation';
    } finally {
      this.loadingMessages = false;
    }
  }

  async openConversation(id: string) {
    this.selectedId = id;
    await this.loadMessages(id);
  }

  async newConversation() {
    const res = await fetch('/gooby/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: this.selectedModel })
    });
    const payload = await res.json();
    if (!res.ok) {
      this.error = payload.error ?? 'Unable to create conversation';
      return null;
    }
    this.conversations = [payload.conversation, ...this.conversations];
    this.selectedId = payload.conversation.id;
    this.messages = [];
    return payload.conversation as GoobyConversation;
  }

  async renameConversation(id: string, title: string) {
    const res = await fetch(`/gooby/api/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    const payload = await res.json();
    if (!res.ok) {
      this.error = payload.error ?? 'Unable to rename conversation';
      return null;
    }
    this.conversations = this.conversations.map((conversation) =>
      conversation.id === payload.conversation.id ? payload.conversation : conversation
    );
    return payload.conversation as GoobyConversation;
  }

  async deleteConversation(id: string) {
    await fetch(`/gooby/api/conversations/${id}`, { method: 'DELETE' });
    this.conversations = this.conversations.filter((conversation) => conversation.id !== id);
    if (this.selectedId === id) {
      this.selectedId = this.conversations[0]?.id ?? null;
      await this.loadMessages(this.selectedId);
    }
  }

  stop() {
    this.userStopped = true;
    this.streamAbort?.abort();
  }

  async sendMessage(input?: string) {
    const text = (input ?? this.prompt).trim();
    if (!text || !this.selectedModel || this.sending) return;

    this.sending = true;
    this.error = null;
    if (input === undefined) this.prompt = '';

    const userMessage: GoobyMessage = {
      id: `local-user-${Date.now()}`,
      role: 'user',
      content: text,
      model: this.selectedModel,
      createdAt: Date.now()
    };
    const assistantMessage: GoobyMessage = {
      id: `local-assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      reasoning: '',
      model: this.selectedModel,
      createdAt: Date.now()
    };
    this.messages = [...this.messages, userMessage, assistantMessage];
    this.onScroll?.();

    const controller = new AbortController();
    this.streamAbort = controller;

    try {
      const res = await fetch('/gooby/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          conversationId: this.selectedId,
          model: this.selectedModel,
          prompt: text
        })
      });

      const conversationId = res.headers.get('x-conversation-id');
      if (conversationId) this.selectedId = conversationId;
      const responseModel = res.headers.get('x-gooby-model');
      if (responseModel && this.models.some((model) => model.id === responseModel)) {
        this.selectedModel = responseModel;
        this.persistSelected();
      }

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let parseBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parseBuffer += decoder.decode(value, { stream: true });
        const parsed = parseChatChunk(parseBuffer);
        parseBuffer = parsed.remaining;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.titleUpdate) {
          const update = parsed.titleUpdate;
          this.conversations = this.conversations.map((conversation) =>
            conversation.id === update.conversationId
              ? { ...conversation, title: update.title }
              : conversation
          );
        }
        if (parsed.content || parsed.reasoning) {
          if (parsed.content) assistantMessage.content += parsed.content;
          if (parsed.reasoning) {
            assistantMessage.reasoning = (assistantMessage.reasoning ?? '') + parsed.reasoning;
          }
          this.messages = this.messages.map((message) =>
            message.id === assistantMessage.id ? { ...assistantMessage } : message
          );
          this.onScroll?.();
        }
      }

      if (!assistantMessage.content.trim()) {
        assistantMessage.content = 'No response returned.';
        this.messages = this.messages.map((message) =>
          message.id === assistantMessage.id ? { ...assistantMessage } : message
        );
      }

      await this.refreshConversations();
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      if (aborted && this.userStopped) {
        assistantMessage.content = assistantMessage.content.trim()
          ? `${assistantMessage.content}\n\n_Stopped._`
          : '_Stopped._';
        this.messages = this.messages.map((message) =>
          message.id === assistantMessage.id ? { ...assistantMessage } : message
        );
      } else if (aborted) {
        // External abort (page hidden, navigation, mobile suspend).
        // Server keeps generating and will persist; leave assistant message as-is.
        // A visibilitychange-driven loadMessages() will reconcile on return.
      } else {
        this.error = err instanceof Error ? err.message : 'Chat request failed';
        assistantMessage.content = `Request failed: ${this.error}`;
        this.messages = this.messages.map((message) =>
          message.id === assistantMessage.id ? { ...assistantMessage } : message
        );
      }
    } finally {
      this.sending = false;
      this.streamAbort = null;
      this.userStopped = false;
      await this.refreshModels({ preserveError: true }).catch(() => {});
    }
  }
}
