import { json, error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import { orders, drinks, profiles } from '$lib/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json().catch(() => null);
  if (!body || typeof body.profileId !== 'number' || typeof body.drinkId !== 'number') {
    throw error(400, 'profileId and drinkId required');
  }

  const profile = db.select().from(profiles).where(eq(profiles.id, body.profileId)).get();
  const drink = db.select().from(drinks).where(eq(drinks.id, body.drinkId)).get();
  if (!profile || !drink) throw error(404, 'profile or drink not found');

  const inserted = db
    .insert(orders)
    .values({
      profileId: body.profileId,
      drinkId: body.drinkId,
      notes: typeof body.notes === 'string' ? body.notes : null
    })
    .returning()
    .get();

  const countAllTime = db
    .select({ c: sql<number>`count(*)` })
    .from(orders)
    .get()?.c ?? 0;

  const countToday = db
    .select({ c: sql<number>`count(*)` })
    .from(orders)
    .where(sql`${orders.createdAt} >= unixepoch('now', 'start of day')`)
    .get()?.c ?? 0;

  // Phase 2 will hook HA dispatch here.

  return json({
    order: inserted,
    counts: { allTime: countAllTime, today: countToday }
  });
};
