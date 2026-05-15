export type LlamaModelStatus = 'loaded' | 'unloaded' | 'loading' | 'unknown';

export interface LlamaModel {
  id: string;
  ownedBy: string;
  created: number | null;
  status: LlamaModelStatus;
  failed: boolean;
  contextSize: number | null;
  parameterCount: number | null;
  sizeBytes: number | null;
  displayLabel?: string;
  shortLabel?: string;
  default?: boolean;
}

export interface LlamaMetrics {
  promptTokensTotal: number | null;
  promptTokensPerSecond: number | null;
  predictedTokensTotal: number | null;
  predictedTokensPerSecond: number | null;
  requestsProcessing: number | null;
  requestsDeferred: number | null;
}

export interface LlamaStatus {
  available: boolean;
  models: LlamaModel[];
  loadedModel: LlamaModel | null;
  defaultModel: string | null;
  metrics: LlamaMetrics | null;
  metricsAvailable: boolean;
  error: string | null;
  checkedAt: string;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GoobyModelOption {
  id: string;
  displayLabel: string;
  shortLabel: string;
  default?: boolean;
}

export interface GoobyModelVerification {
  model: LlamaModel;
  verifiedAt: string;
}

export interface GoobyModelWaitOptions {
  timeoutMs?: number;
  pollMs?: number;
  onPoll?: (model: LlamaModel) => void | Promise<void>;
}

export const GOOBY_MODEL_OPTIONS = [
  {
    id: 'gpt-oss-20b-heretic-ara-v3',
    displayLabel: 'GPT 6.7',
    shortLabel: 'GPT 6.7',
    default: true
  },
  {
    id: 'gpt-oss-20b-heretic-ara-v3-thinking',
    displayLabel: 'GPT 6.7 Thinking',
    shortLabel: 'Thinking'
  },
  {
    id: 'gemma4:e2b',
    displayLabel: 'GPT 6.7 Instant',
    shortLabel: 'Instant'
  },
  {
    id: 'gemma4:e4b',
    displayLabel: 'GPT 6.9 Limon Light',
    shortLabel: 'Limon Light'
  },
  {
    id: 'gemma4-26b-heretic',
    displayLabel: 'GPT 6.9 Limon Max',
    shortLabel: 'Limon Max'
  },
  {
    id: 'gemma4-26b-heretic-128k',
    displayLabel: 'GPT 6.9 Limon Ultra',
    shortLabel: 'Limon Ultra'
  }
] satisfies GoobyModelOption[];

const GOOBY_DEFAULT_MODEL_ID = GOOBY_MODEL_OPTIONS.find((model) => model.default)?.id ?? GOOBY_MODEL_OPTIONS[0].id;
const GOOBY_MODEL_OPTIONS_BY_ID = new Map(GOOBY_MODEL_OPTIONS.map((model) => [model.id, model]));
export const GOOBY_MODEL_READY_TIMEOUT_MS = 90_000;
export const GOOBY_MODEL_READY_POLL_MS = 2_000;

const DEFAULT_LLAMA_BASE_URL = 'http://192.168.1.215:8080';

function llamaBaseUrl(): string {
  return (process.env.LLAMA_BASE_URL ?? DEFAULT_LLAMA_BASE_URL).replace(/\/+$/, '');
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function numberFromMetric(text: string, name: string): number | null {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = text.match(new RegExp(`^${escaped}\\s+(-?\\d+(?:\\.\\d+)?)$`, 'm'));
  if (!match) return null;
  const value = Number(match[1]);
  return Number.isFinite(value) ? value : null;
}

function parseArgNumber(args: unknown, flag: string): number | null {
  if (!Array.isArray(args)) return null;
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return null;
  const value = Number(args[idx + 1]);
  return Number.isFinite(value) ? value : null;
}

function normalizeModel(raw: any): LlamaModel {
  const rawStatus = raw.status;
  const statusValue = typeof rawStatus?.value === 'string' ? rawStatus.value : null;
  // llama-swap sets `status.failed: true` whenever a previous load attempt exited
  // non-zero — including normal exits from being swapped out (exit_code 10). It is
  // NOT a terminal state: the model can be loaded again on demand. We therefore
  // ignore it and only treat an explicit `status.value === 'error'` as failed.
  const explicitFailed = statusValue === 'error';

  let status: LlamaModelStatus;
  if (statusValue === 'loaded' || statusValue === 'ready') status = 'loaded';
  else if (statusValue === 'loading') status = 'loading';
  else if (statusValue === 'unloaded' || statusValue === 'idle') status = 'unloaded';
  else if (rawStatus) status = 'unloaded';
  else status = 'unknown';

  return {
    id: String(raw.id ?? 'unknown'),
    ownedBy: String(raw.owned_by ?? raw.ownedBy ?? 'llamacpp'),
    created: typeof raw.created === 'number' ? raw.created : null,
    status,
    failed: explicitFailed,
    contextSize: raw.meta?.n_ctx ?? parseArgNumber(raw.status?.args, '--ctx-size'),
    parameterCount: raw.meta?.n_params ?? null,
    sizeBytes: raw.meta?.size ?? null
  };
}

export function chooseDefaultModel(models: LlamaModel[]): string | null {
  return models.find((model) => model.status === 'loaded')?.id ?? models[0]?.id ?? null;
}

export function isGoobyModelId(modelId: string | null | undefined): modelId is string {
  return Boolean(modelId && GOOBY_MODEL_OPTIONS_BY_ID.has(modelId));
}

export function goobyModelOption(modelId: string | null | undefined): GoobyModelOption | null {
  return modelId ? GOOBY_MODEL_OPTIONS_BY_ID.get(modelId) ?? null : null;
}

export function filterGoobyModels(models: LlamaModel[]): LlamaModel[] {
  const modelsById = new Map(models.map((model) => [model.id, model]));
  return GOOBY_MODEL_OPTIONS.flatMap((option) => {
    const model = modelsById.get(option.id);
    if (!model) return [];
    return [
      {
        ...model,
        displayLabel: option.displayLabel,
        shortLabel: option.shortLabel,
        default: Boolean(option.default)
      }
    ];
  });
}

export async function fetchGoobyModels(): Promise<LlamaModel[]> {
  return filterGoobyModels(await fetchLlamaModels());
}

export function chooseGoobyDefaultModel(models: LlamaModel[]): string | null {
  const goobyModels = filterGoobyModels(models);
  return (
    goobyModels.find((model) => model.status === 'loaded')?.id ??
    goobyModels.find((model) => model.id === GOOBY_DEFAULT_MODEL_ID)?.id ??
    goobyModels[0]?.id ??
    null
  );
}

export function resolveGoobyModel(modelId: string | null | undefined, models: LlamaModel[] = []): string | null {
  const availableIds = new Set(filterGoobyModels(models).map((model) => model.id));
  if (isGoobyModelId(modelId) && (availableIds.size === 0 || availableIds.has(modelId))) return modelId;
  return chooseGoobyDefaultModel(models) ?? GOOBY_DEFAULT_MODEL_ID;
}

export function resolveAvailableGoobyModel(modelId: string | null | undefined, models: LlamaModel[]): string | null {
  if (!isGoobyModelId(modelId)) return null;
  return filterGoobyModels(models).some((model) => model.id === modelId) ? modelId : null;
}

export async function fetchLlamaModels(): Promise<LlamaModel[]> {
  const response = await fetch(`${llamaBaseUrl()}/v1/models`, {
    signal: timeoutSignal(5_000)
  });
  if (!response.ok) throw new Error(`models request failed with ${response.status}`);

  const payload = await response.json();
  const data = Array.isArray(payload.data) ? payload.data : [];
  const anyHasStatus = data.some((m: any) => m && typeof m.status === 'object');
  const normalized = data.map(normalizeModel);
  // Vanilla llama-server: /v1/models has no status field — only one model is ever live.
  if (!anyHasStatus && normalized.length > 0) {
    normalized.forEach((m: LlamaModel, idx: number) => {
      m.status = idx === 0 ? 'loaded' : 'unloaded';
    });
  }
  return normalized;
}

export async function fetchLlamaMetrics(modelId: string | null): Promise<LlamaMetrics | null> {
  const targets = [`${llamaBaseUrl()}/v1/metrics`];
  if (modelId) targets.push(`${llamaBaseUrl()}/metrics?model=${encodeURIComponent(modelId)}`);
  targets.push(`${llamaBaseUrl()}/metrics`);

  for (const url of targets) {
    const response = await fetch(url, { signal: timeoutSignal(5_000) }).catch(() => null);
    if (!response?.ok) continue;

    const text = await response.text();
    if (!text.includes('llamacpp:')) continue;

    return {
      promptTokensTotal: numberFromMetric(text, 'llamacpp:prompt_tokens_total'),
      promptTokensPerSecond: numberFromMetric(text, 'llamacpp:prompt_tokens_seconds'),
      predictedTokensTotal: numberFromMetric(text, 'llamacpp:tokens_predicted_total'),
      predictedTokensPerSecond: numberFromMetric(text, 'llamacpp:predicted_tokens_seconds'),
      requestsProcessing: numberFromMetric(text, 'llamacpp:requests_processing'),
      requestsDeferred: numberFromMetric(text, 'llamacpp:requests_deferred')
    };
  }

  return null;
}

export async function getLlamaStatus(): Promise<LlamaStatus> {
  const checkedAt = new Date().toISOString();
  try {
    const models = await fetchLlamaModels();
    const loadedModel = models.find((model) => model.status === 'loaded') ?? null;
    const defaultModel = chooseDefaultModel(models);
    const metrics = loadedModel ? await fetchLlamaMetrics(loadedModel.id) : null;

    return {
      available: true,
      models,
      loadedModel,
      defaultModel,
      metrics,
      metricsAvailable: Boolean(metrics),
      error: null,
      checkedAt
    };
  } catch (error) {
    return {
      available: false,
      models: [],
      loadedModel: null,
      defaultModel: null,
      metrics: null,
      metricsAvailable: false,
      error: error instanceof Error ? error.message : 'Unable to reach llama.cpp',
      checkedAt
    };
  }
}

export async function getGoobyLlamaStatus(): Promise<LlamaStatus> {
  const status = await getLlamaStatus();
  const models = filterGoobyModels(status.models);
  const loadedModel = models.find((model) => model.status === 'loaded') ?? null;
  const defaultModel = chooseGoobyDefaultModel(status.models);

  return {
    ...status,
    models,
    loadedModel,
    defaultModel,
    metrics: status.metrics,
    metricsAvailable: status.metricsAvailable
  };
}

export async function probeGoobyModelLoad(modelId: string): Promise<string | null> {
  // Kick off a tiny completion so llama-swap performs the swap. Returns null on
  // success, or the upstream error message if llama-swap rejected the load
  // (e.g. model crashed during initialization, OOM, bad config). Generous 180s
  // timeout for big models.
  try {
    const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: 1,
        stream: false
      }),
      signal: timeoutSignal(180_000)
    });

    if (response.ok) return null;

    const text = await response.text().catch(() => '');
    try {
      const payload = JSON.parse(text);
      const message =
        typeof payload?.error?.message === 'string'
          ? payload.error.message
          : typeof payload?.error === 'string'
            ? payload.error
            : null;
      if (message) return message;
    } catch {
      // Not JSON — fall through.
    }
    return text || `llama.cpp returned HTTP ${response.status}`;
  } catch (error) {
    return error instanceof Error ? error.message : 'Probe request failed';
  }
}

