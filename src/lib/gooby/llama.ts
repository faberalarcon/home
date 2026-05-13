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

const DEFAULT_LLAMA_BASE_URL = 'http://192.168.1.215:8080';

function llamaBaseUrl(): string {
  return (process.env.LLAMA_BASE_URL ?? DEFAULT_LLAMA_BASE_URL).replace(/\/+$/, '');
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
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
  return {
    id: String(raw.id ?? 'unknown'),
    ownedBy: String(raw.owned_by ?? raw.ownedBy ?? 'llamacpp'),
    created: typeof raw.created === 'number' ? raw.created : null,
    status: raw.status?.value ?? 'unknown',
    failed: Boolean(raw.status?.failed ?? raw.failed),
    contextSize: raw.meta?.n_ctx ?? parseArgNumber(raw.status?.args, '--ctx-size'),
    parameterCount: raw.meta?.n_params ?? null,
    sizeBytes: raw.meta?.size ?? null
  };
}

export function chooseDefaultModel(models: LlamaModel[]): string | null {
  return models.find((model) => model.status === 'loaded')?.id ?? models[0]?.id ?? null;
}

export async function fetchLlamaModels(): Promise<LlamaModel[]> {
  const response = await fetch(`${llamaBaseUrl()}/v1/models`, {
    signal: timeoutSignal(5_000)
  });
  if (!response.ok) throw new Error(`models request failed with ${response.status}`);

  const payload = await response.json();
  const data = Array.isArray(payload.data) ? payload.data : [];
  return data.map(normalizeModel);
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
    const metrics = await fetchLlamaMetrics(loadedModel?.id ?? defaultModel);

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

export async function streamChatCompletion(model: string, messages: ChatMessage[]): Promise<Response> {
  const response = await fetch(`${llamaBaseUrl()}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages,
      stream: true
    })
  });

  if (!response.ok || !response.body) {
    const body = await response.text().catch(() => '');
    throw new Error(body || `chat request failed with ${response.status}`);
  }

  return response;
}
