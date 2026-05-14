import type { LlamaModel, LlamaStatus } from './llama';

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
  model: string | null;
  createdAt: number;
};

export type GoobyChatInit = {
  conversations: GoobyConversation[];
  llama: LlamaStatus;
};

type SseParse = {
  content: string;
  remaining: string;
  error: string | null;
  status: string | null;
};

function consumeSseChunk(buffer: string): SseParse {
  let content = '';
  let streamError: string | null = null;
  let status: string | null = null;
  const events = buffer.split('\n\n');
  const remaining = events.pop() ?? '';

  for (const event of events) {
    const eventName = event
      .split('\n')
      .find((line) => line.startsWith('event:'))
      ?.slice(6)
      .trim();
    const dataLines = event
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim());

    for (const dataLine of dataLines) {
      if (!dataLine || dataLine === '[DONE]') continue;
      try {
        const payload = JSON.parse(dataLine);
        if (eventName === 'status' && typeof payload.message === 'string') {
          status = payload.message;
          continue;
        }
        const delta = payload.choices?.[0]?.delta;
        if (typeof delta?.content === 'string') content += delta.content;
        if (typeof payload.error === 'string') streamError = payload.error;
        if (typeof payload.error?.message === 'string') streamError = payload.error.message;
      } catch {
        // Ignore malformed data events from upstream.
      }
    }
  }

  return { content, remaining, error: streamError, status };
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
  private onScroll: (() => void) | null = null;

  constructor(init: GoobyChatInit) {
    this.conversations = init.conversations;
    this.models = init.llama.models;
    this.selectedId = init.conversations[0]?.id ?? null;
    this.fallbackDefaultModel = init.llama.defaultModel ?? init.llama.models[0]?.id ?? '';
    this.selectedModel = this.fallbackDefaultModel;
    this.error = init.llama.error;
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

    try {
      const res = await fetch('/gooby/api/models', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: modelId })
      });
      const payload = await res.json().catch(() => null);
      if (payload) {
        const nextModels: LlamaModel[] = payload.models ?? [];
        this.models = nextModels;
        if (payload.error) {
          this.error = payload.error;
        }
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to switch model';
    } finally {
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
      } else {
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
    this.streamAbort?.abort();
  }

  async sendMessage(input?: string) {
    const text = (input ?? this.prompt).trim();
    if (!text || !this.selectedModel || this.sending) return;

    this.sending = true;
    this.error = null;
    if (input === undefined) this.prompt = '';

    const waitingForModel = this.selectedModelInfo?.status !== 'loaded';
    const label = this.selectedModelInfo?.shortLabel ?? this.selectedModelInfo?.id ?? 'model';
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
      content: waitingForModel ? `Waiting for ${label} to load...` : '',
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
      }

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload.error ?? 'Chat request failed');
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let parseBuffer = '';
      let assistantHasAnswer = false;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        parseBuffer += decoder.decode(value, { stream: true });
        const parsed = consumeSseChunk(parseBuffer);
        parseBuffer = parsed.remaining;
        if (parsed.error) throw new Error(parsed.error);
        if (parsed.status && !assistantHasAnswer) {
          assistantMessage.content = parsed.status;
          this.messages = this.messages.map((message) =>
            message.id === assistantMessage.id ? { ...assistantMessage } : message
          );
          await this.refreshModels({ preserveError: true });
          this.onScroll?.();
        }
        if (parsed.content) {
          if (!assistantHasAnswer) {
            assistantMessage.content = '';
            assistantHasAnswer = true;
          }
          assistantMessage.content += parsed.content;
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
      if (aborted) {
        assistantMessage.content = assistantMessage.content.trim()
          ? `${assistantMessage.content}\n\n_Stopped._`
          : '_Stopped._';
        this.messages = this.messages.map((message) =>
          message.id === assistantMessage.id ? { ...assistantMessage } : message
        );
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
      await this.refreshModels().catch(() => {});
    }
  }
}