export async function verifyGoobyModel(modelId: string): Promise<GoobyModelVerification> {
  const models = await fetchGoobyModels();
  const model = models.find((candidate) => candidate.id === modelId);

  if (!model) {
    throw new Error(`${goobyModelOption(modelId)?.displayLabel ?? modelId} is not listed by llama.cpp`);
  }

  if (model.failed) {
    throw new Error(`${model.displayLabel ?? model.id} failed to load in llama.cpp`);
  }

  if (model.status !== 'loaded' && model.status !== 'loading') {
    throw new Error(`${model.displayLabel ?? model.id} did not become active in llama.cpp`);
  }

  return {
    model,
    verifiedAt: new Date().toISOString()
  };
}

export function goobyModelStatusLabel(model: LlamaModel | null | undefined): string {
  if (!model) return 'unavailable';
  if (model.failed) return 'failed';
  if (model.status === 'loaded') return 'ready';
  if (model.status === 'loading') return 'loading';
  return 'unloaded';
}

export function isModelLoadPendingError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? '');
  return /abort|busy|loading|load|not ready|switch|timeout|unavailable|503|500/i.test(message);
}

export async function waitForGoobyModelReady(
  modelId: string,
  options: GoobyModelWaitOptions = {}
): Promise<GoobyModelVerification> {
  const timeoutMs = options.timeoutMs ?? GOOBY_MODEL_READY_TIMEOUT_MS;
  const pollMs = options.pollMs ?? GOOBY_MODEL_READY_POLL_MS;
  const deadline = Date.now() + timeoutMs;
  let lastModel: LlamaModel | null = null;

  while (Date.now() <= deadline) {
    const models = await fetchGoobyModels();
    const model = models.find((candidate) => candidate.id === modelId);

    if (!model) {
      throw new Error(`${goobyModelOption(modelId)?.displayLabel ?? modelId} is not listed by llama.cpp`);
    }

    lastModel = model;
    await options.onPoll?.(model);

    if (model.status === 'loaded') {
      return {
        model,
        verifiedAt: new Date().toISOString()
      };
    }

    await sleep(Math.min(pollMs, Math.max(0, deadline - Date.now())));
  }

  const label = lastModel?.displayLabel ?? goobyModelOption(modelId)?.displayLabel ?? modelId;
  const status = goobyModelStatusLabel(lastModel);
  throw new Error(`${label} is still ${status} after ${Math.round(timeoutMs / 1000)} seconds`);
}

