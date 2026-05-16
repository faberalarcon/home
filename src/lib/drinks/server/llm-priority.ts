import { getSetting } from './db/settings';

// Coordinates llama-swap usage between the drinks announcer and Gooby chat.
// Single-process adapter-node — module state is fine. Clustered workers would
// need to move this to a DB/Redis-backed flag.
let drinksActiveUntil = 0;

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
