import { getSetting } from './db/settings';

// Coordinates llama-swap usage between the drinks announcer, Gooby chat, and
// the RAG/rewrite paths. Single-process adapter-node — module state is fine.
// Clustered workers would need to move these to a DB/Redis-backed flag.
let drinksActiveUntil = 0;
let chatActiveUntil = 0;
let ragActiveUntil = 0;

export function markDrinksActive(ttlSeconds?: number): void {
  const ttl = ttlSeconds ?? Number(getSetting('tts_llm_preload_ttl_s') ?? '60');
  drinksActiveUntil = Date.now() + ttl * 1000;
}

export function isDrinksActive(): boolean {
  return drinksActiveUntil > Date.now();
}

export function clearDrinksActive(): void {
  drinksActiveUntil = 0;
}

export function getDrinksActiveUntil(): number {
  return drinksActiveUntil;
}

export function markChatActive(ttlSeconds = 120): void {
  chatActiveUntil = Date.now() + ttlSeconds * 1000;
}

export function clearChatActive(): void {
  chatActiveUntil = 0;
}

export function isChatActive(): boolean {
  return chatActiveUntil > Date.now();
}

export function markRagActive(ttlSeconds = 30): void {
  ragActiveUntil = Date.now() + ttlSeconds * 1000;
}

export function clearRagActive(): void {
  ragActiveUntil = 0;
}

export function isRagActive(): boolean {
  return ragActiveUntil > Date.now();
}

// gooby-rewrite must yield to drinks (TTS quips), gooby chat, and RAG retrieval.
export function isAnyHigherPriorityActive(): boolean {
  return isDrinksActive() || isChatActive() || isRagActive();
}