const TITLE_SYSTEM_PROMPT = `You are a chat title generator. Read the conversation and output ONLY a short title that summarizes the topic. Rules: 3 to 6 words, plain text, no quotes, no trailing punctuation, no preamble, no explanation. Output the title and nothing else.`;

export function sanitizeChatTitle(raw: string): string | null {
  if (typeof raw !== 'string') return null;
  let title = raw.replace(/\r\n/g, '\n').trim();
  if (!title) return null;
  // Model rambled — bail out, caller keeps placeholder.
  if (title.length > 120) return null;
  // Take only first line in case model added explanation below.
  title = title.split('\n')[0].trim();
  // Strip wrapping quotes / backticks (matched pairs).
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’']
  ];
  for (const [open, close] of pairs) {
    if (title.startsWith(open) && title.endsWith(close) && title.length >= 2) {
      title = title.slice(1, -1).trim();
    }
  }
  // Drop common preambles.
  title = title.replace(/^(title|chat title)\s*[:\-]\s*/i, '').trim();
  // Collapse whitespace.
  title = title.replace(/\s+/g, ' ');
  // Drop trailing punctuation.
  title = title.replace(/[.!?,;:]+$/u, '').trim();
  if (!title) return null;
  return title.slice(0, 60);
}

export async function generateChatTitle(
  model: string,
  firstUser: string,
  firstAssistant: string
): Promise<string | null> {
  const userPayload = `Conversation:\n\nUser: ${firstUser.slice(0, 2_000)}\n\nAssistant: ${firstAssistant.slice(0, 2_000)}\n\nReturn the title now.`;
  try {
    const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: timeoutSignal(20_000),
      body: JSON.stringify({
        model,
        stream: false,
        max_tokens: 32,
        temperature: 0.4,
        messages: [
          { role: 'system', content: TITLE_SYSTEM_PROMPT },
          { role: 'user', content: userPayload }
        ]
      })
    });
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    const raw = payload?.choices?.[0]?.message?.content;
    if (typeof raw !== 'string') return null;
    return sanitizeChatTitle(raw);
  } catch {
    return null;
  }
}

export async function streamChatCompletion(model: string, messages: ChatMessage[]): Promise<Response> {
  const controller = new AbortController();
  // llama-swap may need to unload/load a model before responding — give it room.
  const startTimeout = setTimeout(() => controller.abort(), 180_000);
  let response: Response;

  try {
    response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        messages,
        stream: true
      })
    });
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error('llama.cpp did not start the selected model within 180 seconds');
    }
    throw error;
  } finally {
    clearTimeout(startTimeout);
  }

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `chat request failed with ${response.status}`);
  }

  return response;
}
