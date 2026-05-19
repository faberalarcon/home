import { json, type RequestHandler } from '@sveltejs/kit';
import { db } from '$lib/drinks/server/db';
import { drinks, profiles } from '$lib/drinks/server/db/schema';
import { eq } from 'drizzle-orm';
import { checkRateLimit } from '$lib/drinks/server/ratelimit';
import { parseOrder, transcribe, type ParsedOrder } from '$lib/drinks/server/voice';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set([
  'audio/webm',
  'audio/webm;codecs=opus',
  'audio/ogg',
  'audio/ogg;codecs=opus',
  'audio/wav',
  'audio/x-wav',
  'audio/mpeg'
]);

function previewFromParsed(parsed: ParsedOrder) {
  const drinkIds = parsed.items.map((i) => i.drink_id);
  const drinkRows = drinkIds.length
    ? db.select({ id: drinks.id, name: drinks.name, category: drinks.category }).from(drinks).where(eq(drinks.id, drinkIds[0])).all()
    : [];
  const drinkById = new Map<number, { id: number; name: string; category: string }>();
  for (const id of drinkIds) {
    const row = db.select({ id: drinks.id, name: drinks.name, category: drinks.category })
      .from(drinks).where(eq(drinks.id, id)).get();
    if (row) drinkById.set(id, row);
  }
  // Avoid an unused-binding lint warning while still keeping the lookup for any
  // future single-row optimization.
  void drinkRows;

  const profile = parsed.profile_id != null
    ? db.select().from(profiles).where(eq(profiles.id, parsed.profile_id)).get() ?? null
    : null;

  const items = parsed.items.map((it) => ({
    drinkId: it.drink_id,
    quantity: it.quantity,
    notes: it.notes,
    name: drinkById.get(it.drink_id)?.name ?? null,
    category: drinkById.get(it.drink_id)?.category ?? null
  }));

  const missingDrinks = items.filter((it) => !it.name).length;
  let confidence: ParsedOrder['confidence'] = parsed.confidence;
  if (missingDrinks > 0) confidence = confidence === 'high' ? 'medium' : 'low';

  return {
    profileId: profile?.id ?? null,
    profileName: profile?.name ?? null,
    items,
    confidence,
    ambiguities: parsed.ambiguities
  };
}

export const POST: RequestHandler = async (event) => {
  const ip = event.getClientAddress();
  const rate = checkRateLimit('voice', ip);
  if (!rate.allowed) {
    return json(
      { error: 'Too many voice requests' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfter ?? 5) } }
    );
  }

  let form: FormData;
  try {
    form = await event.request.formData();
  } catch {
    return json({ error: 'Body must be multipart/form-data with an "audio" field' }, { status: 400 });
  }
  const blob = form.get('audio');
  if (!(blob instanceof File)) {
    return json({ error: 'Missing audio file' }, { status: 400 });
  }
  if (blob.size > MAX_AUDIO_BYTES) {
    return json({ error: 'Audio exceeds 5 MB' }, { status: 413 });
  }
  const mime = (blob.type || '').toLowerCase();
  if (mime && !ALLOWED_MIME.has(mime)) {
    return json({ error: `Unsupported audio mime: ${mime}` }, { status: 415 });
  }

  const buffer = Buffer.from(await blob.arrayBuffer());

  try {
    const transcription = await transcribe(buffer, mime);
    if (!transcription.text) {
      return json({ preview: null, autoSubmit: false, transcript: '', message: 'No speech detected' });
    }
    const parsed = await parseOrder(transcription.text);
    const preview = previewFromParsed(parsed);
    const autoSubmit = preview.confidence === 'high' && preview.ambiguities.length === 0 && preview.items.every((it) => it.name);
    return json({
      preview,
      autoSubmit,
      transcript: transcription.text,
      durationMs: transcription.durationMs
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Voice processing failed';
    console.warn('[voice] failure:', message);
    return json({ error: message }, { status: 502 });
  }
};
