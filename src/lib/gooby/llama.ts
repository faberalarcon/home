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

export const GOOBY_MODEL_OPTIONS = [
  {
    id: 'gpt-oss-20b-fast',
    displayLabel: 'GPT 6.7',
    shortLabel: 'GPT 6.7',
    default: true
  },
  {
    id: 'gpt-oss-20b-thinking',
    displayLabel: 'GPT 6.7 - Thinking',
    shortLabel: 'Thinking'
  },
  {
    id: 'llama3.2:3b',
    displayLabel: 'GPT 6.7 Instant',
    shortLabel: 'Instant'
  }
] satisfies GoobyModelOption[];

const GOOBY_DEFAULT_MODEL_ID = GOOBY_MODEL_OPTIONS.find((model) => model.default)?.id ?? GOOBY_MODEL_OPTIONS[0].id;
const GOOBY_MODEL_OPTIONS_BY_ID = new Map(GOOBY_MODEL_OPTIONS.map((model) => [model.id, model]));

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

export function chooseGoobyDefaultModel(models: LlamaModel[]): string | null {
  const goobyModels = filterGoobyModels(models);
  return goobyModels.find((model) => model.id === GOOBY_DEFAULT_MODEL_ID)?.id ?? goobyModels[0]?.id ?? null;
}

export function resolveGoobyModel(modelId: string | null | undefined, models: LlamaModel[] = []): string | null {
  const availableIds = new Set(filterGoobyModels(models).map((model) => model.id));
  if (isGoobyModelId(modelId) && (availableIds.size === 0 || availableIds.has(modelId))) return modelId;
  return chooseGoobyDefaultModel(models) ?? GOOBY_DEFAULT_MODEL_ID;
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
