import { json } from '@sveltejs/kit';
import { markDrinksActive, getDrinksActiveUntil } from '$lib/drinks/server/llm-priority';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  markDrinksActive();
  return json({ ok: true, activeUntil: getDrinksActiveUntil() });
};
